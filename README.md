# claudex-setup → Nerviq

> **This project has been renamed and expanded to [Nerviq](https://github.com/nerviq/nerviq).**

## What changed

`claudex-setup` started as a Claude Code audit tool (85 checks, single platform).

**Nerviq** is the next generation — the intelligent nervous system for **all** AI coding agents:

- **8 platforms**: Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, Windsurf, Aider, OpenCode
- **639 checks** across all platforms
- **Harmony**: detect drift between agents on the same project
- **Synergy**: make agents amplify each other (1+1+1 > 3)
- **135 modules**, 172 exports

## Install the new version

```bash
npm i -g @nerviq/cli
```

## Usage

```bash
nerviq audit                        # Audit Claude Code (default)
nerviq audit --platform codex       # Audit Codex setup
nerviq audit --platform gemini      # Audit Gemini CLI setup
nerviq audit --platform copilot     # Audit GitHub Copilot setup
nerviq audit --platform cursor      # Audit Cursor setup
nerviq audit --platform windsurf    # Audit Windsurf setup
nerviq audit --platform aider       # Audit Aider setup
nerviq audit --platform opencode    # Audit OpenCode setup

nerviq harmony-audit                # Cross-platform harmony score
nerviq synergy-report               # Synergy amplification report
```

## Links

- **npm**: [@nerviq/cli](https://www.npmjs.com/package/@nerviq/cli)
- **GitHub**: [github.com/nerviq/nerviq](https://github.com/nerviq/nerviq)
- **Website**: [nerviq.net](https://nerviq.net)

## Legacy

The original `claudex-setup` package on npm is deprecated. All future development happens at [@nerviq/cli](https://www.npmjs.com/package/@nerviq/cli).

If you were using `claudex-setup`, simply switch:

```bash
# Old
npx claudex-setup

# New
npx @nerviq/cli audit
```

All features from claudex-setup are preserved and expanded in Nerviq.
