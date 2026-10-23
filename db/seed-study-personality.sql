INSERT INTO quiz_categories (id, title, description, sort_order)
VALUES (
  'study_personality',
  'What''s Your Study Personality?',
  'A self-reflection quiz to find the study habits that fit you and get practical tips.',
  8
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO quiz_questions
  (category_id, difficulty, prompt, options, correct_index, is_scored, answer_points, explanation)
VALUES
  ('study_personality', 'easy', $q$A project is assigned and it’s due in two weeks. What’s your first move?$q$,
   '["Make a detailed, color-coded plan before doing anything", "Tell myself there’s plenty of time and start later", "Ask friends what they’re doing so we can work together", "Get excited and start researching every interesting angle"]'::jsonb,
   NULL, FALSE, '["P","S","B","E"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$Which study spot sounds best?$q$,
   '["Anywhere, as long as the deadline is close enough to make me focus", "A library, cafe, or video call with other people around", "Somewhere with music, snacks, and my phone nearby", "A tidy desk with everything set up perfectly"]'::jsonb,
   NULL, FALSE, '["S","B","E","P"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$You hit a hard problem. What do you do?$q$,
   '["Ask someone for help or talk it through", "Open another tab or switch to something more interesting", "Redo it again and again until it’s right", "Decide to deal with it later"]'::jsonb,
   NULL, FALSE, '["B","E","P","S"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$When do you do your best work?$q$,
   '["When I’m curious about the topic", "When everything is organized and ready", "When the deadline is close", "When someone is working next to me"]'::jsonb,
   NULL, FALSE, '["E","P","S","B"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$How do you feel about to-do lists and planners?$q$,
   '["I love them, and I rewrite them often", "I start them, then drift off", "I’d stick with one if a friend checked in on me", "I keep deadlines in my head"]'::jsonb,
   NULL, FALSE, '["P","E","B","S"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$What’s your phone like while you study?$q$,
   '["I scroll before I start, then panic and put it away", "Silenced and out of sight, and I’m annoyed if my routine gets interrupted", "Notifications pull me away a lot", "I text friends about the work, which sometimes helps and sometimes doesn’t"]'::jsonb,
   NULL, FALSE, '["S","P","E","B"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$You get a lower grade than you hoped for. What’s your reaction?$q$,
   '["I talk it over with a friend or teacher", "It still worked out okay last time, so I don’t change much", "I’m hard on myself because it wasn’t perfect", "I get curious about why and fall down a side-topic rabbit hole"]'::jsonb,
   NULL, FALSE, '["B","S","P","E"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$Which sounds most like your study sessions?$q$,
   '["Long and intense, right before something is due", "Short and often interrupted", "Long and careful, until it’s “just right”", "As long as someone else is studying too"]'::jsonb,
   NULL, FALSE, '["S","E","P","B"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$What would make studying easier for you?$q$,
   '["Fewer distractions", "People to study with", "Less pressure to be perfect", "A push to get started"]'::jsonb,
   NULL, FALSE, '["E","B","P","S"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$What does the end of a stressful week look like?$q$,
   '["Catching up on everything I put off", "Reorganizing notes and my planner", "Exploring five new interests and getting little done", "Checking in with friends about how everyone’s doing"]'::jsonb,
   NULL, FALSE, '["S","P","E","B"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$In a group project, which role are you?$q$,
   '["The one who makes the schedule and fixes details", "The one who delivers a big last-minute push", "The one who brings energy and bounces ideas around", "The one who comes up with creative ideas but forgets deadlines"]'::jsonb,
   NULL, FALSE, '["P","S","B","E"]'::jsonb, 'Self-reflection response; no right answer.'),
  ('study_personality', 'easy', $q$Which sentence sounds most like you?$q$,
   '["I work best under pressure.", "I’d study more if I could do it with other people.", "If it can’t be done right, why bother?", "Ooh, wait, what about this?"]'::jsonb,
   NULL, FALSE, '["S","B","P","E"]'::jsonb, 'Self-reflection response; no right answer.')
ON CONFLICT (category_id, difficulty, prompt) DO UPDATE SET
  options = EXCLUDED.options,
  correct_index = NULL,
  is_scored = FALSE,
  answer_points = EXCLUDED.answer_points,
  explanation = EXCLUDED.explanation;
