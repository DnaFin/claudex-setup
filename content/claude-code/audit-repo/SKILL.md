---
name: audit-repo
description: Run claudex-setup on the current repo and summarize the score, top gaps, and next command
---

Run `npx claudex-setup --json` in the current project directory and summarize the result.

Your output should include:

1. The overall score and organic score
2. The top 3 next actions from `topNextActions`
3. The suggested next command from `suggestedNextCommand`
4. A short explanation of what the repo already does well if there are notable strengths

Behavior rules:

- If the user asks for the shortest version, run `npx claudex-setup --lite`
- If the user wants deeper no-write analysis, run `npx claudex-setup augment --json`
- If the score is below 50, explicitly recommend `npx claudex-setup setup`
- Never apply changes automatically from this skill
