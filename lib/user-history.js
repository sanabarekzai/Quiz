function createUserHistoryHandler(pool) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT a.id, a.category_id AS "categoryId", c.title, a.score,
                a.total_questions AS "totalQuestions", a.percentage, a.result,
                a.completed_at AS "completedAt"
         FROM quiz_attempts a
         JOIN quiz_categories c ON c.id = a.category_id
         WHERE a.user_id = $1
         ORDER BY a.completed_at DESC, a.id DESC`,
        [req.session.userId],
      );
      res.json({ attempts: result.rows });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createUserHistoryHandler };
