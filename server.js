const express = require("express");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");
const toolMatcherData = require("./data/tool-matcher.json");
const { publicQuestions: getPublicMatcherQuestions, validateAnswers: validateMatcherAnswers, calculateResults: calculateMatcherResults } = require("./lib/tool-matcher");
const studyBlockerData = require("./data/study-blockers.json");
const { calculateStudyBlockerResult } = require("./lib/study-blocker");
const { createUserHistoryHandler } = require("./lib/user-history");
const { saveCompletedSessionAttempt } = require("./lib/session-attempts");
const { saveQuizAttempt } = require("./lib/quiz-attempts");

const PORT = Number(process.env.PORT || 5000);
const QUESTIONS_PER_GAME = 5;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const UNAVAILABLE_QUIZ_IDS = new Set(["mixed", "science", "geography", "history"]);
const STUDY_PERSONALITY_PROFILE_ORDER = ["S", "P", "B", "E"];
const STUDY_PERSONALITY_PROFILE_NAMES = {
  S: "Sprinter",
  P: "Perfectionist Planner",
  B: "Study Buddy",
  E: "Explorer",
};
const STUDY_PERSONALITY_BLEND_MESSAGES = {
  SP: "You delay, then want it perfect. Start early with a rough version so you have time to improve it.",
  SB: "You work better with other people around when the deadline is near. Schedule a study session before the deadline.",
  SE: "You wait for pressure and get pulled in many directions. Short timers and mini-deadlines help most.",
  PB: "You do your best work with structure and people. Share your plan with a study partner.",
  PE: "You jump between organizing and exploring. Pick one project and limit the planning time.",
  BE: "You’re energized by people and ideas. Give study sessions a goal so they don’t turn into social time.",
};
const SALT_ROUNDS = 12;
const SESSION_SECRET = process.env.SESSION_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Connect the Replit PostgreSQL database before starting the app.");
}
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required so sign-in sessions survive server restarts.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
const PgSessionStore = connectPgSimple(session);
const sessionStore = new PgSessionStore({
  pool,
  tableName: "user_sessions",
  createTableIfMissing: false,
});

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  },
}));

function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.userId = userId;
      req.session.save((saveError) => {
        if (saveError) return reject(saveError);
        resolve();
      });
    });
  });
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
}

function publicQuestion(row) {
  const question = {
    id: row.id,
    category: row.category_id,
    difficulty: row.difficulty,
    prompt: row.prompt,
    options: row.options,
    isScored: row.category_id === "club_carnival" ? false : row.is_scored,
  };
  if (row.category_id !== "study_personality") {
    question.correctIndex = row.correct_index;
  }
  return question;
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

// Helper function to get user by ID
async function getUserById(userId) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  return result.rows[0];
}

// Helper function to get user by username
async function getUserByUsername(username) {
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0];
}

// Helper function to get user by Google ID
async function getUserByGoogleId(googleId) {
  const result = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
  return result.rows[0];
}

// Helper function to create a new user
async function createUser({ username, password, firstName, lastName, displayName, googleId, role = "player" }) {
  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, display_name, google_id, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [username, passwordHash, firstName, lastName, displayName, googleId, role]
  );
  return result.rows[0];
}

// Register a new user (email/password)
app.post("/api/register", async (req, res, next) => {
  const { username, password, firstName, lastName, displayName } = req.body || {};
  
  if (!username || !password || !firstName || !lastName) {
    return res.status(400).json({ 
      error: "Username, password, first name, and last name are required." 
    });
  }
  
  try {
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists." });
    }
    
    const user = await createUser({
      username,
      password,
      firstName,
      lastName,
      displayName: displayName || `${firstName} ${lastName}`,
    });
    
    await establishSession(req, user.id);
    
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "An account with that username already exists. Please log in instead." });
    }
    next(error);
  }
});

// Login (email/password)
app.post("/api/login", async (req, res, next) => {
  const { username, password } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    
    if (!user.password_hash) {
      return res.status(400).json({ 
        error: "This account uses Google Sign-In. Please use the Google option." 
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    
    await establishSession(req, user.id);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth callback
app.post("/api/auth/google", async (req, res, next) => {
  const { token } = req.body || {};
  
  if (!token || !googleClient) {
    return res.status(400).json({ 
      error: "Google authentication is not configured or token is missing." 
    });
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const displayName = payload.name || `${firstName} ${lastName}`;
    
    let user = await getUserByGoogleId(googleId);
    
    if (!user) {
      const username = email.split("@")[0] || `google_${googleId.substring(0, 8)}`;
      user = await createUser({
        username,
        firstName: firstName || username,
        lastName: lastName || "User",
        displayName,
        googleId,
      });
    }
    
    await establishSession(req, user.id);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Google authentication failed." });
  }
});

// Get current user
app.get("/api/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/records", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `WITH ranked_attempts AS (
         SELECT a.id, a.user_id, a.category_id, c.title, a.score, a.total_questions,
                a.percentage, a.result, a.completed_at,
                COUNT(*) OVER (PARTITION BY a.category_id)::int AS attempt_count,
                ROW_NUMBER() OVER (
                  PARTITION BY a.category_id
                  ORDER BY a.completed_at DESC, a.id DESC
                ) AS attempt_rank
         FROM quiz_attempts a
         JOIN quiz_categories c ON c.id = a.category_id
         WHERE a.user_id = $1
       )
        SELECT id, category_id AS "categoryId", title, score,
              total_questions AS "totalQuestions", percentage, result,
               completed_at AS "completedAt", attempt_count AS "attemptCount",
               CASE WHEN category_id = 'study_personality' THEN (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'completedAt', history.completed_at,
                     'profileSummary', history.result->>'profileSummary',
                     'primaryProfiles', history.result->'primaryProfiles'
                   )
                   ORDER BY history.completed_at DESC, history.id DESC
                 )
                 FROM (
                   SELECT h.id, h.completed_at, h.result
                   FROM quiz_attempts h
                   WHERE h.user_id = ranked_attempts.user_id
                     AND h.category_id = ranked_attempts.category_id
                   ORDER BY h.completed_at DESC, h.id DESC
                   LIMIT 5
                 ) history
               ) ELSE '[]'::jsonb END AS "profileHistory"
       FROM ranked_attempts
       WHERE attempt_rank = 1
       ORDER BY "completedAt" DESC`,
      [req.session.userId],
    );
    res.json({ records: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/history", requireAuth, createUserHistoryHandler(pool));

app.get("/api/matcher/questions", requireAuth, (req, res) => {
  res.json({ questions: getPublicMatcherQuestions(toolMatcherData) });
});

app.post("/api/matcher/submit", requireAuth, async (req, res, next) => {
  const { answers } = req.body || {};
  if (!validateMatcherAnswers(answers, toolMatcherData)) {
    return res.status(400).json({ error: "Answer all 12 questions using one of the listed choices." });
  }
  try {
    const result = calculateMatcherResults(answers, toolMatcherData);
    const saved = await pool.query(
      `INSERT INTO matcher_results (user_id, ranking, group_scores, answers)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
       RETURNING id, created_at AS "createdAt"`,
      [req.session.userId, JSON.stringify(result.ranking), JSON.stringify(result.groupScores), JSON.stringify(answers)],
    );
    res.status(201).json({ ...result, id: saved.rows[0].id, createdAt: saved.rows[0].createdAt });
  } catch (error) {
    next(error);
  }
});

app.get("/api/matcher/results", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, ranking, group_scores AS "groupScores", answers, created_at AS "createdAt"
       FROM matcher_results
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.session.userId],
    );
    res.json({ results: result.rows });
  } catch (error) {
    next(error);
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/quizzes", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.description,
        CASE WHEN c.id = 'mixed' THEN (
          SELECT LEAST(COUNT(*), ${QUESTIONS_PER_GAME})::int
          FROM quiz_questions
          WHERE category_id NOT IN ('mixed', 'club_carnival', 'student_wellness', 'study_skills')
        ) ELSE COUNT(q.id)::int END AS "questionCount"
      FROM quiz_categories c
      LEFT JOIN quiz_questions q ON c.id = q.category_id
       WHERE c.id <> ALL($1::text[])
      GROUP BY c.id, c.title, c.description, c.sort_order
      ORDER BY c.sort_order, c.title
    `, [Array.from(UNAVAILABLE_QUIZ_IDS)]);
    res.json({ quizzes: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes/:id", async (req, res, next) => {
  const { id } = req.params;
  if (UNAVAILABLE_QUIZ_IDS.has(id)) {
    return res.status(404).json({ error: "Quiz not found." });
  }
  try {
    const categoryResult = await pool.query(
      "SELECT id, title, description FROM quiz_categories WHERE id = $1",
      [id]
    );
    if (categoryResult.rowCount === 0) {
      return res.status(404).json({ error: "Quiz not found." });
    }

    const questionsResult = id === "mixed"
      ? await pool.query(
        `SELECT id, category_id, difficulty, prompt, options, is_scored
         FROM quiz_questions
         WHERE category_id NOT IN ('mixed', 'club_carnival', 'student_wellness', 'study_skills')
         ORDER BY random()
         LIMIT $1`,
        [QUESTIONS_PER_GAME],
      )
      : await pool.query(
        `SELECT id, category_id, difficulty, prompt, options, is_scored
         FROM quiz_questions
         WHERE category_id = $1
         ORDER BY random()`,
        [id],
      );

    const questions = questionsResult.rows.map((row) => publicQuestion(row));
    res.json({
      quiz: categoryResult.rows[0],
      questions,
      totalQuestions: questions.length,
    });
  } catch (error) {
    next(error);
  }
});

function getWellnessFeedback(totalScore) {
  if (totalScore >= 0 && totalScore <= 8) {
    return {
      tier: "Healthy",
      feedback: "Generally doing well, with good coping skills and support.",
      recommendation: "Keep up the great work! Maintain your healthy habits."
    };
  } else if (totalScore >= 9 && totalScore <= 17) {
    return {
      tier: "Mild concern",
      feedback: "Some stress or struggles.",
      recommendation: "Healthy habits and talking with someone can help."
    };
  } else if (totalScore >= 18 && totalScore <= 26) {
    return {
      tier: "Moderate concern",
      feedback: "Noticeable difficulty.",
      recommendation: "Reaching out to a counselor or trusted adult is recommended."
    };
  } else {
    return {
      tier: "High concern",
      feedback: "Significant distress.",
      recommendation: "Follow-up with a counselor or mental health professional is strongly recommended."
    };
  }
}

function getStudySkillsFeedback(totalScore) {
  const maxScore = 30;
  if (totalScore >= 26) {
    return {
      level: 5,
      tier: "Study Master",
      emoji: "🏆",
      feedback: "You've built strong habits, know how you learn best, and bounce back from setbacks. Your biggest risk now is burnout, not procrastination.",
      tips: [
        "Schedule rest. Free time and hobbies are part of the plan, not a reward for finishing it.",
        "Keep improving. Experiment with new methods and keep what works.",
        "Help others. Mentoring a classmate strengthens your own understanding.",
        "Set bigger goals. Think about long-term plans like college, scholarships, or skills you want to learn.",
        "Watch for perfectionism. 'Done and good' often beats 'perfect and late.'"
      ],
      nextQuest: "Set a goal beyond grades, such as learning a new skill or leading a study group."
    };
  } else if (totalScore >= 20) {
    return {
      level: 4,
      tier: "Focus Builder",
      emoji: "🎯",
      feedback: "You're organized and consistent. Now it's about studying smarter and protecting your energy.",
      tips: [
        "Try the Feynman technique. Explain a topic out loud as if teaching a younger student. Wherever you stumble is what to study next.",
        "Make your own practice tests. Write questions, then swap with a friend.",
        "Use deep-work blocks. Do 45 to 60 minutes with zero notifications for your hardest subject.",
        "Guard your sleep. Good rest improves memory more than another late-night hour.",
        "Study with others. Join or start a study group where everyone explains topics to each other."
      ],
      nextQuest: "Teach a classmate a concept you just learned."
    };
  } else if (totalScore >= 14) {
    return {
      level: 3,
      tier: "Rising Planner",
      emoji: "🌱",
      feedback: "You have a foundation and some good habits. Your results are decent, but you slip when life gets busy. You're closer to the next level than you think.",
      tips: [
        "Time-block your week. Put study sessions in your calendar like they're appointments.",
        "Plan your top 3 each day. Pick the three tasks that matter most, and do the hardest first.",
        "Use spaced practice. Review material after 1 day, 3 days, and 7 days instead of cramming.",
        "Fix your weak spots. List the topics you avoid, then give those the first slot in your session.",
        "Do a weekly 10-minute review. Ask what worked, what didn't, and what you'll change."
      ],
      nextQuest: "Follow your schedule for 2 full weeks, including a busy one."
    };
  } else if (totalScore >= 8) {
    return {
      level: 2,
      tier: "Last-Minute Legend",
      emoji: "⏰",
      feedback: "You can get things done under pressure, but it's stressful and your work isn't your best. You know how to perform, and now you need to learn how to prepare.",
      tips: [
        "Back-plan your deadlines. If a project is due on the 20th, set mini-deadlines on the 12th, 15th, and 18th.",
        "Use the 'two-day rule.' Never skip a study session two days in a row.",
        "Try Pomodoro. Work 25 minutes, break 5 minutes, and repeat. A timer makes a big task feel small.",
        "Swap rereading for self-testing. Close the book and try to recall what you just read.",
        "Reward yourself. Plan something fun after finishing, not before."
      ],
      nextQuest: "Start one assignment at least 3 days early."
    };
  } else {
    return {
      level: 1,
      tier: "Snooze Button Survivor",
      emoji: "🛏️",
      feedback: "School feels overwhelming right now, and avoiding it feels easier than starting. That's common, and it's fixable. Habits are learned, not something you're born with.",
      tips: [
        "Use the 5-minute rule. Promise yourself you'll work for just 5 minutes. Starting is the hardest part, and you'll often keep going.",
        "Pick one tiny habit. Don't overhaul your life. Choose one thing, like writing down your homework every day.",
        "Remove temptations. Put your phone in another room before you study.",
        "Make a 'start ritual.' Same spot, same snack or music, same first action every time.",
        "Talk to someone. A teacher, counselor, or parent can help, and asking is a sign of strength."
      ],
      nextQuest: "Use a planner for 7 days in a row."
    };
  }
}

app.post("/api/quizzes/:id/submit", requireAuth, async (req, res, next) => {
  const { id } = req.params;
  const { answers, questionIds } = req.body || {};
  if (UNAVAILABLE_QUIZ_IDS.has(id)) {
    return res.status(404).json({ error: "Quiz not found." });
  }

  if (!Array.isArray(answers) || !Array.isArray(questionIds) ||
      answers.length !== questionIds.length ||
      !answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer < 4) ||
      !questionIds.every((questionId) => Number.isSafeInteger(questionId) && questionId > 0)) {
    return res.status(400).json({ error: "Answers and question IDs must be matching arrays." });
  }
  if (id === "study_blockers" && answers.length !== studyBlockerData.questions.length) {
    return res.status(400).json({ error: "Answer all 12 study blocker questions before submitting." });
  }

  try {
    const questionsResult = id === "mixed"
      ? await pool.query(
          `SELECT id, correct_index, is_scored, category_id, answer_points
         FROM quiz_questions
         WHERE id = ANY($1::int[])
           AND category_id NOT IN ('mixed', 'club_carnival', 'student_wellness', 'study_skills')
         ORDER BY array_position($1::int[], id)`,
        [questionIds],
      )
      : await pool.query(
          `SELECT id, correct_index, is_scored, category_id, answer_points
         FROM quiz_questions
         WHERE id = ANY($1::int[]) AND category_id = $2
         ORDER BY array_position($1::int[], id)`,
        [questionIds, id],
      );

    if (questionsResult.rowCount !== questionIds.length) {
      return res.status(400).json({ error: "The selected questions do not match this quiz." });
    }

    if (questionsResult.rowCount === 0) {
      return res.status(404).json({ error: "Quiz not found or has no questions." });
    }

    const questions = questionsResult.rows;
    const categoryId = questions[0].category_id;
    let score = 0;
    const results = [];

    if (categoryId === "club_carnival") {
      for (let i = 0; i < questions.length; i++) {
        results.push({
          questionId: questions[i].id,
          selectedIndex: answers[i],
          isCorrect: null,
          isScored: false,
        });
      }
      const response = {
        score: null,
        totalQuestions: questions.length,
        percentage: null,
        results,
        feedback: "Thanks for sharing your thoughts about the club.",
      };
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, response);
      return res.json(response);
    } else if (categoryId === "study_personality") {
      const profileCounts = { S: 0, P: 0, B: 0, E: 0 };
      for (let i = 0; i < questions.length; i++) {
        const profileId = questions[i].answer_points?.[answers[i]];
        if (!Object.hasOwn(profileCounts, profileId)) {
          return res.status(500).json({ error: "Study personality scoring is not configured correctly." });
        }
        profileCounts[profileId]++;
        results.push({
          questionId: questions[i].id,
          selectedIndex: answers[i],
          isCorrect: null,
          isScored: false,
        });
      }

      const rankedProfiles = STUDY_PERSONALITY_PROFILE_ORDER
        .map((profileId) => ({
          id: profileId,
          name: STUDY_PERSONALITY_PROFILE_NAMES[profileId],
          count: profileCounts[profileId],
          percentage: Math.round((profileCounts[profileId] / questions.length) * 100),
        }))
        .sort((a, b) => b.count - a.count ||
          STUDY_PERSONALITY_PROFILE_ORDER.indexOf(a.id) - STUDY_PERSONALITY_PROFILE_ORDER.indexOf(b.id));
      const highestCount = rankedProfiles[0].count;
      const tiedForFirst = rankedProfiles.filter((profile) => profile.count === highestCount);
      const primaryProfiles = tiedForFirst.length > 1
        ? tiedForFirst.map((profile) => profile.id)
        : [rankedProfiles[0].id];
      if (tiedForFirst.length === 1 && highestCount - rankedProfiles[1].count <= 2) {
        primaryProfiles.push(rankedProfiles[1].id);
      }

      const isTie = tiedForFirst.length > 1;
      const blendKey = primaryProfiles.length === 2
        ? STUDY_PERSONALITY_PROFILE_ORDER
          .filter((profileId) => primaryProfiles.includes(profileId))
          .join("")
        : null;
      const profileSummary = isTie
        ? `A balanced mix of ${primaryProfiles.map((profileId) => STUDY_PERSONALITY_PROFILE_NAMES[profileId]).join(" and ")}`
        : primaryProfiles.length === 2
          ? `${STUDY_PERSONALITY_PROFILE_NAMES[primaryProfiles[0]]} with ${STUDY_PERSONALITY_PROFILE_NAMES[primaryProfiles[1]]} tendencies`
          : STUDY_PERSONALITY_PROFILE_NAMES[primaryProfiles[0]];
      const response = {
        score: null,
        totalQuestions: questions.length,
        percentage: null,
        results,
        profiles: rankedProfiles,
        primaryProfiles,
        isTie,
        profileSummary,
        feedback: profileSummary,
        blendMessage: !isTie && blendKey ? STUDY_PERSONALITY_BLEND_MESSAGES[blendKey] : null,
      };
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, response);
      return res.json(response);
    } else if (categoryId === "study_blockers") {
      let blockerResponse;
      try {
        blockerResponse = calculateStudyBlockerResult(questions, answers, studyBlockerData);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, blockerResponse);
      return res.json(blockerResponse);
    } else if (categoryId === 'student_wellness') {
      for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
        const question = questions[i];
        const answer = answers[i];
        const points = answer !== null && answer !== undefined ? answer : 0;
        score += points;
        results.push({
          questionId: question.id,
          selectedIndex: answer,
          correctIndex: question.correct_index,
          isCorrect: false,
          isScored: true,
          points: points
        });
      }
      const feedback = getWellnessFeedback(score);
      const response = {
        score,
        totalQuestions: questions.length,
        percentage: null,
        results,
        tier: feedback.tier,
        feedback: feedback.feedback,
        recommendation: feedback.recommendation,
        maxScore: 36
      };
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, response);
      res.json(response);
    } else if (categoryId === 'study_skills') {
      const pointMap = { 0: 3, 1: 2, 2: 1, 3: 0 };
      for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
        const question = questions[i];
        const answer = answers[i];
        const points = answer !== null && answer !== undefined ? pointMap[answer] || 0 : 0;
        score += points;
        results.push({
          questionId: question.id,
          selectedIndex: answer,
          correctIndex: question.correct_index,
          isCorrect: false,
          isScored: true,
          points: points
        });
      }
      const feedback = getStudySkillsFeedback(score);
      const response = {
        score,
        totalQuestions: questions.length,
        percentage: null,
        results,
        level: feedback.level,
        tier: feedback.tier,
        emoji: feedback.emoji,
        feedback: feedback.feedback,
        tips: feedback.tips,
        nextQuest: feedback.nextQuest,
        maxScore: 30
      };
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, response);
      res.json(response);
    } else {
      for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
        const question = questions[i];
        const answer = answers[i];
        const isCorrect = answer !== null && answer !== undefined && answer === question.correct_index;
        const isScored = question.is_scored;

        if (isScored && isCorrect) {
          score++;
        }

        results.push({
          questionId: question.id,
          selectedIndex: answer,
          correctIndex: question.correct_index,
          isCorrect,
          isScored,
        });
      }

      const percentage = Math.round((score / questions.length) * 100);

      const response = {
        score,
        totalQuestions: questions.length,
        percentage,
        results,
      };
      await saveQuizAttempt(pool, req.session.userId, id, questionIds, answers, response);
      res.json(response);
    }
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
  if (UNAVAILABLE_QUIZ_IDS.has(category)) {
    return res.status(400).json({ error: "That quiz category is not available." });
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
        (id, user_id, player_name, category_id, difficulty, question_ids, total_questions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, req.session?.userId || null, playerName, category, difficulty, questionIds, QUESTIONS_PER_GAME],
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
       `SELECT id, user_id, category_id, question_ids, current_index, score, total_questions, status, started_at
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
      "SELECT category_id, correct_index, is_scored, explanation FROM quiz_questions WHERE id = $1",
      [questionId],
    );
    if (questionResult.rowCount === 0) {
      throw new Error("A quiz session references a missing question.");
    }
    const question = questionResult.rows[0];
    const isSurvey = session.category_id === "club_carnival";
    const isScored = !isSurvey && question.is_scored;
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
           score = CASE WHEN $5 THEN 0 ELSE score + $2 END,
           answers = answers || $3::jsonb,
           status = $4,
           duration_seconds = CASE
             WHEN $4 = 'completed'
             THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int)
             ELSE duration_seconds
           END,
           completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END
       WHERE id = $1
        RETURNING score, current_index, total_questions, duration_seconds, answers`,
      [sessionId, pointsAwarded, answer, completed ? "completed" : "in_progress", isSurvey],
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
       WHERE id = ANY($1::int[]) AND is_scored = TRUE
         AND category_id <> 'club_carnival'`,
      [session.question_ids],
    );

    await saveCompletedSessionAttempt(
      client,
      session,
      updated,
      scoreTotalResult.rows[0].score_total,
      completed,
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
           AND s.category_id <> 'club_carnival'
           AND s.category_id <> ALL($1::text[])
        ORDER BY s.score DESC, s.duration_seconds ASC, s.completed_at DESC
        LIMIT 10
       `, [Array.from(UNAVAILABLE_QUIZ_IDS)]);
    } else {
      if (typeof category !== "string") {
        return res.status(400).json({ error: "Choose a valid quiz category." });
      }
      if (UNAVAILABLE_QUIZ_IDS.has(category)) {
        return res.status(400).json({ error: "That quiz category is not available." });
      }
      const categoryResult = await pool.query(
        "SELECT id FROM quiz_categories WHERE id = $1",
        [category],
      );
      if (categoryResult.rowCount === 0) {
        return res.status(400).json({ error: "Choose a valid quiz category." });
      }
      if (category === "club_carnival") {
        return res.json({ entries: [] });
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
