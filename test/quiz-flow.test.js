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

test("each available activity can be completed, shows its result, and can be retried", async (t) => {
  const activities = [
    {
      id: "club_carnival",
      title: "Club Carnival",
      count: 5,
      result: {
        score: null,
        totalQuestions: 5,
        percentage: null,
        feedback: "Thanks for sharing your thoughts about the club.",
      },
      resultText: "Thanks for sharing your thoughts about the club.",
    },
    {
      id: "student_wellness",
      title: "Student Wellness Survey",
      count: 12,
      result: {
        score: 22,
        totalQuestions: 12,
        tier: "Doing okay",
        feedback: "Wellness feedback",
        recommendation: "Wellness recommendation",
        maxScore: 36,
      },
      resultText: "Wellness feedback",
    },
    {
      id: "study_skills",
      title: "Study Skills Level-Up Quiz",
      count: 10,
      result: {
        score: 20,
        totalQuestions: 10,
        level: 3,
        tier: "Growing",
        emoji: "📘",
        feedback: "Study skills feedback",
        tips: ["Try one practice strategy."],
        nextQuest: "Plan a study session.",
        maxScore: 30,
      },
      resultText: "Study skills feedback",
    },
    {
      id: "study_personality",
      title: "What's Your Study Personality?",
      count: 12,
      result: {
        score: null,
        totalQuestions: 12,
        percentage: null,
        profiles: [{ id: "S", name: "Sprinter", count: 12, percentage: 100 }],
        primaryProfiles: ["S"],
        profileSummary: "Sprinter",
        feedback: "Sprinter",
      },
      resultText: "Your Study Personality",
    },
    {
      id: "study_blockers",
      title: "Study Blocker Check-In",
      count: 12,
      result: {
        score: null,
        totalQuestions: 12,
        category: "Starting Struggle",
        feedback: "A supportive next step.",
        tips: ["Start with five minutes."],
        results: [],
      },
      resultText: "Your Study Patterns",
    },
  ];

  for (const activity of activities) {
    await t.test(activity.id, async () => {
      const app = new MockApp();
      const questions = Array.from({ length: activity.count }, (_, index) => ({
        id: index + 101,
        prompt: `${activity.title} question ${index + 1}`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        isScored: false,
      }));
      const firstQuestionTitle = `${activity.title.replace(/'/g, "&#39;")} question 1`;
      const firstQuestionPattern = new RegExp(firstQuestionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      let submittedPayload;
      const fetch = async (url, options = {}) => {
        if (url === "/api/me") {
          return jsonResponse({ user: { id: 9, username: "survey-player", displayName: "Survey Player" } });
        }
        if (url === "/api/me/records") return jsonResponse({ records: [] });
        if (url === "/api/quizzes") {
          return jsonResponse({
            quizzes: [{ id: activity.id, title: activity.title, questionCount: activity.count }],
          });
        }
        if (url === `/api/quizzes/${activity.id}`) {
          return jsonResponse({
            quiz: { id: activity.id, title: activity.title },
            questions,
            totalQuestions: questions.length,
          });
        }
        if (url === `/api/quizzes/${activity.id}/submit`) {
          submittedPayload = JSON.parse(options.body);
          return jsonResponse(activity.result);
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

      const flush = async () => {
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));
      };
      await flush();

      app.listeners.get("change")({ target: new MockInput("quizId", activity.id) });
      app.listeners.get("submit")({
        preventDefault() {},
        target: new MockForm("setup-form", { quizId: activity.id }),
      });
      await flush();
      assert.match(app.innerHTML, firstQuestionPattern);

      for (let index = 0; index < questions.length; index++) {
        app.listeners.get("change")({ target: new MockInput("answer", String(index % 4)) });
        if (index < questions.length - 1) {
          app.listeners.get("click")({ target: new MockElement("next-question") });
        }
      }
      app.listeners.get("submit")({
        preventDefault() {},
        target: new MockForm("answer-form", {}),
      });
      await flush();

      assert.equal(submittedPayload.answers.length, activity.count);
      assert.deepEqual(Array.from(submittedPayload.questionIds), questions.map((question) => question.id));
      assert.match(app.innerHTML, new RegExp(activity.resultText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

      app.listeners.get("click")({ target: new MockElement("retry-quiz") });
      assert.match(app.innerHTML, new RegExp(`Question 1 of ${activity.count}`));
      assert.match(app.innerHTML, firstQuestionPattern);
    });
  }
});

test("quiz navigation shows one question at a time and keeps edited answers", async () => {
  const app = new MockApp();
  const quizzes = [
    { id: "club_carnival", title: "Club Carnival", questionCount: 3 },
    { id: "student_wellness", title: "Student Wellness Survey", questionCount: 12 },
    { id: "study_skills", title: "Study Skills Level-Up Quiz", questionCount: 10 },
    { id: "study_personality", title: "What's Your Study Personality?", questionCount: 12 },
    { id: "study_blockers", title: "Study Blocker Check-In", questionCount: 12 },
  ];
  const questions = Array.from({ length: 3 }, (_, index) => ({
    id: index + 201,
    prompt: `Navigation question ${index + 1}`,
    options: ["Choice A", "Choice B", "Choice C", "Choice D"],
    isScored: false,
  }));
  let submittedPayload;
  const fetch = async (url, options = {}) => {
    if (url === "/api/me") {
      return jsonResponse({ user: { id: 11, username: "navigation-player", displayName: "Navigation Player" } });
    }
    if (url === "/api/me/records") return jsonResponse({ records: [] });
    if (url === "/api/quizzes") return jsonResponse({ quizzes });
    if (url === "/api/quizzes/club_carnival") {
      return jsonResponse({
        quiz: { id: "club_carnival", title: "Club Carnival" },
        questions,
        totalQuestions: questions.length,
      });
    }
    if (url === "/api/quizzes/club_carnival/submit") {
      submittedPayload = JSON.parse(options.body);
      return jsonResponse({
        score: null,
        totalQuestions: 3,
        percentage: null,
        feedback: "Thanks for sharing your thoughts about the club.",
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

  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };
  await flush();

  for (const quiz of quizzes) {
    const renderedTitle = quiz.title.replace(/'/g, "&#39;");
    assert.match(app.innerHTML, new RegExp(renderedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  app.listeners.get("change")({ target: new MockInput("quizId", "club_carnival") });
  assert.match(app.innerHTML, /value="club_carnival" checked/);
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("setup-form", { quizId: "club_carnival" }),
  });
  await flush();

  assert.match(app.innerHTML, /Question 1 of 3/);
  assert.match(app.innerHTML, /Navigation question 1/);
  assert.doesNotMatch(app.innerHTML, /Navigation question 2|Navigation question 3/);
  assert.match(app.innerHTML, /data-action="prev-question" disabled/);
  assert.match(app.innerHTML, /data-action="next-question" disabled/);

  app.listeners.get("change")({ target: new MockInput("answer", "0") });
  app.listeners.get("click")({ target: new MockElement("next-question") });
  assert.match(app.innerHTML, /Question 2 of 3/);
  assert.match(app.innerHTML, /Navigation question 2/);
  assert.doesNotMatch(app.innerHTML, /Navigation question 1|Navigation question 3/);

  app.listeners.get("change")({ target: new MockInput("answer", "1") });
  app.listeners.get("click")({ target: new MockElement("prev-question") });
  assert.match(app.innerHTML, /Question 1 of 3/);
  assert.match(app.innerHTML, /value="0" checked/);
  assert.doesNotMatch(app.innerHTML, /Navigation question 2|Navigation question 3/);

  app.listeners.get("change")({ target: new MockInput("answer", "2") });
  app.listeners.get("click")({ target: new MockElement("next-question") });
  assert.match(app.innerHTML, /Question 2 of 3/);
  assert.match(app.innerHTML, /value="1" checked/);
  app.listeners.get("click")({ target: new MockElement("next-question") });
  assert.match(app.innerHTML, /Question 3 of 3/);
  assert.match(app.innerHTML, /data-action="prev-question"/);
  assert.match(app.innerHTML, /Submit Quiz/);
  assert.doesNotMatch(app.innerHTML, /Navigation question 1|Navigation question 2/);

  app.listeners.get("change")({ target: new MockInput("answer", "3") });
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("answer-form", {}),
  });
  await flush();

  assert.deepEqual(Array.from(submittedPayload.answers), [2, 1, 3]);
  assert.deepEqual(Array.from(submittedPayload.questionIds), [201, 202, 203]);
});

test("signed-in students see all attempts in the My History table", async () => {
  const app = new MockApp();
  const attempts = [
    {
      id: 32,
      categoryId: "study_skills",
      title: "Study Skills Level-Up Quiz",
      score: 20,
      totalQuestions: 10,
      percentage: null,
      result: { tier: "Growing" },
      completedAt: "2026-10-27T18:00:00.000Z",
    },
    {
      id: 31,
      categoryId: "club_carnival",
      title: "Club Carnival",
      score: null,
      totalQuestions: 5,
      percentage: null,
      result: { feedback: "Response saved" },
      completedAt: "2026-10-26T18:00:00.000Z",
    },
    {
      id: 30,
      categoryId: "study_skills",
      title: "Study Skills Level-Up Quiz",
      score: 18,
      totalQuestions: 10,
      percentage: null,
      result: { tier: "Developing" },
      completedAt: "2026-10-25T18:00:00.000Z",
    },
  ];
  const fetch = async (url) => {
    if (url === "/api/me") {
      return jsonResponse({ user: { id: 7, username: "history-player", displayName: "History Player" } });
    }
    if (url === "/api/me/records") return jsonResponse({ records: [] });
    if (url === "/api/me/history") return jsonResponse({ attempts });
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

  assert.match(app.innerHTML, /href="#my-history">My History/);
  assert.match(app.innerHTML, /<h2 id="my-history-title">My History<\/h2>/);
  assert.match(app.innerHTML, /<table class="history-table">/);
  assert.equal((app.innerHTML.match(/<tbody>/g) || []).length, 1);
  assert.ok(app.innerHTML.indexOf("2026-10-27") < app.innerHTML.indexOf("2026-10-26"));
  assert.ok(app.innerHTML.indexOf("2026-10-26") < app.innerHTML.indexOf("2026-10-25"));
  assert.match(app.innerHTML, /20 \/ 10 points/);
  assert.match(app.innerHTML, /Response saved/);
});

test("timed quizzes auto-submit selected responses and allow unanswered questions", async () => {
  const app = new MockApp();
  let tick;
  let payload;
  const quiz = { id: "science", title: "Science", questionCount: 2 };
  const fetch = async (url, options = {}) => {
    if (url === "/api/me") return jsonResponse({ user: { id: 4, username: "timer", displayName: "Timer" } });
    if (url === "/api/me/records" || url === "/api/me/history") return jsonResponse({ records: [], attempts: [] });
    if (url === "/api/quizzes") return jsonResponse({ quizzes: [quiz] });
    if (url === "/api/quizzes/science") {
      return jsonResponse({ quiz, questions: [
        { id: 1, prompt: "Timed question one", options: ["A", "B", "C", "D"] },
        { id: 2, prompt: "Timed question two", options: ["A", "B", "C", "D"] },
      ] });
    }
    if (url === "/api/quizzes/science/submit") {
      payload = JSON.parse(options.body);
      return jsonResponse({ score: 0, totalQuestions: 1, percentage: 0, results: [] });
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
    setInterval(callback) { tick = callback; return 1; },
    clearInterval() {},
    console,
  });
  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };
  await flush();
  app.listeners.get("change")({ target: new MockInput("quizId", "science") });
  app.listeners.get("submit")({
    preventDefault() {},
    target: new MockForm("setup-form", { quizId: "science", timerEnabled: "on" }),
  });
  await flush();
  assert.match(app.innerHTML, /60 seconds per question|60s/);
  app.listeners.get("change")({ target: new MockInput("answer", "2") });
  const firstQuestionTick = tick;
  for (let second = 0; second < 60; second++) firstQuestionTick();
  for (let second = 0; second < 60; second++) tick();
  await flush();
  assert.equal(payload.timedMode, true);
  assert.deepEqual(Array.from(payload.answers), [2, null]);
});

test("activity search filters quiz cards by title", async () => {
  const app = new MockApp();
  const quizzes = [
    { id: "science", title: "Science", questionCount: 1 },
    { id: "history", title: "World History", questionCount: 1 },
  ];
  const fetch = async (url) => {
    if (url === "/api/me") return jsonResponse({ error: "Unauthorized." }, 401);
    if (url === "/api/quizzes") return jsonResponse({ quizzes });
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
  const search = new MockInput("", "history");
  search.id = "catalog-search";
  app.listeners.get("input")({ target: search });
  assert.match(app.innerHTML, /<span class="category-title">World History<\/span>/);
  assert.doesNotMatch(app.innerHTML, /<span class="category-title">Science<\/span>/);
  const clearSearch = new MockInput("", "");
  clearSearch.id = "catalog-search";
  app.listeners.get("input")({ target: clearSearch });
  const category = new MockInput("", "science");
  category.id = "catalog-category";
  app.listeners.get("change")({ target: category });
  assert.match(app.innerHTML, /<span class="category-title">Science<\/span>/);
  assert.doesNotMatch(app.innerHTML, /<span class="category-title">World History<\/span>/);
});
