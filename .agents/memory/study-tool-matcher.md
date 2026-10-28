---
name: Study Tool Matcher
description: Product boundaries and privacy rules for the study-tool matching survey.
---

The Study Tool Matcher is an ungraded survey shown in the same activity list as other surveys. Include its match rankings in the shared community results feed, but never expose answer selections or choice-point mappings. Keep questions, choices, and tool descriptions in JSON and save results in the dedicated matcher-results table.

**Why:** the user clarified that the matcher belongs with the other surveys and its results should be shared with the community.

**How to apply:** treat the matcher as a normal activity in the UI and community feed while retaining its specialized data model and ungraded scoring.
