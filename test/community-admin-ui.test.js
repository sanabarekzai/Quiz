const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

class MockApp {
  listeners = new Map();
  innerHTML = "";
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

class MockElement {
  constructor(action) { this.dataset = { action }; }
  closest() { return this; }
}

function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

test("signed-in students see newest community outcomes and admins see the question tools", async () => {
  const app = new MockApp();
  const quizCategories = [
    { id: "club_carnival", title: "Club Carnival", questionCount: 5 },
    { id: "student_wellness", title: "Student Wellness Survey", questionCount: 12 },
  ];
  const communityEntries = [
    {
      id: 4,
      categoryId: "club_carnival",
      title: "Club Carnival",
      username: "student-example",
      score: null,
      totalQuestions: 5,
      completedAt: "2026-10-27T18:00:00.000Z",
      outcome: { feedback: "Thanks for sharing your thoughts." },
      sharedResponses: [{ question: "Which activity?", answer: "Art" }],
    },
    {
      id: 5,
      categoryId: "study_tool_matcher",
      title: "Which study tools fit you?",
      username: "matcher-student",
      score: null,
      totalQuestions: 12,
      completedAt: "2026-10-27T18:05:00.000Z",
      outcome: {
        matcherRanking: [
          { rank: 1, name: "Notion", groupName: "Planning", matchPercent: 90 },
          { rank: 2, name: "Quizlet", groupName: "Practice", matchPercent: 82 },
        ],
        matcherGroups: [{ name: "Planning", matchPercent: 84 }],
      },
      sharedResponses: [],
    },
  ];
  const fetch = async (url) => {
    if (url === "/api/me") return jsonResponse({ user: { id: 9, username: "admin-example", displayName: "Admin Example", role: "admin" } });
    if (url === "/api/me/records") return jsonResponse({ records: [] });
    if (url === "/api/me/history") return jsonResponse({ attempts: [] });
    if (url === "/api/community-results") return jsonResponse({ entries: communityEntries });
    if (url === "/api/quizzes") return jsonResponse({ quizzes: quizCategories });
    if (url === "/api/admin/questions") return jsonResponse({
      categories: [{ id: "study_skills", title: "Study Skills Level-Up Quiz" }],
      questions: [{
        id: 23,
        categoryId: "study_skills",
        categoryTitle: "Study Skills Level-Up Quiz",
        difficulty: "easy",
        prompt: "Sample question?",
        options: ["A", "B", "C", "D"],
        correctIndex: 1,
      }],
    });
    throw new Error(`Unexpected API request: ${url}`);
  };

  vm.runInNewContext(source, {
    document: { querySelector: () => app },
    window: { addEventListener() {} },
    fetch,
    HTMLFormElement: class {},
    HTMLInputElement: class {},
    FormData: class {},
    Element: MockElement,
    console,
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(app.innerHTML, /Community results/);
  assert.match(app.innerHTML, /student-example/);
  assert.match(app.innerHTML, /Unscored/);
  assert.match(app.innerHTML, /Which activity\?/);
  assert.match(app.innerHTML, /Which study tools fit you\?/);
  assert.match(app.innerHTML, /STUDY TOOLS/);
  assert.match(app.innerHTML, /Study tool matches/);
  assert.match(app.innerHTML, /Notion/);
  assert.match(app.innerHTML, /90% match/);
  assert.match(app.innerHTML, /Best-fit groups/);
  assert.match(app.innerHTML, /Planning/);
  assert.doesNotMatch(app.innerHTML, /Separate survey/);
  assert.match(app.innerHTML, /Recent results appear first; this is not a competition/i);

  app.listeners.get("click")({ target: new MockElement("open-admin") });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.innerHTML, /Question library/);
  assert.match(app.innerHTML, /admin-question-form/);
  assert.match(app.innerHTML, /Import questions from CSV/);
  assert.match(app.innerHTML, /Sample question\?/);
  assert.doesNotMatch(app.innerHTML, /Club Carnival/);
});
