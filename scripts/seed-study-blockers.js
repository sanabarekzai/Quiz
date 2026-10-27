const { Pool } = require("pg");
const data = require("../data/study-blockers.json");

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO quiz_categories (id, title, description, sort_order)
       VALUES ('study_blockers', 'Study Blocker Check-In', 'Find the study habits getting in your way and get practical, supportive tips.', 9)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, sort_order=EXCLUDED.sort_order`,
    );
    for (const question of data.questions) {
      await client.query(
        `INSERT INTO quiz_questions (category_id,difficulty,prompt,options,correct_index,is_scored,answer_points,explanation)
         VALUES ('study_blockers','easy',$1,$2::jsonb,NULL,FALSE,$3::jsonb,'Self-reflection response; no right answer.')
         ON CONFLICT (category_id,difficulty,prompt) DO UPDATE SET options=EXCLUDED.options,correct_index=NULL,is_scored=FALSE,answer_points=EXCLUDED.answer_points,explanation=EXCLUDED.explanation`,
        [question.prompt, JSON.stringify(question.options), JSON.stringify(question.points)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Failed to seed Study Blocker Check-In:", error.message);
  process.exitCode = 1;
});
