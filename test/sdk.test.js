const fs = require('fs');
const os = require('os');
const path = require('path');

const sdk = require('../sdk');

function makeTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `nerviq-sdk-${name}-`));
}

describe('@nerviq/sdk', () => {
  test('getCatalog returns the full 1416-check catalog after adding Python + Go stack checks', () => {
    const catalog = sdk.getCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog).toHaveLength(1416);
  });

  test('detectPlatforms identifies all supported platform markers', () => {
    const dir = makeTempDir('detect');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Claude\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Codex\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'GEMINI.md'), '# Gemini\n', 'utf8');
    fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), '# Copilot\n', 'utf8');
    fs.mkdirSync(path.join(dir, '.cursor'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.windsurf'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aider.conf.yml'), 'model: gpt-4o-mini\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'opencode.json'), '{ "permissions": {} }\n', 'utf8');

    expect(sdk.detectPlatforms(dir)).toEqual([
      'claude',
      'codex',
      'gemini',
      'copilot',
      'cursor',
      'windsurf',
      'aider',
      'opencode',
    ]);
  });

  test('synergyReport returns structured data and a rendered report', async () => {
    const dir = makeTempDir('synergy');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Claude\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Codex\n', 'utf8');

    const result = await sdk.synergyReport(dir);

    expect(result.activePlatforms).toEqual(['claude', 'codex']);
    expect(result.platformAudits.claude).toBeTruthy();
    expect(result.platformAudits.codex).toBeTruthy();
    expect(typeof result.report).toBe('string');
    expect(result.report).toContain('SYNERGY DASHBOARD');
  });
});
