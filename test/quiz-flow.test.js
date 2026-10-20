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

  querySelectorAll() {
    return [];
  }
}

class MockInput {
  constructor(name, value) {
    this.name = name;
    this.value = value;
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

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("selecting a quiz and starting it displays its first question", async () => {
  const app = new MockApp();
  const requests = [];
  const quiz = { id: "science", title: "Science", description: "Discoveries.", questionCount: 1 };
  const question = {
    id: 42,
    prompt: "What does H2O represent?",
    options: ["Water", "Oxygen", "Hydrogen", "Salt"],
    correctIndex: 0,
    isScored: true,
  };

  const fetch = async (url) => {
    requests.push(url);
    if (url === "/api/me") return jsonResponse({ error: "Unauthorized." }, 401);
    if (url === "/api/quizzes") return jsonResponse({ quizzes: [quiz] });
    if (url === "/api/quizzes/science") {
      return jsonResponse({ quiz, questions: [question], totalQuestions: 1 });
    }
    throw new Error(`Unexpected API request: ${url}`);
  };

  vm.runInNewContext(appSource, {
    document: { querySelector: () => app },
    window: { addEventListener() {} },
    fetch,
    HTMLFormElement: MockForm,
    HTMLInputElement: MockInput,
    FormData: MockFormData,
    Element: class MockElement {},
    console,
  });

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  app.listeners.get("change")({
    target: new MockInput("quizId", "science"),
  });
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("setup-form", { quizId: "science" }),
  });

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(requests.includes("/api/quizzes/science"));
  assert.match(app.innerHTML, /What does H2O represent\?/);
  assert.match(app.innerHTML, /Question 1 of 1/);
});
