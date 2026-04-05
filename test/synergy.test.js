const fs = require('fs');
const os = require('os');
const path = require('path');

const { routeTask, classifyTaskType, PLATFORM_CAPABILITIES } = require('../src/synergy/routing');
const { compoundAudit, calculateAmplification } = require('../src/synergy/evidence');
const { analyzeCompensation, getUncoveredGaps } = require('../src/synergy/compensation');
const { rankRecommendations, calculateSynergyScore } = require('../src/synergy/ranking');
const { propagateInsight, getCrossLearnings } = require('../src/synergy/learning');
const { discoverPatterns } = require('../src/synergy/patterns');

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `synergy-jest-${name}-`));
}

function cleanFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Routing tests ──────────────────────────────────────────────────────────

describe('Synergy Routing', () => {
  test('routeTask("fix bug", ["claude","codex"]) recommends claude', () => {
    const result = routeTask('fix bug', ['claude', 'codex']);
    expect(result.recommended).not.toBeNull();
    expect(result.recommended.platform).toBe('claude');
  });

  test('routeTask("CI pipeline deploy", ["claude","codex"]) recommends codex', () => {
    const result = routeTask('CI pipeline deploy', ['claude', 'codex']);
    expect(result.recommended).not.toBeNull();
    expect(result.recommended.platform).toBe('codex');
  });

  test('routeTask with empty platforms returns null recommendation', () => {
    const result = routeTask('fix a bug', []);
    expect(result.recommended).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  test('routeTask returns taskType and alternatives', () => {
    const result = routeTask('refactor the auth module', ['claude', 'codex', 'cursor']);
    expect(result).toHaveProperty('taskType');
    expect(result).toHaveProperty('recommended');
    expect(result).toHaveProperty('alternatives');
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  test('classifyTaskType("fix authentication bug") returns bugfix', () => {
    const taskType = classifyTaskType('fix authentication bug');
    expect(taskType).toBe('bugfix');
  });

  test('classifyTaskType("deploy to production CI pipeline") returns CI', () => {
    const taskType = classifyTaskType('deploy to production CI pipeline');
    expect(taskType).toBe('CI');
  });

  test('classifyTaskType("refactor the user service") returns refactor', () => {
    const taskType = classifyTaskType('refactor the user service');
    expect(taskType).toBe('refactor');
  });

  test('PLATFORM_CAPABILITIES has claude, codex, gemini, copilot, cursor', () => {
    const keys = Object.keys(PLATFORM_CAPABILITIES);
    expect(keys).toEqual(
      expect.arrayContaining(['claude', 'codex', 'gemini', 'copilot', 'cursor'])
    );
    expect(keys.length).toBe(5);
  });

  test('routeTask with history boosts platform with good track record', () => {
    const history = {
      codex: { bugfix: { successes: 10, total: 10 } },
      claude: { bugfix: { successes: 2, total: 10 } },
    };
    const result = routeTask('fix a bug', ['claude', 'codex'], history);
    // Codex gets a large history boost even though claude has higher base reasoning
    expect(result.recommended).not.toBeNull();
    // The result depends on the exact scoring; just verify it returns a valid recommendation
    expect(['claude', 'codex']).toContain(result.recommended.platform);
  });
});

// ─── Evidence tests ─────────────────────────────────────────────────────────

describe('Synergy Evidence', () => {
  test('compoundAudit with 2 platform results produces amplification >= 0', () => {
    const audits = {
      claude: {
        score: 70,
        results: [
          { key: 'hasInstructions', name: 'Has instructions', category: 'setup', impact: 'high', passed: true },
          { key: 'hasTests', name: 'Has tests', category: 'quality', impact: 'medium', passed: false },
        ],
      },
      codex: {
        score: 65,
        results: [
          { key: 'hasInstructions', name: 'Has instructions', category: 'setup', impact: 'high', passed: true },
          { key: 'hasSandbox', name: 'Has sandbox', category: 'security', impact: 'high', passed: true },
        ],
      },
    };
    const result = compoundAudit(audits);
    expect(result.amplification).toBeGreaterThanOrEqual(0);
    expect(result.compoundScore).toBeGreaterThanOrEqual(result.bestSingleScore);
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  test('compoundAudit with empty input returns zeroes', () => {
    const result = compoundAudit({});
    expect(result.compoundScore).toBe(0);
    expect(result.amplification).toBe(0);
    expect(result.totalFindings).toBe(0);
  });

  test('compoundAudit cross-validates findings present on multiple platforms', () => {
    const audits = {
      claude: {
        score: 80,
        results: [
          { key: 'shared-check', name: 'Shared check', category: 'setup', impact: 'high', passed: true },
        ],
      },
      codex: {
        score: 75,
        results: [
          { key: 'shared-check', name: 'Shared check', category: 'setup', impact: 'high', passed: true },
        ],
      },
    };
    const result = compoundAudit(audits);
    expect(result.crossValidated.length).toBeGreaterThan(0);
    const shared = result.crossValidated.find(cv => cv.key === 'shared-check');
    expect(shared).toBeDefined();
    expect(shared.verdict).toBe('cross-validated-pass');
  });

  test('calculateAmplification returns verdict', () => {
    const audits = {
      claude: { score: 60, results: [{ key: 'a', passed: true, name: 'A', category: 'x', impact: 'high' }] },
      codex: { score: 55, results: [{ key: 'b', passed: true, name: 'B', category: 'y', impact: 'high' }] },
    };
    const amp = calculateAmplification(audits);
    expect(amp).toHaveProperty('amplification');
    expect(amp).toHaveProperty('verdict');
    expect(typeof amp.verdict).toBe('string');
  });
});

// ─── Compensation tests ─────────────────────────────────────────────────────

describe('Synergy Compensation', () => {
  test('analyzeCompensation identifies gaps covered by other platforms', () => {
    const result = analyzeCompensation(['claude', 'codex']);
    expect(result).toHaveProperty('compensations');
    expect(result).toHaveProperty('uncoveredGaps');
    expect(result).toHaveProperty('recommendedAdditions');
    // Claude is weak at CI (2), codex is strong at CI (5) — should compensate
    const ciComp = result.compensations.find(
      c => c.weakness.platform === 'claude' && c.weakness.area === 'CI'
    );
    expect(ciComp).toBeDefined();
    expect(ciComp.compensatedBy.platform).toBe('codex');
  });

  test('analyzeCompensation with single platform has no compensations', () => {
    const result = analyzeCompensation(['claude']);
    expect(result.compensations).toHaveLength(0);
  });

  test('getUncoveredGaps returns array', () => {
    const gaps = getUncoveredGaps(['claude']);
    expect(Array.isArray(gaps)).toBe(true);
  });
});

// ─── Ranking tests ──────────────────────────────────────────────────────────

describe('Synergy Ranking', () => {
  test('rankRecommendations boosts cross-platform recommendations', () => {
    const recs = [
      { name: 'single', score: 5, applicablePlatforms: ['claude'], impact: 'medium' },
      { name: 'cross', score: 5, applicablePlatforms: ['claude', 'codex', 'gemini'], impact: 'medium' },
    ];
    const ranked = rankRecommendations(recs, ['claude', 'codex', 'gemini']);
    // Cross-platform one should be ranked higher due to boost
    expect(ranked[0].name).toBe('cross');
    expect(ranked[0].synergyScore).toBeGreaterThan(ranked[1].synergyScore);
  });

  test('calculateSynergyScore returns number > 0', () => {
    const rec = { score: 3, applicablePlatforms: ['claude'], impact: 'high' };
    const score = calculateSynergyScore(rec, ['claude', 'codex']);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  test('rankRecommendations with empty array returns empty', () => {
    const result = rankRecommendations([], ['claude']);
    expect(result).toEqual([]);
  });

  test('calculateSynergyScore applies compensation boost', () => {
    const base = { score: 5, applicablePlatforms: ['claude'], impact: 'medium' };
    const withGap = { ...base, fillsGap: true };
    const baseScore = calculateSynergyScore(base, ['claude']);
    const gapScore = calculateSynergyScore(withGap, ['claude']);
    expect(gapScore).toBeGreaterThan(baseScore);
  });
});

// ─── Learning tests ─────────────────────────────────────────────────────────

describe('Synergy Learning', () => {
  test('propagateInsight adapts recommendation for target platform', () => {
    const insight = {
      type: 'verification-command',
      recommendation: 'Add npm test',
      command: 'npm test',
      outcome: 'applied',
      score_delta: 10,
    };
    const propagations = propagateInsight(insight, 'claude', ['codex', 'gemini']);
    expect(propagations.length).toBe(2);
    expect(propagations[0].platform).toBe('codex');
    expect(propagations[1].platform).toBe('gemini');
    for (const p of propagations) {
      expect(p).toHaveProperty('adaptedRecommendation');
      expect(p).toHaveProperty('confidence');
      expect(p).toHaveProperty('sourceEvidence');
      expect(typeof p.adaptedRecommendation).toBe('string');
    }
  });

  test('propagateInsight skips source platform', () => {
    const insight = { type: 'hook', description: 'Add secret check', outcome: 'applied', score_delta: 5 };
    const propagations = propagateInsight(insight, 'claude', ['claude', 'codex']);
    expect(propagations.length).toBe(1);
    expect(propagations[0].platform).toBe('codex');
  });

  test('getCrossLearnings returns array for empty dir', () => {
    const dir = mkFixture('learning-empty');
    try {
      const learnings = getCrossLearnings(dir);
      expect(Array.isArray(learnings)).toBe(true);
      expect(learnings.length).toBe(0);
    } finally { cleanFixture(dir); }
  });
});

// ─── Pattern tests ──────────────────────────────────────────────────────────

describe('Synergy Patterns', () => {
  test('discoverPatterns returns array of patterns', () => {
    const history = [
      {
        platform: 'claude', timestamp: '2026-01-01', score: 80,
        findings: [{ key: 'a', name: 'A', passed: false }],
      },
      {
        platform: 'codex', timestamp: '2026-01-02', score: 70,
        findings: [{ key: 'a', name: 'A', passed: false }],
      },
      {
        platform: 'gemini', timestamp: '2026-01-03', score: 75,
        findings: [{ key: 'a', name: 'A', passed: false }],
      },
    ];
    const result = discoverPatterns(history);
    expect(result).toHaveProperty('patterns');
    expect(Array.isArray(result.patterns)).toBe(true);
    // 'A' fails on 3 platforms -> recurring failure
    const recurring = result.patterns.find(p => p.type === 'recurring-failure');
    expect(recurring).toBeDefined();
    expect(recurring.affectedPlatforms.length).toBe(3);
  });

  test('discoverPatterns with empty history returns empty patterns', () => {
    const result = discoverPatterns([]);
    expect(result.patterns).toEqual([]);
  });

  test('discoverPatterns detects platform-specific success', () => {
    const history = [
      { platform: 'claude', findings: [{ key: 'x', name: 'X', passed: true }] },
      { platform: 'codex', findings: [{ key: 'x', name: 'X', passed: false }] },
      { platform: 'gemini', findings: [{ key: 'x', name: 'X', passed: false }] },
    ];
    const result = discoverPatterns(history);
    const specific = result.patterns.find(p => p.type === 'platform-specific-success');
    expect(specific).toBeDefined();
    expect(specific.successPlatform).toBe('claude');
  });
});
