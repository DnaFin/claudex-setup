const { getFpFeedbackMultiplier, getRecommendationPriorityScore, buildTopNextActions } = require('../src/audit');

describe('FP Feedback Ranking Integration', () => {
  const baseItem = {
    key: 'testCheck',
    id: 999,
    name: 'Test Check',
    impact: 'high',
    fix: 'Add test configuration',
    category: 'quality',
    sourceUrl: 'https://example.com/docs',
  };

  describe('getFpFeedbackMultiplier', () => {
    test('returns 1.0 when no feedback data exists', () => {
      expect(getFpFeedbackMultiplier(null, 'testCheck')).toBe(1.0);
      expect(getFpFeedbackMultiplier({}, 'testCheck')).toBe(1.0);
      expect(getFpFeedbackMultiplier(undefined, 'testCheck')).toBe(1.0);
    });

    test('returns 1.0 when key has no feedback entries', () => {
      const byKey = { otherKey: { total: 5, helpful: 4, unhelpful: 1 } };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(1.0);
    });

    test('returns 0.7 when >50% feedback is not helpful', () => {
      const byKey = {
        testCheck: { total: 10, helpful: 3, unhelpful: 7 },
      };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(0.7);
    });

    test('returns 1.2 when >80% feedback is helpful', () => {
      const byKey = {
        testCheck: { total: 10, helpful: 9, unhelpful: 1 },
      };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(1.2);
    });

    test('returns 1.0 when feedback is mixed (50% unhelpful, not >50%)', () => {
      const byKey = {
        testCheck: { total: 10, helpful: 5, unhelpful: 5 },
      };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(1.0);
    });

    test('returns 1.0 when helpful is exactly 80% (not >80%)', () => {
      const byKey = {
        testCheck: { total: 10, helpful: 8, unhelpful: 2 },
      };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(1.0);
    });

    test('returns 1.0 when total is 0', () => {
      const byKey = {
        testCheck: { total: 0, helpful: 0, unhelpful: 0 },
      };
      expect(getFpFeedbackMultiplier(byKey, 'testCheck')).toBe(1.0);
    });
  });

  describe('Negative feedback lowers priority', () => {
    test('priority score is lower with majority negative FP feedback', () => {
      const negativeFp = {
        testCheck: { total: 10, helpful: 2, unhelpful: 8 },
      };
      const scoreWithout = getRecommendationPriorityScore(baseItem, {}, null);
      const scoreWith = getRecommendationPriorityScore(baseItem, {}, negativeFp);
      expect(scoreWith).toBeLessThan(scoreWithout);
      // Should be approximately 70% of original
      expect(scoreWith).toBeCloseTo(scoreWithout * 0.7, 0);
    });
  });

  describe('Positive feedback boosts priority', () => {
    test('priority score is higher with majority positive FP feedback', () => {
      const positiveFp = {
        testCheck: { total: 10, helpful: 9, unhelpful: 1 },
      };
      const scoreWithout = getRecommendationPriorityScore(baseItem, {}, null);
      const scoreWith = getRecommendationPriorityScore(baseItem, {}, positiveFp);
      expect(scoreWith).toBeGreaterThan(scoreWithout);
      // Should be approximately 120% of original
      expect(scoreWith).toBeCloseTo(scoreWithout * 1.2, 0);
    });
  });

  describe('No feedback = unchanged ranking', () => {
    test('priority score is identical with no FP feedback', () => {
      const scoreDefault = getRecommendationPriorityScore(baseItem, {});
      const scoreNullFp = getRecommendationPriorityScore(baseItem, {}, null);
      const scoreEmptyFp = getRecommendationPriorityScore(baseItem, {}, {});
      expect(scoreDefault).toBe(scoreNullFp);
      expect(scoreDefault).toBe(scoreEmptyFp);
    });
  });

  describe('buildTopNextActions respects FP feedback in ordering', () => {
    const failedChecks = [
      { ...baseItem, key: 'checkA', name: 'Check A', impact: 'high', passed: false },
      { ...baseItem, key: 'checkB', name: 'Check B', impact: 'high', passed: false },
    ];

    test('check with negative FP feedback ranks lower', () => {
      const fpByKey = {
        checkA: { total: 10, helpful: 1, unhelpful: 9 },
      };
      const actions = buildTopNextActions(failedChecks, 2, {}, { fpFeedbackByKey: fpByKey });
      // checkB should rank higher since checkA has negative feedback
      expect(actions[0].key).toBe('checkB');
      expect(actions[1].key).toBe('checkA');
    });
  });
});
