# Using claudex-setup from inside Claude Code

## Skill: Audit Repo

Add this to `.claude/skills/audit-repo.md` in any project:

```markdown
---
name: audit-repo
description: Run claudex-setup audit on the current project and show score + top gaps
---

Run `npx claudex-setup --json` on the current project directory.
Parse the JSON output and present:
1. Score X/100
2. Top 3 critical/high gaps with fix descriptions
3. Suggest next command based on score

$ARGUMENTS — optional: --lite for quick scan
```

## Hook: Auto-audit on SessionStart

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "node -e \"try{const r=require('child_process').execSync('npx claudex-setup --json 2>/dev/null',{timeout:15000}).toString();const d=JSON.parse(r);if(d.score<50)console.log(JSON.stringify({systemMessage:'⚠️ Claude Code setup score: '+d.score+'/100. Consider running: npx claudex-setup --lite'}))}catch(e){console.log('{}')}\"",
        "timeout": 20,
        "statusMessage": "Checking Claude Code setup..."
      }
    ]
  }
}
```

## Agent: Setup Advisor

Add to `.claude/agents/setup-advisor.md`:

```markdown
---
name: setup-advisor
description: Analyzes Claude Code setup and recommends improvements
tools: [Bash, Read, Glob, Grep]
model: haiku
maxTurns: 10
---

You are a Claude Code setup advisor.

1. Run `npx claudex-setup augment --json` on the current project
2. Analyze gaps and strengths
3. Recommend top 5 improvements with rationale
4. If user approves, guide them through applying changes
```
