const assert = require("node:assert/strict");
const test = require("node:test");
const { createUserHistoryHandler } = require("../lib/user-history");
const { saveCompletedSessionAttempt } = require("../lib/session-attempts");
const { saveQuizAttempt } = require("../lib/quiz-attempts");

test("each completed quiz submission inserts a separate user-owned attempt", async () => {
  const calls = [];
  const pool = { async query(...args) { calls.push(args); } };
  const result = { score: null, totalQuestions: 2, percentage: null, feedback: "Survey complete." };

  await saveQuizAttempt(pool, 74, "club_carnival", [11, 12], [1, 2], result);
  await saveQuizAttempt(pool, 74, "club_carnival", [11, 12], [2, 2], result);

  assert.equal(calls.length, 2);
  assert.match(calls[0][0], /INSERT INTO quiz_attempts/);
  assert.deepEqual(calls[0][1], [
    74,
    "club_carnival",
    [11, 12],
    JSON.stringify([{ questionId: 11, selectedIndex: 1 }, { questionId: 12, selectedIndex: 2 }]),
    JSON.stringify(result),
    null,
    2,
    null,
  ]);
  assert.deepEqual(JSON.parse(calls[1][1][3]), [
    { questionId: 11, selectedIndex: 2 },
    { questionId: 12, selectedIndex: 2 },
  ]);
});

test("history handler scopes queries to the signed-in user and requests newest-first order", async () => {
  const attempts = [
    { id: 22, categoryId: "study_skills", title: "Study Skills", score: 18 },
    { id: 19, categoryId: "club_carnival", title: "Club Carnival", score: null },
  ];
  let queryText = "";
  let queryParams;
  const handler = createUserHistoryHandler({
    async query(text, params) {
      queryText = text;
      queryParams = params;
      return { rows: attempts };
    },
  });
  let response;

  await handler(
    { session: { userId: 74 } },
    { json(payload) { response = payload; } },
    (error) => { throw error; },
  );

  assert.deepEqual(queryParams, [74]);
  assert.match(queryText, /WHERE a\.user_id = \$1/);
  assert.match(queryText, /ORDER BY a\.completed_at DESC, a\.id DESC/);
  assert.deepEqual(response.attempts, attempts);
});

test("unfinished and guest sessions do not create saved attempts", async () => {
  const calls = [];
  const client = { async query(...args) { calls.push(args); } };
  const session = {
    user_id: 74,
    category_id: "science",
    question_ids: [3, 4],
  };
  const updated = {
    score: 1,
    total_questions: 2,
    duration_seconds: 8,
    answers: [{ questionId: 3, selectedIndex: 0 }],
  };

  assert.equal(await saveCompletedSessionAttempt(client, session, updated, 2, false), false);
  assert.equal(await saveCompletedSessionAttempt(client, { ...session, user_id: null }, updated, 2, true), false);
  assert.equal(calls.length, 0);
});

test("each completed signed-in session writes its own attempt with a computed percentage", async () => {
  const calls = [];
  const client = { async query(...args) { calls.push(args); } };
  const session = {
    user_id: 74,
    category_id: "science",
    question_ids: [3, 4],
  };
  const updated = {
    score: 1,
    total_questions: 2,
    duration_seconds: 8,
    answers: [
      { questionId: 3, selectedIndex: 0 },
      { questionId: 4, selectedIndex: 1 },
    ],
  };

  assert.equal(await saveCompletedSessionAttempt(client, session, updated, 2, true), true);
  assert.equal(await saveCompletedSessionAttempt(client, session, updated, 2, true), true);
  assert.equal(calls.length, 2);
  assert.match(calls[0][0], /INSERT INTO quiz_attempts/);
  assert.deepEqual(calls[0][1], [
    74,
    "science",
    [3, 4],
    JSON.stringify(updated.answers),
    JSON.stringify({ score: 1, totalQuestions: 2, percentage: 50, durationSeconds: 8 }),
    1,
    2,
    50,
  ]);
});

test("completed unscored sessions save an ungraded result", async () => {
  let savedParams;
  const client = { async query(_text, params) { savedParams = params; } };

  await saveCompletedSessionAttempt(
    client,
    { user_id: 74, category_id: "club_carnival", question_ids: [3] },
    { score: 0, total_questions: 1, duration_seconds: 4, answers: [{ questionId: 3, selectedIndex: 2 }] },
    0,
    true,
  );

  assert.equal(savedParams[5], null);
  assert.equal(savedParams[7], null);
  assert.deepEqual(JSON.parse(savedParams[4]), {
    score: null,
    totalQuestions: 1,
    percentage: null,
    durationSeconds: 4,
  });
});
