---
name: Study Tool Matcher
description: Product boundaries and privacy rules for the study-tool matching survey.
---

The Study Tool Matcher is a separate, ungraded survey, not a scored quiz. Keep its questions, choices, and tool descriptions in JSON; never send choice-point mappings to the browser. Save results in the dedicated matcher-results table and expose only the signed-in user's history. Preserve existing quiz and leaderboard behavior.

**Why:** the user supplied an explicit product brief that separates the matcher from required quizzes and requires private, persistent rankings.

**How to apply:** extend the matcher data/API/results flow for changes; do not fold it into quiz questions, attempts, or leaderboards.
