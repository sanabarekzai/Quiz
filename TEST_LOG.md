# Study Tool Matcher acceptance checks

- [x] 12 questions load with four choices each; public projection strips point maps (`test/tool-matcher.test.js`).
- [x] Missing or invalid answers are rejected by validation.
- [x] All-A answers lead with Focustown or LifeAt; all-B lead with Google Calendar or Structured; all-D lead with Quizlet.
- [x] Result ranking contains seven unique tools and match percentages stay between 0 and 100.
- [x] Authenticated API integration: missing-answer HTTP response, persistence after restart, and per-user result isolation.
- [x] Existing quiz and leaderboard regression check after the matcher schema/routes are applied.

## Study Blocker Check-In

- [x] Twelve questions with four choices each; point maps stay server-side.
- [x] Category maximums match the supplied score key (S 10, D 10, E 9, P 10, M 9).
- [x] All-A results lead with Starting Struggle; all-B results lead with Distraction Drift.
- [x] Highest-profile ties use the final answer; close-second and Steady Builder rules are covered by unit tests.
- [x] Results are ungraded and saved to the signed-in account; missing answers are rejected.
- [x] HTTP flow confirms question data does not expose answer-point mappings and saved records are visible to that account.
- [x] Energy Drain result includes the wellbeing note; reflection prompts are displayed but not submitted or stored.
