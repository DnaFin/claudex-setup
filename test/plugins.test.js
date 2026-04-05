const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlugins, mergePluginChecks, validatePlugin } = require('../src/plugins');
const { audit } = require('../src/audit');

function mkFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `nerviq-jest-plugins-${name}-`));
}

describe('loadPlugins', () => {
  test('returns [] on empty directory', () => {
    const dir = mkFixture('empty');
    try {
      const plugins = loadPlugins(dir);
      expect(plugins).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns plugins from nerviq.config.js', () => {
    const dir = mkFixture('with-config');
    try {
      const configContent = `
module.exports = {
  plugins: [
    {
      name: 'test-plugin',
      checks: {
        myCheck: {
          id: 'TEST-001',
          name: 'Test check',
          check: () => true,
          impact: 'medium',
          category: 'custom',
          fix: 'Do something',
        }
      }
    }
  ]
};
`;
      fs.writeFileSync(path.join(dir, 'nerviq.config.js'), configContent);
      const plugins = loadPlugins(dir);
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin');
      expect(plugins[0].checks.myCheck.id).toBe('TEST-001');
    } finally {
      // Clean require cache so other tests are not affected
      delete require.cache[path.join(dir, 'nerviq.config.js')];
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skips invalid plugins and returns valid ones', () => {
    const dir = mkFixture('mixed-valid');
    try {
      const configContent = `
module.exports = {
  plugins: [
    { name: 'bad-plugin' },
    {
      name: 'good-plugin',
      checks: {
        ok: {
          id: 'OK-001',
          name: 'OK check',
          check: () => false,
          impact: 'low',
          category: 'custom',
          fix: 'Fix it',
        }
      }
    }
  ]
};
`;
      fs.writeFileSync(path.join(dir, 'nerviq.config.js'), configContent);
      const plugins = loadPlugins(dir);
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('good-plugin');
    } finally {
      delete require.cache[path.join(dir, 'nerviq.config.js')];
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validatePlugin', () => {
  test('rejects non-object', () => {
    expect(validatePlugin(null).valid).toBe(false);
    expect(validatePlugin('string').valid).toBe(false);
  });

  test('rejects missing name', () => {
    const result = validatePlugin({ checks: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  test('rejects missing checks object', () => {
    const result = validatePlugin({ name: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('checks'))).toBe(true);
  });

  test('rejects check missing required fields', () => {
    const result = validatePlugin({
      name: 'test',
      checks: {
        bad: { id: 'X', name: 'X' },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('check'))).toBe(true);
    expect(result.errors.some(e => e.includes('impact'))).toBe(true);
  });

  test('rejects invalid impact value', () => {
    const result = validatePlugin({
      name: 'test',
      checks: {
        bad: {
          id: 'X',
          name: 'X',
          check: () => true,
          impact: 'extreme',
          category: 'custom',
          fix: 'fix it',
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid impact'))).toBe(true);
  });

  test('accepts valid plugin', () => {
    const result = validatePlugin({
      name: 'valid-plugin',
      checks: {
        ok: {
          id: 'V-001',
          name: 'Valid check',
          check: () => true,
          impact: 'high',
          category: 'custom',
          fix: 'Already fine',
        },
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe('mergePluginChecks', () => {
  test('adds custom checks to techniques with prefixed keys', () => {
    const techniques = {
      existing: { id: 1, name: 'Built-in', check: () => true, impact: 'high', category: 'memory' },
    };
    const plugins = [
      {
        name: 'my-plugin',
        checks: {
          customA: {
            id: 'CUSTOM-A',
            name: 'Custom A',
            check: () => false,
            impact: 'medium',
            category: 'custom',
            fix: 'Fix A',
          },
        },
      },
    ];
    const merged = mergePluginChecks(techniques, plugins);
    expect(merged.existing).toBeDefined();
    expect(merged['plugin:my-plugin:customA']).toBeDefined();
    expect(merged['plugin:my-plugin:customA'].id).toBe('CUSTOM-A');
    expect(merged['plugin:my-plugin:customA'].pluginName).toBe('my-plugin');
    expect(merged['plugin:my-plugin:customA'].confidence).toBe(0.5);
  });

  test('does not mutate original techniques', () => {
    const techniques = { a: { id: 1 } };
    const merged = mergePluginChecks(techniques, [
      { name: 'p', checks: { b: { id: 2, check: () => true, impact: 'low', category: 'x', fix: 'f', name: 'B' } } },
    ]);
    expect(techniques['plugin:p:b']).toBeUndefined();
    expect(merged['plugin:p:b']).toBeDefined();
  });

  test('preserves explicit confidence and sourceUrl', () => {
    const merged = mergePluginChecks({}, [
      {
        name: 'p',
        checks: {
          c: {
            id: 'C',
            name: 'C',
            check: () => true,
            impact: 'low',
            category: 'x',
            fix: 'f',
            sourceUrl: 'https://example.com',
            confidence: 0.9,
          },
        },
      },
    ]);
    expect(merged['plugin:p:c'].sourceUrl).toBe('https://example.com');
    expect(merged['plugin:p:c'].confidence).toBe(0.9);
  });
});

describe('Plugin checks in audit', () => {
  test('custom check appears in audit results', async () => {
    const dir = mkFixture('audit-plugin');
    try {
      // Create a plugin that checks for a specific file
      const configContent = `
module.exports = {
  plugins: [
    {
      name: 'audit-test',
      checks: {
        hasMarker: {
          id: 'AT-001',
          name: 'Marker file exists',
          check: (ctx) => ctx.files.includes('marker.txt'),
          impact: 'high',
          category: 'custom',
          fix: 'Create marker.txt',
        }
      }
    }
  ]
};
`;
      fs.writeFileSync(path.join(dir, 'nerviq.config.js'), configContent);
      // Without marker.txt - check should fail
      const result1 = await audit({ dir, silent: true });
      const pluginResult1 = result1.results.find(r => r.key === 'plugin:audit-test:hasMarker');
      expect(pluginResult1).toBeDefined();
      expect(pluginResult1.passed).toBe(false);
      expect(pluginResult1.name).toBe('Marker file exists');

      // Create marker.txt - check should pass
      fs.writeFileSync(path.join(dir, 'marker.txt'), 'present');
      const result2 = await audit({ dir, silent: true });
      const pluginResult2 = result2.results.find(r => r.key === 'plugin:audit-test:hasMarker');
      expect(pluginResult2).toBeDefined();
      expect(pluginResult2.passed).toBe(true);
    } finally {
      delete require.cache[path.join(dir, 'nerviq.config.js')];
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
