CREATE TABLE IF NOT EXISTS quiz_categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES quiz_categories(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  is_scored BOOLEAN NOT NULL DEFAULT TRUE,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, difficulty, prompt)
);

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS is_scored BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 24),
  category_id TEXT NOT NULL REFERENCES quiz_categories(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_ids INTEGER[] NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quiz_questions_category_difficulty_idx
  ON quiz_questions (category_id, difficulty);
CREATE INDEX IF NOT EXISTS quiz_sessions_leaderboard_idx
  ON quiz_sessions (category_id, status, score DESC, duration_seconds ASC, completed_at DESC);
