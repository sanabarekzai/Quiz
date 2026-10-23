const assert = require("node:assert/strict");
const test = require("node:test");
const data = require("../data/tool-matcher.json");
const { publicQuestions, validateAnswers, calculateResults } = require("../lib/tool-matcher");

test("matcher API projection contains all choices but never returns points", () => {
  const questions = publicQuestions(data);
  assert.equal(questions.length, 12);
  assert.ok(questions.every((question) => question.choices.length === 4));
  assert.equal(JSON.stringify(questions).includes('"points"'), false);
});

test("matcher rejects missing and invalid answers", () => {
  assert.equal(validateAnswers({ 1: "A" }, data), false);
  const answers = Object.fromEntries(data.questions.map((question) => [question.id, "A"]));
  answers[12] = "Z";
  assert.equal(validateAnswers(answers, data), false);
});

test("all-A answers lead with a focus tool; all-B with a planner; all-D with Quizlet", () => {
  const run = (choice) => calculateResults(
    Object.fromEntries(data.questions.map((question) => [question.id, choice])), data,
  );
  const allA = run("A").ranking;
  assert.ok(["FT", "LA"].includes(allA[0].id));
  const allB = run("B").ranking;
  assert.ok(["CAL", "STR"].includes(allB[0].id));
  assert.equal(run("D").ranking[0].id, "QZ");
});

test("results include seven unique tools with valid match percentages", () => {
  const answers = Object.fromEntries(data.questions.map((question) => [question.id, "A"]));
  const result = calculateResults(answers, data);
  assert.equal(result.ranking.length, 7);
  assert.equal(new Set(result.ranking.map((tool) => tool.id)).size, 7);
  assert.ok(result.ranking.every((tool) => tool.matchPercent >= 0 && tool.matchPercent <= 100));
  assert.ok(result.bestGroup);
});
