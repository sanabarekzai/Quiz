const express = require("express");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 5000);
const QUESTIONS_PER_GAME = 5;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Connect the Replit PostgreSQL database before starting the app.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

function publicQuestion(row) {
  return {
    id: row.id,
    category: row.category_id,
    difficulty: row.difficulty,
    prompt: row.prompt,
    options: row.options,
    isScored: row.is_scored,
  };
}

function cleanPlayerName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 24 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function validUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id AS category, c.title, c.description, COUNT(q.id)::int AS "questionCount",
             jsonb_build_object(
               'easy', COUNT(q.id) FILTER (WHERE q.difficulty = 'easy') >= $1,
               'medium', COUNT(q.id) FILTER (WHERE q.difficulty = 'medium') >= $1,
               'hard', COUNT(q.id) FILTER (WHERE q.difficulty = 'hard') >= $1
             ) AS "availableDifficulties"
      FROM quiz_categories c
      LEFT JOIN quiz_questions q ON (
        (c.id = 'mixed' AND q.category_id <> 'club_carnival')
        OR c.id = q.category_id
      )
      GROUP BY c.id, c.title, c.description, c.sort_order
      ORDER BY c.sort_order, c.title
    `, [QUESTIONS_PER_GAME]);
    res.json({ quizzes: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions", async (req, res, next) => {
  const playerName = cleanPlayerName(req.body?.playerName);
  const { category, difficulty } = req.body || {};
  if (!playerName) {
    return res.status(400).json({ error: "Enter a name with 1 to 24 characters." });
  }
  if (typeof category !== "string" || !DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: "Choose a valid quiz and difficulty." });
  }

  try {
    const categoryResult = await pool.query(
      "SELECT id FROM quiz_categories WHERE id = $1",
      [category],
    );
    if (categoryResult.rowCount === 0) {
      return res.status(400).json({ error: "That quiz category is not available." });
    }

    const questionQuery = category === "mixed"
      ? `SELECT id, category_id, difficulty, prompt, options, is_scored
         FROM quiz_questions
         WHERE difficulty = $1 AND category_id <> 'club_carnival'
         ORDER BY random()
         LIMIT $2`
      : `SELECT id, category_id, difficulty, prompt, options, is_scored
         FROM quiz_questions
         WHERE category_id = $1 AND difficulty = $2
         ORDER BY CASE WHEN category_id = 'club_carnival' THEN id END, random()
         LIMIT $3`;
    const questionParams = category === "mixed"
      ? [difficulty, QUESTIONS_PER_GAME]
      : [category, difficulty, QUESTIONS_PER_GAME];
    const questionResult = await pool.query(questionQuery, questionParams);
    if (questionResult.rowCount < QUESTIONS_PER_GAME) {
      return res.status(503).json({ error: "This quiz does not have enough questions yet." });
    }

    const sessionId = randomUUID();
    const questionIds = questionResult.rows.map((question) => question.id);
    await pool.query(
      `INSERT INTO quiz_sessions
        (id, player_name, category_id, difficulty, question_ids, total_questions)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, playerName, category, difficulty, questionIds, QUESTIONS_PER_GAME],
    );

    res.status(201).json({
      sessionId,
      question: publicQuestion(questionResult.rows[0]),
      totalQuestions: QUESTIONS_PER_GAME,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:sessionId/answer", async (req, res, next) => {
  const { sessionId } = req.params;
  const { questionId, selectedIndex } = req.body || {};
  if (!validUuid(sessionId)) {
    return res.status(400).json({ error: "Invalid quiz session." });
  }
  if (!Number.isSafeInteger(questionId) || questionId < 1 ||
      !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
    return res.status(400).json({ error: "Choose one of the available answers." });
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const sessionResult = await client.query(
      `SELECT id, question_ids, current_index, score, total_questions, status, started_at
       FROM quiz_sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId],
    );
    if (sessionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(404).json({ error: "Quiz session not found." });
    }

    const session = sessionResult.rows[0];
    if (session.status !== "in_progress") {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({ error: "This quiz has already been completed." });
    }
    if (session.question_ids[session.current_index] !== questionId) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({ error: "That question is not the current question." });
    }

    const questionResult = await client.query(
      "SELECT correct_index, is_scored, explanation FROM quiz_questions WHERE id = $1",
      [questionId],
    );
    if (questionResult.rowCount === 0) {
      throw new Error("A quiz session references a missing question.");
    }
    const question = questionResult.rows[0];
    const isScored = question.is_scored;
    const correct = isScored ? selectedIndex === question.correct_index : null;
    const pointsAwarded = correct === true ? 1 : 0;
    const completed = session.current_index + 1 >= session.total_questions;
    const answer = JSON.stringify([{
      questionId,
      selectedIndex,
      isScored,
      correct,
    }]);

    const updatedResult = await client.query(
      `UPDATE quiz_sessions
       SET current_index = current_index + 1,
           score = score + $2,
           answers = answers || $3::jsonb,
           status = $4,
           duration_seconds = CASE
             WHEN $4 = 'completed'
             THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int)
             ELSE duration_seconds
           END,
           completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END
       WHERE id = $1
       RETURNING score, current_index, total_questions, duration_seconds`,
      [sessionId, pointsAwarded, answer, completed ? "completed" : "in_progress"],
    );
    const updated = updatedResult.rows[0];
    let nextQuestion = null;
    if (!completed) {
      const nextQuestionResult = await client.query(
        `SELECT id, category_id, difficulty, prompt, options, is_scored
         FROM quiz_questions
         WHERE id = $1`,
        [session.question_ids[updated.current_index]],
      );
      if (nextQuestionResult.rowCount === 0) {
        throw new Error("A quiz session references a missing next question.");
      }
      nextQuestion = publicQuestion(nextQuestionResult.rows[0]);
    }
    const scoreTotalResult = await client.query(
      `SELECT COUNT(*)::int AS score_total
       FROM quiz_questions
       WHERE id = ANY($1::int[]) AND is_scored = TRUE`,
      [session.question_ids],
    );

    await client.query("COMMIT");
    transactionOpen = false;
    res.json({
      isScored,
      correct,
      correctIndex: isScored ? question.correct_index : null,
      explanation: question.explanation,
      currentIndex: updated.current_index,
      totalQuestions: updated.total_questions,
      scoreTotal: scoreTotalResult.rows[0].score_total,
      completed,
      score: updated.score,
      nextQuestion,
      durationSeconds: updated.duration_seconds,
    });
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/leaderboard", async (req, res, next) => {
  const category = req.query.category;
  try {
    let result;
    if (category === undefined || category === "all") {
      result = await pool.query(`
        SELECT s.player_name AS "playerName", s.category_id AS category, s.difficulty,
               s.score, s.total_questions AS "totalQuestions",
               (SELECT COUNT(*)::int
                FROM quiz_questions q
                WHERE q.id = ANY(s.question_ids) AND q.is_scored) AS "scoreTotal",
               s.duration_seconds AS "durationSeconds", s.completed_at AS "completedAt"
        FROM quiz_sessions s
        WHERE s.status = 'completed'
        ORDER BY s.score DESC, s.duration_seconds ASC, s.completed_at DESC
        LIMIT 10
      `);
    } else {
      if (typeof category !== "string") {
        return res.status(400).json({ error: "Choose a valid quiz category." });
      }
      const categoryResult = await pool.query(
        "SELECT id FROM quiz_categories WHERE id = $1",
        [category],
      );
      if (categoryResult.rowCount === 0) {
        return res.status(400).json({ error: "Choose a valid quiz category." });
      }
      result = await pool.query(
        `SELECT s.player_name AS "playerName", s.category_id AS category, s.difficulty,
                s.score, s.total_questions AS "totalQuestions",
                (SELECT COUNT(*)::int
                 FROM quiz_questions q
                 WHERE q.id = ANY(s.question_ids) AND q.is_scored) AS "scoreTotal",
                s.duration_seconds AS "durationSeconds", s.completed_at AS "completedAt"
         FROM quiz_sessions s
         WHERE s.status = 'completed' AND s.category_id = $1
         ORDER BY s.score DESC, s.duration_seconds ASC, s.completed_at DESC
         LIMIT 10`,
        [category],
      );
    }
    res.json({ entries: result.rows });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`QuickQuiz listening on port ${PORT}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
