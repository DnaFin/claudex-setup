const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanOrg } = require('../src/org');

function mkFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `org-jest-${name}-`));
}

function writeJson(dir, relPath, value) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2), 'utf8');
}

function writeFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

describe('Org aggregation', () => {
  test('scanOrg audits multiple repos and returns aggregate summary', async () => {
    const dir = mkFixture('scan');
    try {
      writeFile(dir, 'repo-a/CLAUDE.md', '# Repo A\n');
      writeJson(dir, 'repo-a/package.json', { name: 'repo-a' });
      writeFile(dir, 'repo-b/CLAUDE.md', '# Repo B\n');
      writeJson(dir, 'repo-b/package.json', { name: 'repo-b' });
      const result = await scanOrg([path.join(dir, 'repo-a'), path.join(dir, 'repo-b')], 'claude');
      expect(result.repoCount).toBe(2);
      expect(result.repos).toHaveLength(2);
      expect(typeof result.averageScore).toBe('number');
      expect(result.repos[0]).toHaveProperty('topAction');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
