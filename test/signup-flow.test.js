const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

class MockApp {
  constructor() {
    this.listeners = new Map();
    this.innerHTML = "";
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  querySelector() {
    return null;
  }
}

class MockForm {
  constructor(id, fields) {
    this.id = id;
    this.fields = fields;
  }
}

class MockFormData {
  constructor(form) {
    this.fields = form.fields;
  }

  get(name) {
    return this.fields[name] ?? null;
  }
}

class MockElement {
  constructor(dataset) {
    this.dataset = dataset;
  }

  closest() {
    return this;
  }
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

async function createSignupHarness(registerResponse) {
  const app = new MockApp();
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === "/api/me") return jsonResponse({ error: "Unauthorized." }, 401);
    if (url === "/api/quizzes") return jsonResponse({ quizzes: [] });
    if (url === "/api/register") return registerResponse;
    throw new Error(`Unexpected API request: ${url}`);
  };

  vm.runInNewContext(appSource, {
    document: { querySelector: () => app },
    window: { addEventListener() {} },
    fetch,
    HTMLFormElement: MockForm,
    HTMLInputElement: class MockInput {},
    FormData: MockFormData,
    Element: MockElement,
    console,
  });

  // Let the initial auth and quiz requests finish before submitting signup.
  await new Promise((resolve) => setImmediate(resolve));
  app.listeners.get("click")({
    target: new MockElement({ action: "open-register" }),
  });

  return { app, requests };
}

function submitSignup(app, fields) {
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("register-form", fields),
  });
}

async function allowSignupRequestToFinish() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

const enteredFields = {
  username: "player123",
  password: "correct-horse",
  firstName: "Taylor",
  lastName: "Morgan",
  displayName: "Tay Morgan",
};

test("successful signup sends the entered data and logs the user in", async () => {
  const user = {
    id: "mock-user-1",
    username: enteredFields.username,
    firstName: enteredFields.firstName,
    lastName: enteredFields.lastName,
    displayName: enteredFields.displayName,
    role: "player",
  };
  const { app, requests } = await createSignupHarness(jsonResponse({ user }, 201));

  submitSignup(app, enteredFields);
  await allowSignupRequestToFinish();

  const signupRequest = requests.find(({ url }) => url === "/api/register");
  assert.ok(signupRequest, "signup should call the registration API");
  assert.equal(signupRequest.options.method, "POST");
  assert.deepEqual(JSON.parse(signupRequest.options.body), enteredFields);
  assert.match(app.innerHTML, /Welcome, Tay Morgan/);
  assert.doesNotMatch(app.innerHTML, /id="register-form"/);
});

test("a server error is shown and all entered signup values remain available", async () => {
  const message = "Something went wrong. Please try again.";
  const { app, requests } = await createSignupHarness(
    jsonResponse({ error: message }, 500),
  );

  submitSignup(app, enteredFields);
  await allowSignupRequestToFinish();

  assert.ok(requests.some(({ url }) => url === "/api/register"));
  assert.match(app.innerHTML, /role="alert"/);
  assert.ok(app.innerHTML.includes(message));
  for (const value of Object.values(enteredFields)) {
    assert.ok(app.innerHTML.includes(`value="${value}"`), `${value} should remain in the form`);
  }
});
