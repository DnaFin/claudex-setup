const { TECHNIQUES } = require('../src/techniques');
const { CODEX_TECHNIQUES } = require('../src/codex/techniques');
const { GEMINI_TECHNIQUES } = require('../src/gemini/techniques');
const { COPILOT_TECHNIQUES } = require('../src/copilot/techniques');
const { CURSOR_TECHNIQUES } = require('../src/cursor/techniques');
const { WINDSURF_TECHNIQUES } = require('../src/windsurf/techniques');
const { AIDER_TECHNIQUES } = require('../src/aider/techniques');
const { OPENCODE_TECHNIQUES } = require('../src/opencode/techniques');

const PLATFORM_TECHNIQUES = {
  claude: TECHNIQUES,
  codex: CODEX_TECHNIQUES,
  gemini: GEMINI_TECHNIQUES,
  copilot: COPILOT_TECHNIQUES,
  cursor: CURSOR_TECHNIQUES,
  windsurf: WINDSURF_TECHNIQUES,
  aider: AIDER_TECHNIQUES,
  opencode: OPENCODE_TECHNIQUES,
};

describe('Official source URLs', () => {
  test('all 673 techniques across 8 platforms expose a sourceUrl', () => {
    let total = 0;

    for (const [platform, techniques] of Object.entries(PLATFORM_TECHNIQUES)) {
      for (const [key, technique] of Object.entries(techniques)) {
        total += 1;
        expect(technique.sourceUrl).toBeTruthy();
        expect(technique.sourceUrl).toMatch(/^https:\/\//);
      }
    }

    expect(total).toBe(673);
  });
});
