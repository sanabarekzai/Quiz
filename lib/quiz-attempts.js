async function saveQuizAttempt(pool, userId, categoryId, questionIds, answers, result) {
  await pool.query(
    `INSERT INTO quiz_attempts
      (user_id, category_id, question_ids, answers, result, score, total_questions, percentage)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
    [
      userId,
      categoryId,
      questionIds,
      JSON.stringify(answers.map((selectedIndex, index) => ({
        questionId: questionIds[index],
        selectedIndex,
      }))),
      JSON.stringify(result),
      result.score,
      result.totalQuestions,
      result.percentage,
    ],
  );
}

module.exports = { saveQuizAttempt };
