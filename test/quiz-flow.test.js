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

test("a returning user sees the latest saved quiz record after signing in", async () => {
  const app = new MockApp();
  const fetch = async (url) => {
    if (url === "/api/me") {
      return jsonResponse({
        user: { id: 8, username: "returning-player", displayName: "Returning Player" },
      });
    }
    if (url === "/api/me/records") {
      return jsonResponse({
        records: [{
          categoryId: "science",
          title: "Science",
          score: 10,
          totalQuestions: 15,
          percentage: 67,
          attemptCount: 2,
          completedAt: "2026-10-21T18:00:00.000Z",
          result: { score: 10, percentage: 67 },
        }],
      });
    }
    if (url === "/api/quizzes") return jsonResponse({ quizzes: [] });
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

  assert.match(app.innerHTML, /Your latest quiz records/);
  assert.match(app.innerHTML, /Science/);
  assert.match(app.innerHTML, /10 \/ 15 · 67%/);
  assert.match(app.innerHTML, /2 attempts/);
});

test("study personality results accept an unscored submission and show saved profile history", async () => {
  const app = new MockApp();
  const questions = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    category: "study_personality",
    difficulty: "easy",
    prompt: `Study habit question ${index + 1}`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    isScored: false,
  }));
  const savedRecord = {
    categoryId: "study_personality",
    title: "What's Your Study Personality?",
    score: null,
    totalQuestions: 12,
    percentage: null,
    attemptCount: 2,
    completedAt: "2026-10-22T18:00:00.000Z",
    result: { primaryProfiles: ["E"], profileSummary: "Explorer" },
    profileHistory: [
      { completedAt: "2026-10-22T18:00:00.000Z", primaryProfiles: ["E"] },
      { completedAt: "2026-10-20T18:00:00.000Z", primaryProfiles: ["S", "P"] },
    ],
  };
  let submittedPayload;
  const fetch = async (url, options = {}) => {
    if (url === "/api/me") {
      return jsonResponse({ user: { id: 9, username: "study-player", displayName: "Study Player" } });
    }
    if (url === "/api/me/records") return jsonResponse({ records: [savedRecord] });
    if (url === "/api/quizzes") {
      return jsonResponse({ quizzes: [{ id: "study_personality", title: "What's Your Study Personality?", questionCount: 12 }] });
    }
    if (url === "/api/quizzes/study_personality") {
      return jsonResponse({
        quiz: { id: "study_personality", title: "What's Your Study Personality?" },
        questions,
        totalQuestions: questions.length,
      });
    }
    if (url === "/api/quizzes/study_personality/submit") {
      submittedPayload = JSON.parse(options.body);
      return jsonResponse({
        score: null,
        totalQuestions: 12,
        percentage: null,
        profiles: [
          { id: "S", name: "Sprinter", count: 5, percentage: 42 },
          { id: "P", name: "Perfectionist Planner", count: 3, percentage: 25 },
          { id: "B", name: "Study Buddy", count: 2, percentage: 17 },
          { id: "E", name: "Explorer", count: 2, percentage: 17 },
        ],
        primaryProfiles: ["S", "P"],
        profileSummary: "Sprinter with Perfectionist Planner tendencies",
        blendMessage: "Start early with a rough version so you have time to improve it.",
      });
    }
    throw new Error(`Unexpected API request: ${url}`);
  };
  class MockElement {
    constructor(action) {
      this.action = action;
    }
    closest() {
      return { dataset: { action: this.action } };
    }
  }

  vm.runInNewContext(appSource, {
    document: { querySelector: () => app },
    window: { addEventListener() {} },
    fetch,
    HTMLFormElement: MockForm,
    HTMLInputElement: MockInput,
    FormData: MockFormData,
    Element: MockElement,
    console,
  });

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  app.listeners.get("change")({ target: new MockInput("quizId", "study_personality") });
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("setup-form", { quizId: "study_personality" }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  for (let index = 0; index < questions.length; index++) {
    app.listeners.get("change")({ target: new MockInput("answer", "0") });
    if (index < questions.length - 1) {
      app.listeners.get("click")({ target: new MockElement("next-question") });
    }
  }
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("answer-form", {}),
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(submittedPayload.answers.length, 12);
  assert.match(app.innerHTML, /Your Study Personality/);
  assert.match(app.innerHTML, /Sprinter with Perfectionist Planner tendencies/);
  assert.match(app.innerHTML, /No answer is right or wrong/);
  assert.match(app.innerHTML, /Reflection answers are not collected or saved/);

  app.listeners.get("click")({ target: new MockElement("back-to-setup") });
  assert.match(app.innerHTML, /Recent profiles/);
  assert.match(app.innerHTML, /Sprinter \+ Perfectionist Planner/);
});
