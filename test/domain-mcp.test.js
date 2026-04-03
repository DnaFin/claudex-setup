const fs = require('fs');
const os = require('os');
const path = require('path');
const { detectDomainPacks } = require('../src/domain-packs');
const { recommendMcpPacks, getMcpPack, normalizeMcpPackKeys, MCP_PACKS } = require('../src/mcp-packs');
const { ProjectContext } = require('../src/context');
const { STACKS } = require('../src/techniques');

function mkFixture(name, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `claudex-jest-domain-${name}-`));
  for (const [filePath, content] of Object.entries(files)) {
    const full = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

describe('Domain Packs', () => {
  test('empty repo gets baseline-general', () => {
    const dir = mkFixture('baseline');
    try {
      const ctx = new ProjectContext(dir);
      const packs = detectDomainPacks(ctx, []);
      expect(packs.length).toBe(1);
      expect(packs[0].key).toBe('baseline-general');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('react project gets frontend-ui', () => {
    const dir = mkFixture('react', { 'package.json': { dependencies: { react: '^18' } } });
    try {
      const ctx = new ProjectContext(dir);
      const stacks = ctx.detectStacks(STACKS);
      const packs = detectDomainPacks(ctx, stacks);
      expect(packs.some(p => p.key === 'frontend-ui')).toBe(true);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('langchain project gets ai-ml', () => {
    const dir = mkFixture('aiml', { 'package.json': { dependencies: { langchain: '^0.1' } } });
    try {
      const ctx = new ProjectContext(dir);
      const stacks = ctx.detectStacks(STACKS);
      const packs = detectDomainPacks(ctx, stacks);
      expect(packs.some(p => p.key === 'ai-ml')).toBe(true);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('ai-ml and data-pipeline can coexist', () => {
    const dir = mkFixture('aiml-data', {
      'package.json': { dependencies: { langchain: '^0.1', pandas: '^2' } },
    });
    try {
      const ctx = new ProjectContext(dir);
      const stacks = ctx.detectStacks(STACKS);
      const packs = detectDomainPacks(ctx, stacks);
      const keys = packs.map(p => p.key);
      expect(keys).toContain('ai-ml');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('pnpm-workspace.yaml triggers monorepo', () => {
    const dir = mkFixture('pnpm-mono', {
      'package.json': { name: 'mono' },
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
    });
    try {
      const ctx = new ProjectContext(dir);
      const packs = detectDomainPacks(ctx, []);
      expect(packs.some(p => p.key === 'monorepo')).toBe(true);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('MCP Packs', () => {
  test('all MCP packs have required fields', () => {
    for (const pack of MCP_PACKS) {
      expect(pack.key).toBeTruthy();
      expect(pack.label).toBeTruthy();
      expect(pack.servers).toBeTruthy();
      expect(Object.keys(pack.servers).length).toBeGreaterThan(0);
    }
  });

  test('MCP pack count is 26', () => {
    expect(MCP_PACKS.length).toBe(26);
  });

  test('normalizeMcpPackKeys filters invalid keys', () => {
    expect(normalizeMcpPackKeys(['context7-docs', 'invalid-pack'])).toEqual(['context7-docs']);
  });

  test('getMcpPack returns null for unknown key', () => {
    expect(getMcpPack('nonexistent')).toBeNull();
  });
});
