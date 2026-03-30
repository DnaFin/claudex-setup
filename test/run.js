const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claudex-setup-'));

  try {
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'fixture-app',
      version: '1.0.0',
      scripts: {
        test: 'echo test',
        lint: 'echo lint',
        build: 'echo build'
      }
    });

    fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src', 'index.js'),
      "module.exports = function hello() { return 'hello'; };\n"
    );

    const before = await audit({ dir: tempRoot, silent: true });
    assert.equal(typeof before.score, 'number');
    assert.ok(Array.isArray(before.results));
    assert.ok(before.results.length > 0);

    await setup({ dir: tempRoot, auto: true });

    assert.ok(fs.existsSync(path.join(tempRoot, 'CLAUDE.md')), 'CLAUDE.md should be created');
    assert.ok(fs.existsSync(path.join(tempRoot, '.claude', 'commands', 'test.md')), 'test command should be created');
    assert.ok(fs.existsSync(path.join(tempRoot, '.claude', 'agents', 'security-reviewer.md')), 'security reviewer should be created');

    const after = await audit({ dir: tempRoot, silent: true });
    assert.equal(typeof after.score, 'number');
    assert.ok(after.score >= before.score, 'score should not decrease after setup');

    console.log('claudex-setup smoke test passed');
    console.log(`score: ${before.score} -> ${after.score}`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
