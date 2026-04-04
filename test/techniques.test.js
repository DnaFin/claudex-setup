const { TECHNIQUES, STACKS, containsEmbeddedSecret } = require('../src/techniques');

describe('Techniques', () => {
  test('all techniques have required fields', () => {
    for (const [key, t] of Object.entries(TECHNIQUES)) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(typeof t.check).toBe('function');
      expect(['critical', 'high', 'medium', 'low']).toContain(t.impact);
      expect(t.category).toBeTruthy();
    }
  });

  test('no duplicate technique IDs', () => {
    const ids = Object.values(TECHNIQUES).map(t => t.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  test('no duplicate technique names', () => {
    const names = Object.values(TECHNIQUES).map(t => t.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  test('technique count is 90 (85 original + 5 new coverage checks)', () => {
    expect(Object.keys(TECHNIQUES).length).toBe(90);
  });

  test('embedded secret detector catches Anthropic-style keys with dashes', () => {
    expect(containsEmbeddedSecret('ANTHROPIC_API_KEY=sk-ant-api03-fakekeyfakekey1234567890abcdef')).toBe(true);
  });

  test('embedded secret detector catches AWS access key ids', () => {
    expect(containsEmbeddedSecret('AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF')).toBe(true);
  });

  test('embedded secret detector ignores placeholder guidance text', () => {
    expect(containsEmbeddedSecret('Set ANTHROPIC_API_KEY in your environment before running the review.')).toBe(false);
  });
});

describe('Stacks', () => {
  test('all stacks have required fields', () => {
    for (const [key, s] of Object.entries(STACKS)) {
      expect(s.label).toBeTruthy();
      expect(Array.isArray(s.files)).toBe(true);
      expect(s.files.length).toBeGreaterThan(0);
    }
  });

  test('stack count is 30', () => {
    expect(Object.keys(STACKS).length).toBe(30);
  });
});
