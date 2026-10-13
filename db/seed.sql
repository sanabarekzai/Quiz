-- Quiz Categories
INSERT INTO quiz_categories (id, title, description, sort_order) VALUES
  ('general_knowledge', 'General Knowledge', 'A mix of trivia across various topics.', 0),
  ('mathematics', 'Mathematics', 'Math problems and concepts.', 1),
  ('literature', 'Literature', 'Questions about books, authors, and literary works.', 2),
  ('sports', 'Sports', 'Questions about various sports and athletes.', 3),
  ('technology', 'Technology', 'Questions about computers, software, and tech innovations.', 4),
  ('club_carnival', 'Club Carnival', 'Join the fun! Club Carnival is on October 16 at lunch. Help us make it amazing!', 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- General Knowledge Questions (10)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('general_knowledge', 'easy', 'What is the capital of France?', '["London", "Berlin", "Paris", "Madrid"]'::jsonb, 2, 'Paris is the capital city of France.'),
  ('general_knowledge', 'easy', 'Which planet is known as the Red Planet?', '["Venus", "Mars", "Jupiter", "Saturn"]'::jsonb, 1, 'Mars is called the Red Planet due to its reddish appearance.'),
  ('general_knowledge', 'easy', 'What is the largest mammal on Earth?', '["Elephant", "Blue Whale", "Giraffe", "Polar Bear"]'::jsonb, 1, 'The Blue Whale is the largest mammal on Earth.'),
  ('general_knowledge', 'easy', 'In which year did World War II end?', '["1944", "1945", "1946", "1947"]'::jsonb, 1, 'World War II ended in 1945.'),
  ('general_knowledge', 'easy', 'What is the chemical symbol for gold?', '["Go", "Gd", "Au", "Ag"]'::jsonb, 2, 'The chemical symbol for gold is Au, from the Latin aurum.'),
  ('general_knowledge', 'medium', 'Who painted the Mona Lisa?', '["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"]'::jsonb, 2, 'Leonardo da Vinci painted the Mona Lisa.'),
  ('general_knowledge', 'medium', 'What is the tallest mountain in the world?', '["K2", "Kangchenjunga", "Mount Everest", "Lhotse"]'::jsonb, 2, 'Mount Everest is the tallest mountain in the world.'),
  ('general_knowledge', 'medium', 'Which country is known as the Land of the Rising Sun?', '["China", "Japan", "Thailand", "Vietnam"]'::jsonb, 1, 'Japan is known as the Land of the Rising Sun.'),
  ('general_knowledge', 'medium', 'What is the largest planet in our solar system?', '["Saturn", "Jupiter", "Neptune", "Uranus"]'::jsonb, 1, 'Jupiter is the largest planet in our solar system.'),
  ('general_knowledge', 'medium', 'Who wrote Romeo and Juliet?', '["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"]'::jsonb, 1, 'William Shakespeare wrote Romeo and Juliet.'),
  ('general_knowledge', 'hard', 'What is the capital of Australia?', '["Sydney", "Melbourne", "Canberra", "Brisbane"]'::jsonb, 2, 'Canberra is the capital of Australia.'),
  ('general_knowledge', 'hard', 'Which element has the chemical symbol K?', '["Potassium", "Krypton", "Kobalt", "Kelvinium"]'::jsonb, 0, 'The chemical symbol K stands for Potassium (from Latin kalium).');

-- Mathematics Questions (10)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('mathematics', 'easy', 'What is 2 + 2?', '["3", "4", "5", "6"]'::jsonb, 1, '2 + 2 equals 4.'),
  ('mathematics', 'easy', 'What is the square root of 64?', '["6", "7", "8", "9"]'::jsonb, 2, 'The square root of 64 is 8.'),
  ('mathematics', 'easy', 'What is 10 divided by 2?', '["4", "5", "6", "7"]'::jsonb, 1, '10 divided by 2 equals 5.'),
  ('mathematics', 'easy', 'What is 7 times 8?', '["48", "56", "64", "72"]'::jsonb, 1, '7 times 8 equals 56.'),
  ('mathematics', 'easy', 'What is the value of pi (π) rounded to two decimal places?', '["3.12", "3.14", "3.16", "3.18"]'::jsonb, 1, 'Pi is approximately 3.14159, rounded to 3.14.'),
  ('mathematics', 'medium', 'What is the area of a circle with radius 5?', '["25π", "50π", "75π", "100π"]'::jsonb, 0, 'Area = πr² = π(5)² = 25π.'),
  ('mathematics', 'medium', 'What is the Pythagorean theorem?', '["a² + b² = c²", "a + b = c", "a² - b² = c²", "a + b² = c"]'::jsonb, 0, 'The Pythagorean theorem states a² + b² = c².'),
  ('mathematics', 'medium', 'What is 15% of 200?', '["20", "25", "30", "35"]'::jsonb, 2, '15% of 200 is 0.15 × 200 = 30.'),
  ('mathematics', 'medium', 'What is the sum of the interior angles of a triangle?', '["90 degrees", "180 degrees", "270 degrees", "360 degrees"]'::jsonb, 1, 'The sum of the interior angles of a triangle is 180 degrees.'),
  ('mathematics', 'medium', 'What is 3 squared?', '["6", "9", "12", "15"]'::jsonb, 1, '3 squared is 9.'),
  ('mathematics', 'hard', 'What is the derivative of x²?', '["x", "2x", "x²", "2"]'::jsonb, 1, 'The derivative of x² is 2x.'),
  ('mathematics', 'hard', 'What is the integral of 1/x?', '["ln|x| + C", "x + C", "1 + C", "0 + C"]'::jsonb, 0, 'The integral of 1/x is the natural logarithm of the absolute value of x plus C.');

-- Literature Questions (10)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('literature', 'easy', 'Who wrote Hamlet?', '["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"]'::jsonb, 1, 'William Shakespeare wrote Hamlet.'),
  ('literature', 'easy', 'What is the name of the boy who never grows up in J.M. Barrie''s play?', '["Peter Pan", "Wendy", "Captain Hook", "Tinker Bell"]'::jsonb, 0, 'Peter Pan is the boy who never grows up.'),
  ('literature', 'easy', 'Which book begins with the line "Call me Ishmael"?', '["Moby Dick", "The Great Gatsby", "Pride and Prejudice", "To Kill a Mockingbird"]'::jsonb, 0, 'Moby Dick begins with "Call me Ishmael".'),
  ('literature', 'easy', 'Who is the author of the Harry Potter series?', '["J.R.R. Tolkien", "J.K. Rowling", "C.S. Lewis", "George R.R. Martin"]'::jsonb, 1, 'J.K. Rowling is the author of the Harry Potter series.'),
  ('literature', 'easy', 'In which book would you find the characters Samwise Gamgee and Frodo Baggins?', '["The Hobbit", "The Lord of the Rings", "A Game of Thrones", "The Chronicles of Narnia"]'::jsonb, 1, 'Samwise Gamgee and Frodo Baggins are characters in The Lord of the Rings.'),
  ('literature', 'medium', 'Who wrote "To Kill a Mockingbird"?', '["Harper Lee", "Ernest Hemingway", "F. Scott Fitzgerald", "John Steinbeck"]'::jsonb, 0, 'Harper Lee wrote "To Kill a Mockingbird".'),
  ('literature', 'medium', 'Which Shakespeare play features the characters Romeo and Juliet?', '["Macbeth", "Hamlet", "Romeo and Juliet", "Othello"]'::jsonb, 2, 'Romeo and Juliet are the main characters in the play Romeo and Juliet.'),
  ('literature', 'medium', 'What is the name of the whale in Moby Dick?', '["Ahab", "Ishmael", "Moby Dick", "Queequeg"]'::jsonb, 2, 'The whale in Moby Dick is named Moby Dick.'),
  ('literature', 'medium', 'Who wrote "Pride and Prejudice"?', '["Charlotte Brontë", "Emily Brontë", "Jane Austen", "Louisa May Alcott"]'::jsonb, 2, 'Jane Austen wrote "Pride and Prejudice".'),
  ('literature', 'medium', 'Which book features the line "It was the best of times, it was the worst of times"?', '["A Tale of Two Cities", "Great Expectations", "Oliver Twist", "David Copperfield"]'::jsonb, 0, '"It was the best of times, it was the worst of times" is the opening line of A Tale of Two Cities.'),
  ('literature', 'hard', 'Who wrote "The Divine Comedy"?', '["Dante Alighieri", "Geoffrey Chaucer", "Giovanni Boccaccio", "Petrarch"]'::jsonb, 0, 'Dante Alighieri wrote "The Divine Comedy".'),
  ('literature', 'hard', 'Which author created the fictional detective Sherlock Holmes?', '["Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe", "Wilkie Collins"]'::jsonb, 1, 'Arthur Conan Doyle created Sherlock Holmes.');

-- Sports Questions (10)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('sports', 'easy', 'Which sport uses a net, a racket, and a shuttlecock?', '["Tennis", "Badminton", "Table Tennis", "Squash"]'::jsonb, 1, 'Badminton uses a net, a racket, and a shuttlecock.'),
  ('sports', 'easy', 'In which sport would you perform a slam dunk?', '["Football", "Basketball", "Volleyball", "Handball"]'::jsonb, 1, 'A slam dunk is performed in Basketball.'),
  ('sports', 'easy', 'Which country won the 2018 FIFA World Cup?', '["Germany", "Brazil", "Argentina", "France"]'::jsonb, 3, 'France won the 2018 FIFA World Cup.'),
  ('sports', 'easy', 'How many players are on a standard soccer team?', '["9", "10", "11", "12"]'::jsonb, 2, 'A standard soccer team has 11 players.'),
  ('sports', 'easy', 'Which sport is known as the "sport of kings"?', '["Polo", "Horse Racing", "Golf", "Cricket"]'::jsonb, 0, 'Polo is known as the "sport of kings".'),
  ('sports', 'medium', 'Who is the all-time leading scorer in NBA history?', '["Michael Jordan", "Kareem Abdul-Jabbar", "LeBron James", "Kobe Bryant"]'::jsonb, 2, 'LeBron James is the all-time leading scorer in NBA history.'),
  ('sports', 'medium', 'Which tennis player has won the most Grand Slam singles titles?', '["Roger Federer", "Rafael Nadal", "Novak Djokovic", "Serena Williams"]'::jsonb, 2, 'Novak Djokovic has won the most Grand Slam singles titles (as of 2024).'),
  ('sports', 'medium', 'In which year were the first modern Olympic Games held?', '["1892", "1896", "1900", "1904"]'::jsonb, 1, 'The first modern Olympic Games were held in 1896.'),
  ('sports', 'medium', 'Which country invented the sport of basketball?', '["Canada", "United States", "United Kingdom", "Australia"]'::jsonb, 1, 'Basketball was invented in the United States.'),
  ('sports', 'medium', 'What is the diameter of a basketball hoop in inches?', '["16", "18", "20", "22"]'::jsonb, 1, 'A basketball hoop has a diameter of 18 inches.'),
  ('sports', 'hard', 'Which boxer was known as "The Greatest"?', '["Joe Louis", "Sugar Ray Robinson", "Muhammad Ali", "Mike Tyson"]'::jsonb, 2, 'Muhammad Ali was known as "The Greatest".'),
  ('sports', 'hard', 'Which country has won the most Rugby World Cup titles?', '["New Zealand", "South Africa", "Australia", "England"]'::jsonb, 1, 'South Africa has won the most Rugby World Cup titles.');

-- Technology Questions (10)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('technology', 'easy', 'Who is the co-founder of Microsoft?', '["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Elon Musk"]'::jsonb, 1, 'Bill Gates is the co-founder of Microsoft.'),
  ('technology', 'easy', 'What does CPU stand for?', '["Central Processing Unit", "Computer Personal Unit", "Central Program Unit", "Control Processing Unit"]'::jsonb, 0, 'CPU stands for Central Processing Unit.'),
  ('technology', 'easy', 'Which company developed the iPhone?', '["Samsung", "Google", "Apple", "Microsoft"]'::jsonb, 2, 'Apple developed the iPhone.'),
  ('technology', 'easy', 'What does HTML stand for?', '["Hyper Text Markup Language", "High Tech Machine Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"]'::jsonb, 0, 'HTML stands for Hyper Text Markup Language.'),
  ('technology', 'easy', 'Which programming language was created by Guido van Rossum?', '["Java", "C++", "Python", "JavaScript"]'::jsonb, 2, 'Guido van Rossum created Python.'),
  ('technology', 'medium', 'What year was the first iPhone released?', '["2005", "2006", "2007", "2008"]'::jsonb, 2, 'The first iPhone was released in 2007.'),
  ('technology', 'medium', 'Which company created the Android operating system?', '["Apple", "Microsoft", "Google", "Samsung"]'::jsonb, 2, 'Google created the Android operating system.'),
  ('technology', 'medium', 'What does URL stand for?', '["Uniform Resource Locator", "Universal Reading Language", "United Remote Link", "Uniform Reading Link"]'::jsonb, 0, 'URL stands for Uniform Resource Locator.'),
  ('technology', 'medium', 'Which of these is NOT a programming language?', '["Java", "Python", "HTML", "C++"]'::jsonb, 2, 'HTML is a markup language, not a programming language.'),
  ('technology', 'medium', 'What is the name of the first artificial Earth satellite?', '["Apollo", "Voyager", "Sputnik", "Explorer"]'::jsonb, 2, 'Sputnik was the first artificial Earth satellite.'),
  ('technology', 'hard', 'Who invented the World Wide Web?', '["Bill Gates", "Steve Jobs", "Tim Berners-Lee", "Mark Zuckerberg"]'::jsonb, 2, 'Tim Berners-Lee invented the World Wide Web.'),
  ('technology', 'hard', 'What was the first computer virus called?', '["Creeper", "ILOVEYOU", "Melissa", "Code Red"]'::jsonb, 0, 'The first computer virus was called Creeper.');

-- Club Carnival Survey Questions (5)
INSERT INTO quiz_questions (category_id, difficulty, prompt, options, correct_index, explanation) VALUES
  ('club_carnival', 'easy', 'Will you be participating and helping our club in Club Carnival?', '["Yes, I want to help!", "No, I cannot help", "Maybe later", "I will think about it"]'::jsonb, 0, 'Great! We need enthusiastic helpers to make Club Carnival a success!'),
  ('club_carnival', 'easy', 'What do you want to help us with?', '["Putting food in plates", "Money handling (must be good at math)", "Asking people for what they want (communicator and leader)", "Going around and getting friends to come buy"]'::jsonb, 0, 'Every role is important! Let us know your preference.'),
  ('club_carnival', 'easy', 'Do you want to bring something for our club to sell?', '["Yes, I have something in mind!", "No, I will not bring anything", "Maybe, let me think", "I will ask my friends"]'::jsonb, 0, 'Awesome! Homemade treats and unique items are always welcome!'),
  ('club_carnival', 'easy', 'What date is Club Carnival?', '["October 15", "October 16 at lunch", "October 17", "October 18"]'::jsonb, 1, 'Mark your calendar! Club Carnival is on October 16 at lunch. See you there!'),
  ('club_carnival', 'easy', 'How do you like the club so far?', '["Meh", "I don''t like it", "I love this club", "It''s my favorite!"]'::jsonb, 0, 'Thanks for sharing your thoughts about the club.')
ON CONFLICT (category_id, difficulty, prompt) DO NOTHING;

-- Mark Club Carnival questions as unscored
UPDATE quiz_questions
SET is_scored = FALSE
WHERE category_id = 'club_carnival';
