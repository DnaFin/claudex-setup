const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { audit } = require('../src/audit');
const { AIDER_TECHNIQUES } = require('../src/aider/techniques');
const {
  buildEmptyRepo,
  buildRichAiderRepo,
  buildNoConfigRepo,
  buildGitOnlyRepo,
  buildDirtyAiderRepo,
} = require('./aider-fixtures');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ❌ ${name}: ${error.message}`);
  }
}

async function auditScenario(scenario) {
  return audit({ dir: scenario.dir, platform: 'aider', silent: true });
}

function resultByKey(report) {
  return Object.fromEntries(report.results.map((item) => [item.key, item.passed]));
}

function isCoreTechnique(technique) {
  return /^AD-[A-P]\d+$/.test(technique.id);
}

async function main() {
  console.log('\n  Aider Check Matrix\n');

  const scenarios = {
    empty: buildEmptyRepo(),
    rich: buildRichAiderRepo(),
    noConfig: buildNoConfigRepo(),
    gitOnly: buildGitOnlyRepo(),
    dirty: buildDirtyAiderRepo(),
  };

  const reports = {};
  for (const [name, scenario] of Object.entries(scenarios)) {
    reports[name] = resultByKey(await auditScenario(scenario));
  }

  const richNullables = new Set([
    'aiderSubtreeUsedForLargeRepos',
    'aiderRegulatedRepoHasGuardrails',
    'aiderCiExitCodeUnreliable',
  ]);

  const nullableChecks = new Set([
    ...richNullables,
    ...Object.entries(AIDER_TECHNIQUES)
      .filter(([, technique]) => !isCoreTechnique(technique))
      .map(([key]) => key),
  ]);

  const corePassExpectations = Object.fromEntries(
    Object.entries(AIDER_TECHNIQUES)
      .filter(([, technique]) => isCoreTechnique(technique))
      .map(([key]) => key)
      .filter((key) => !nullableChecks.has(key))
      .map((key) => [key, 'rich'])
  );

  const failExpectations = {
    aiderConfYmlExists: 'empty',
    aiderGitRepoExists: 'empty',
    aiderGitignoreCoversArtifacts: 'gitOnly',
    aiderDirtyTreeCheck: 'dirty',
    aiderUndoSafetyAware: 'noConfig',
    aiderEditorModelConfigured: 'noConfig',
    aiderWeakModelConfigured: 'noConfig',
    aiderModelSettingsFileExists: 'noConfig',
    aiderConventionFileExists: 'empty',
    aiderAiderignoreExists: 'noConfig',
    aiderEnvInGitignore: 'gitOnly',
    aiderChatHistoryExcluded: 'gitOnly',
    aiderCiWorkflowExists: 'noConfig',
    aiderGitHooksForPreCommit: 'noConfig',
    aiderEnvFileExists: 'noConfig',
    aiderBrowserModeForDocs: 'noConfig',
    aiderPlaywrightUrlScraping: 'noConfig',
    aiderInputHistoryExcluded: 'gitOnly',
    aiderVersionPinned: 'noConfig',
    aiderAllConfigSurfacesPresent: 'noConfig',
    aiderDocumentedWorkflow: 'gitOnly',
    aiderGitBranchStrategy: 'noConfig',
  };

  for (const [key, technique] of Object.entries(AIDER_TECHNIQUES)) {
    if (nullableChecks.has(key)) {
      test(`${key} exists and executes`, () => {
        assert.ok(technique, `${key} must exist in AIDER_TECHNIQUES`);
        assert.ok(typeof technique.check === 'function', `${key} must have a check function`);
        assert.ok(typeof technique.id === 'string' && technique.id.startsWith('AD-'), `${key} must have a valid AD- ID`);
      });

      if (richNullables.has(key)) {
        test(`${key} is currently nullable on rich`, () => {
          assert.strictEqual(reports.rich[key], null, `${key} expected null on rich but got ${reports.rich[key]}`);
        });
      }

      continue;
    }

    const passScenario = corePassExpectations[key];
    const failScenario = failExpectations[key];

    if (passScenario) {
      test(`${key} passes on ${passScenario}`, () => {
        assert.strictEqual(reports[passScenario][key], true, `${key} expected true on ${passScenario} but got ${reports[passScenario][key]}`);
      });
    }

    if (failScenario) {
      test(`${key} fails on ${failScenario}`, () => {
        assert.strictEqual(reports[failScenario][key], false, `${key} expected false on ${failScenario} but got ${reports[failScenario][key]}`);
      });
    }

    if (!passScenario && !failScenario) {
      test(`${key} exists in AIDER_TECHNIQUES`, () => {
        assert.ok(technique, `${key} must exist in AIDER_TECHNIQUES`);
        assert.ok(typeof technique.check === 'function', `${key} must have a check function`);
      });
    }
  }

  for (const scenario of Object.values(scenarios)) {
    fs.rmSync(scenario.dir, { recursive: true, force: true });
  }

  console.log('\n  ─────────────────────────────────────');
  console.log(`  Aider Check Matrix: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
