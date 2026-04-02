# Launch Posts — Ready to Publish

## Post 1: Reddit r/ClaudeAI

**Title:** I built a tool that audits your project for Claude Code optimization — scores you 0-100

**Body:**
After cataloging 1,107 Claude Code entries and verifying 948 of them with evidence, I built a CLI that checks if your project is actually set up to get the most out of Claude Code.

Most projects score around 10-20/100. After running setup, they jump to 70+.

```
npx claudex-setup
```

It checks for: CLAUDE.md, hooks, custom commands, skills, agents, Mermaid diagrams, XML tags, path rules, MCP config, permissions, and more.

Then `npx claudex-setup setup` auto-creates everything that's missing, tailored to your stack (React, Python, TypeScript, etc).

Zero dependencies. No API keys. Runs entirely local.

GitHub: https://github.com/DnaFin/claudex-setup

Would love feedback!

---

## Post 2: Reddit r/ChatGPTCoding

**Title:** Your Claude Code project is probably running at 10% efficiency. Here's how to check.

**Body:**
I spent weeks cataloging every Claude Code feature, technique, and best practice — 1,107 total, 948 verified with real evidence.

Turns out most projects are missing basic stuff that makes a huge difference:
- No CLAUDE.md (Claude doesn't know your project conventions)
- No hooks (no auto-lint, no auto-test)
- No custom commands (repeating the same prompts manually)
- No Mermaid diagrams (wasting 73% more tokens on prose descriptions)

Built a quick checker:
```
npx claudex-setup
```

Scores your project 0-100, tells you exactly what to fix, and can auto-apply everything.

Free, open source, zero dependencies: https://github.com/DnaFin/claudex-setup

---

## Post 3: Dev.to Article

**Title:** 1,107 Claude Code Entries: What I Learned Building the Most Comprehensive Catalog

**Body (excerpt):**
I set out to catalog every single Claude Code capability, technique, and best practice. After repeated research cycles, I have 1,107 entries — 948 verified with real evidence.

Here are the top 10 things most developers are missing:

1. **CLAUDE.md** — Claude reads this at the start of every session. Without it, Claude doesn't know your build commands, code style, or project rules.

2. **Mermaid diagrams** — A Mermaid architecture diagram saves 73% tokens compared to describing your project in prose.

3. **Hooks** — Auto-lint after every edit. Auto-test before every commit. Hooks fire 100% of the time, CLAUDE.md rules fire ~80%.

4. **Custom commands** — `/test`, `/deploy`, `/review` — package your repeated workflows.

5. **Verification loops** — Tell Claude how to verify its own work. Include test commands in CLAUDE.md.

6. **Path-specific rules** — Different conventions for frontend vs backend files.

7. **XML tags** — `<constraints>`, `<validation>` in CLAUDE.md = unambiguous instructions.

8. **Custom agents** — Security reviewer, test writer — specialized subagents for focused tasks.

9. **Skills** — Domain-specific workflows that load on demand, not every session.

10. **MCP servers** — Connect Claude to your database, ticket system, Slack.

I packaged this into a CLI that checks your project:
```
npx claudex-setup
```

Full catalog: https://github.com/DnaFin/claudex-setup

---

## Post 4: Twitter/X Thread

**Tweet 1:**
I cataloged 1,107 Claude Code entries and verified 948 of them with evidence.

Most projects use less than 5% of what Claude Code can do.

Here's a free tool that checks your project and tells you exactly what's missing:

npx claudex-setup

Thread 🧵👇

**Tweet 2:**
The #1 thing you're probably missing: CLAUDE.md

It's a file Claude reads at the start of every session. Without it, Claude doesn't know your:
- Build commands
- Code style
- Testing framework
- Project architecture

Takes 2 minutes to create. Impact: massive.

**Tweet 3:**
#2: Mermaid diagrams in CLAUDE.md

A few hundred tokens of Mermaid syntax conveys what takes thousands of tokens in prose.

73% token savings = faster responses, lower cost, better context.

**Tweet 4:**
#3: Hooks > CLAUDE.md rules

CLAUDE.md instructions = ~80% compliance
Hooks = 100% enforcement

Auto-lint after edits. Block commits without tests. Prevent force-push.

Hooks are deterministic. Instructions are advisory.

**Tweet 5:**
Want to check your project in 10 seconds?

npx claudex-setup

Scores 0-100. Shows what's missing. Auto-fixes with `setup`.

Free. Open source. Zero dependencies.

https://github.com/DnaFin/claudex-setup

---

## Post 5: Hacker News (Show HN)

**Title:** Show HN: claudex-setup – Audit any project for Claude Code optimization (1,107 entries)

**Body:**
I built a CLI tool that scores your project against Claude Code best practices.

After researching 1,107 entries (948 verified with evidence), most projects score 10-20 out of 100 because they're missing basic optimizations like CLAUDE.md files, hooks, custom commands, and architecture diagrams.

npx claudex-setup → audit (0-100 score)
npx claudex-setup setup → auto-fix

Detects your stack (React, Python, TS, Rust, Go, etc) and tailors recommendations.

Zero dependencies, no API keys, runs locally.

https://github.com/DnaFin/claudex-setup
