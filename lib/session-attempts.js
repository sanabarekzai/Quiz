async function saveCompletedSessionAttempt(client, session, updated, scoreTotal, completed) {
  if (!completed || !session.user_id) return false;

  const score = scoreTotal > 0 ? updated.score : null;
  const percentage = scoreTotal > 0
    ? Math.round((updated.score / scoreTotal) * 100)
    : null;
  const result = {
    score,
    totalQuestions: updated.total_questions,
    percentage,
    durationSeconds: updated.duration_seconds,
  };

  await client.query(
    `INSERT INTO quiz_attempts
      (user_id, category_id, question_ids, answers, result, score, total_questions, percentage)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
    [
      session.user_id,
      session.category_id,
      session.question_ids,
      JSON.stringify(updated.answers),
      JSON.stringify(result),
      score,
      updated.total_questions,
      percentage,
    ],
  );
  return true;
}

module.exports = { saveCompletedSessionAttempt };
