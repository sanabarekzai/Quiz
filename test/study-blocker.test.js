const assert = require("node:assert/strict");
const test = require("node:test");
const data = require("../data/study-blockers.json");
const { calculateStudyBlockerResult } = require("../lib/study-blocker");

const questions = data.questions.map((question, index) => ({
  id: index + 1,
  answer_points: question.points,
}));

test("study blocker quiz has 12 questions, four choices, and correct maximums", () => {
  assert.equal(data.questions.length, 12);
  assert.ok(data.questions.every((question) => question.options.length === 4 && question.points.length === 4));
  const actualMaximums = Object.fromEntries(data.order.map((id) => [
    id,
    data.questions.filter((question) => question.points.includes(id)).length,
  ]));
  assert.deepEqual(actualMaximums, data.maxPoints);
});

test("all-A answers identify Starting Struggle and remain ungraded", () => {
  const result = calculateStudyBlockerResult(questions, Array(12).fill(0), data);
  assert.equal(result.profiles[0].id, "S");
  assert.equal(result.score, null);
  assert.equal(result.percentage, null);
  assert.ok(result.results.every((answer) => answer.isCorrect === null && answer.isScored === false));
});

test("ties at the top are broken using the final answer", () => {
  const tieQuestions = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    answer_points: index < 5 ? ["S", "D", "E", "P"]
      : index < 9 ? ["D", "S", "E", "P"]
        : index === 9 ? ["E", "S", "D", "P"]
          : index === 10 ? ["P", "S", "D", "E"]
            : ["S", "D", "E", "P"],
  }));
  const answers = [...Array(11).fill(0), 1];
  const result = calculateStudyBlockerResult(tieQuestions, answers, data);
  assert.equal(result.profiles[0].percentage, result.profiles[1].percentage);
  assert.equal(result.profiles[0].id, "D");
});

test("under-35% cutoff can produce Steady Builder and reflections are prompts only", () => {
  function findBalanced(index, counts, answers) {
    if (index === data.questions.length) {
      return data.order.every((id) => counts[id] / data.maxPoints[id] * 100 < data.steadyThreshold)
        ? answers
        : null;
    }
    for (let choice = 0; choice < 4; choice++) {
      const id = data.questions[index].points[choice];
      if (counts[id] >= 3) continue;
      counts[id]++;
      const found = findBalanced(index + 1, counts, [...answers, choice]);
      counts[id]--;
      if (found) return found;
    }
    return null;
  }
  const answers = findBalanced(0, Object.fromEntries(data.order.map((id) => [id, 0])), []);
  assert.ok(answers, "expected a valid response pattern under the selected cutoff");
  const result = calculateStudyBlockerResult(questions, answers, data);
  assert.equal(result.isSteadyBuilder, true);
  assert.deepEqual(result.primaryProfiles, ["steady"]);
  assert.equal(result.reflections.length, 3);
});

test("incomplete or invalid answer indices are rejected", () => {
  assert.throws(() => calculateStudyBlockerResult(questions, Array(11).fill(0), data));
  assert.throws(() => calculateStudyBlockerResult(questions, [4, ...Array(11).fill(0)], data));
});
