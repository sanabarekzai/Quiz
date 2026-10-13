INSERT INTO quiz_categories (id, title, description, sort_order) VALUES
  ('club_carnival', 'Club Carnival', 'Join the fun! Club Carnival is on October 16 at lunch. Help us make it amazing!', 0)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('club_carnival', 'easy', 'Will you be participating and helping our club in Club Carnival?', '["Yes, I want to help!", "No, I cannot help", "Maybe later", "I will think about it"]'::jsonb, 0, 'Great! We need enthusiastic helpers to make Club Carnival a success!'),
  ('club_carnival', 'easy', 'What do you want to help us with?', '["Putting food in plates", "Money handling (must be good at math)", "Asking people for what they want (communicator and leader)", "Going around and getting friends to come buy"]'::jsonb, 0, 'Every role is important! Let us know your preference.'),
  ('club_carnival', 'easy', 'Do you want to bring something for our club to sell?', '["Yes, I have something in mind!", "No, I will not bring anything", "Maybe, let me think", "I will ask my friends"]'::jsonb, 0, 'Awesome! Homemade treats and unique items are always welcome!'),
  ('club_carnival', 'easy', 'What date is Club Carnival?', '["October 15", "October 16 at lunch", "October 17", "October 18"]'::jsonb, 1, 'Mark your calendar! Club Carnival is on October 16 at lunch. See you there!'),
  ('club_carnival', 'easy', 'How do you like the club so far?', '["Meh", "I don''t like it", "I love this club", "It''s my favorite!"]'::jsonb, 0, 'Thanks for sharing your thoughts about the club.')
ON CONFLICT (category_id, difficulty, prompt) DO NOTHING;

UPDATE quiz_questions
SET is_scored = FALSE
WHERE category_id = 'club_carnival';
