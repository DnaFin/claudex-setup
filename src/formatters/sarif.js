const path = require('path');
const { version } = require('../../package.json');

function levelFromImpact(impact) {
  if (impact === 'critical') return 'error';
  if (impact === 'high') return 'warning';
  return 'note';
}

function sanitizeUri(filePath) {
  if (!filePath) return null;
  return filePath.split(path.sep).join('/');
}

function buildRule(result) {
  return {
    id: result.id || result.key,
    name: result.key,
    shortDescription: { text: result.name },
    fullDescription: { text: result.fix || result.name },
    properties: {
      category: result.category,
      impact: result.impact,
      template: result.template || null,
    },
  };
}

function buildSarifResult(result, runRoot = '.') {
  const sarifResult = {
    ruleId: result.id || result.key,
    level: levelFromImpact(result.impact),
    message: {
      text: result.fix || result.name,
    },
    properties: {
      checkKey: result.key,
      category: result.category,
      impact: result.impact,
      passed: result.passed,
      platform: result.platform || null,
    },
  };

  if (result.file) {
    sarifResult.locations = [{
      physicalLocation: {
        artifactLocation: {
          uri: sanitizeUri(result.file),
          uriBaseId: '%SRCROOT%',
        },
        region: result.line ? { startLine: result.line } : undefined,
      },
    }];
  }

  if (runRoot) {
    sarifResult.properties.runRoot = sanitizeUri(runRoot);
  }

  return sarifResult;
}

function formatSarif(auditResult, options = {}) {
  const failedResults = (auditResult.results || [])
    .filter((result) => result.passed === false);

  const rules = [];
  const seenRuleIds = new Set();
  for (const result of failedResults) {
    const ruleId = result.id || result.key;
    if (seenRuleIds.has(ruleId)) continue;
    seenRuleIds.add(ruleId);
    rules.push(buildRule(result));
  }

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'nerviq',
          version,
          informationUri: 'https://github.com/nerviq/nerviq',
          rules,
        },
      },
      automationDetails: {
        id: auditResult.platform || 'claude',
      },
      properties: {
        platform: auditResult.platform,
        platformLabel: auditResult.platformLabel,
        platformVersion: auditResult.platformVersion || null,
        score: auditResult.score,
        organicScore: auditResult.organicScore,
        passed: auditResult.passed,
        failed: auditResult.failed,
        skipped: auditResult.skipped,
        checkCount: auditResult.checkCount,
      },
      originalUriBaseIds: {
        '%SRCROOT%': {
          uri: sanitizeUri(options.dir || '.'),
        },
      },
      results: failedResults.map((result) => buildSarifResult(result, options.dir || '.')),
    }],
  };
}

module.exports = {
  formatSarif,
};
