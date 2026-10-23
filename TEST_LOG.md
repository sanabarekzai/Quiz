# Study Tool Matcher acceptance checks

- [x] 12 questions load with four choices each; public projection strips point maps (`test/tool-matcher.test.js`).
- [x] Missing or invalid answers are rejected by validation.
- [x] All-A answers lead with Focustown or LifeAt; all-B lead with Google Calendar or Structured; all-D lead with Quizlet.
- [x] Result ranking contains seven unique tools and match percentages stay between 0 and 100.
- [x] Authenticated API integration: missing-answer HTTP response, persistence after restart, and per-user result isolation.
- [x] Existing quiz and leaderboard regression check after the matcher schema/routes are applied.
