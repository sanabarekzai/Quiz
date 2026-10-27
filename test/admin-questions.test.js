const assert = require("node:assert/strict");
const test = require("node:test");
const { parseCsv, validateCsv, validateQuestion } = require("../lib/admin-questions");

test("CSV parser supports quoted commas and escaped quotes", () => {
  assert.deepEqual(parseCsv('quiz_id,question_text,choice_a,choice_b,choice_c,choice_d,correct_choice\nscience,"Which is ""red"", white, blue?",red,white,blue,green,A'), [
    ["quiz_id", "question_text", "choice_a", "choice_b", "choice_c", "choice_d", "correct_choice"],
    ["science", 'Which is "red", white, blue?', "red", "white", "blue", "green", "A"],
  ]);
});

test("CSV validation returns valid and invalid rows with actionable errors", () => {
  const rows = validateCsv([
    "quiz_id,question_text,choice_a,choice_b,choice_c,choice_d,correct_choice",
    "science,Valid?,A,B,C,D,B",
    "student_wellness,Survey?,A,B,C,D,A",
    "history,Missing choice?,A,,C,D,Z",
  ].join("\n"));

  assert.equal(rows[0].valid, true);
  assert.equal(rows[0].correctIndex, 1);
  assert.equal(rows[1].valid, false);
  assert.ok(rows[1].errors.some((error) => error.includes("supported quiz")));
  assert.equal(rows[2].valid, false);
  assert.ok(rows[2].errors.some((error) => error.includes("four choices")));
  assert.ok(rows[2].errors.some((error) => error.includes("Correct choice")));
});

test("CSV header and duplicate prompts are rejected", () => {
  assert.throws(() => validateCsv("wrong,header\nx,y"), /CSV header must be/);
  const csv = "quiz_id,question_text,choice_a,choice_b,choice_c,choice_d,correct_choice\nscience,Same?,A,B,C,D,A\nscience,same?,A,B,C,D,A";
  const rows = validateCsv(csv);
  assert.equal(rows[0].valid, true);
  assert.ok(rows[1].errors.some((error) => error.includes("already exists")));
});

test("manual question validation accepts standard scored quiz questions only", () => {
  assert.equal(validateQuestion({
    categoryId: "study_skills",
    prompt: "Question?",
    options: ["A", "B", "C", "D"],
    difficulty: "easy",
    correctIndex: 0,
  }).valid, true);
  assert.equal(validateQuestion({
    categoryId: "club_carnival",
    prompt: "Survey question?",
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
  }).valid, false);
});
