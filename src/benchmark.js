const fs = require('fs');
const os = require('os');
const path = require('path');

const { version } = require('../package.json');
const { audit } = require('./audit');
const { setup } = require('./setup');
const { analyzeProject } = require('./analyze');
const { getGovernanceSummary } = require('./governance');

function copyProject(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__pycache__') {
      continue;
    }
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyProject(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    } else if (entry.isSymbolicLink && entry.isSymbolicLink()) {
      // Symlinks are skipped in benchmark sandbox — log for awareness
      process.stderr.write(`  Note: symlink skipped in benchmark: ${entry.name}\n`);
    }
  }
}

function summarizeAudit(result) {
  return {
    score: result.score,
    organicScore: result.organicScore,
    passed: result.passed,
    failed: result.failed,
    checkCount: result.checkCount,
    quickWins: result.quickWins,
  };
}

function buildWorkflowEvidence(before, after, analysisReport, governanceSummary) {
  const tasks = [
    {
      key: 'discover-without-writes',
      label: 'Discover next actions without writing files',
      passed: before.checkCount > 0 && Array.isArray(before.quickWins),
      evidence: `Baseline audit returned ${before.checkCount} applicable checks and ${before.quickWins.length} quick wins.`,
    },
    {
      key: 'starter-safe-improvement',
      label: 'Apply starter-safe improvements in isolation',
      passed: after.score >= before.score && after.failed <= before.failed,
      evidence: `Score moved ${before.score} -> ${after.score}; failed checks moved ${before.failed} -> ${after.failed}.`,
    },
    {
      key: 'governed-rollout-surface',
      label: 'Expose governed rollout controls',
      passed: governanceSummary.permissionProfiles.length >= 3 && governanceSummary.hookRegistry.length >= 1,
      evidence: `${governanceSummary.permissionProfiles.length} profiles and ${governanceSummary.hookRegistry.length} governed hooks available.`,
    },
    {
      key: 'domain-pack-guidance',
      label: 'Recommend a domain pack for the repo',
      passed: analysisReport.recommendedDomainPacks.length > 0,
      evidence: analysisReport.recommendedDomainPacks.map(pack => pack.label).join(', ') || 'No domain pack recommendation generated.',
    },
    {
      key: 'mcp-pack-guidance',
      label: 'Recommend MCP packs when appropriate',
      passed: analysisReport.recommendedMcpPacks.length > 0,
      evidence: analysisReport.recommendedMcpPacks.map(pack => pack.label).join(', ') || 'No MCP pack recommendation generated.',
    },
  ];

  const passed = tasks.filter(task => task.passed).length;
  const total = tasks.length;
  return {
    taskPack: 'maintainer-core',
    tasks,
    summary: {
      passed,
      total,
      coverageScore: total > 0 ? Math.round((passed / total) * 100) : 0,
    },
  };
}

function buildExecutiveSummary(before, after, workflowEvidence) {
  const scoreDelta = after.score - before.score;
  const organicDelta = after.organicScore - before.organicScore;
  const workflowCoverage = workflowEvidence.summary.coverageScore;
  let headline = 'Benchmark did not improve the score in this run.';

  if (scoreDelta < 0) {
    headline = `Warning: score decreased by ${Math.abs(scoreDelta)} points. Setup may have introduced a regression.`;
  } else if (scoreDelta > 0) {
    headline = `Benchmark improved readiness by ${scoreDelta} points without touching the original repo.`;
  } else if (before.score >= 85 && after.score >= before.score && workflowCoverage >= 80) {
    headline = 'Benchmark confirmed the repo already meets the starter-safe baseline without regression.';
  }

  return {
    headline,
    scoreDelta,
    organicDelta,
    decisionGuidance: scoreDelta >= 20
      ? 'Strong pilot candidate'
      : scoreDelta >= 10
        ? 'Promising but needs manual review'
        : (before.score >= 85 && workflowCoverage >= 80
          ? 'Use suggest-only mode, domain packs, or task-level benchmarks next'
          : 'Use suggest-only mode before rollout'),
  };
}

function buildCaseStudy(before, after, applyResult) {
  return {
    initialState: `Baseline score ${before.score}/100, organic ${before.organicScore}/100.`,
    chosenMode: 'benchmark-on-isolated-copy',
    whatChanged: applyResult.writtenFiles,
    whatWasPreserved: applyResult.preservedFiles,
    measuredResults: {
      scoreDelta: after.score - before.score,
      organicDelta: after.organicScore - before.organicScore,
      passedDelta: after.passed - before.passed,
    },
  };
}

function renderBenchmarkMarkdown(report) {
  return [
    '# Claudex Setup Benchmark Report',
    '',
    `- Generated by: ${report.generatedBy}`,
    `- Created at: ${report.createdAt}`,
    `- Source repo: ${report.directory}`,
    '',
    '## Methodology',
    ...report.methodology.map(item => `- ${item}`),
    '',
    '## Before',
    `- Score: ${report.before.score}/100`,
    `- Organic score: ${report.before.organicScore}/100`,
    `- Passing checks: ${report.before.passed}/${report.before.checkCount}`,
    '',
    '## After',
    `- Score: ${report.after.score}/100`,
    `- Organic score: ${report.after.organicScore}/100`,
    `- Passing checks: ${report.after.passed}/${report.after.checkCount}`,
    '',
    '## Delta',
    `- Score delta: ${report.delta.score}`,
    `- Organic score delta: ${report.delta.organicScore}`,
    `- Passed checks delta: ${report.delta.passed}`,
    '',
    '## Executive Summary',
    `- ${report.executiveSummary.headline}`,
    `- Recommendation: ${report.executiveSummary.decisionGuidance}`,
    '',
    '## Workflow Evidence',
    `- Task pack: ${report.workflowEvidence.taskPack}`,
    `- Coverage: ${report.workflowEvidence.summary.passed}/${report.workflowEvidence.summary.total} (${report.workflowEvidence.summary.coverageScore}%)`,
    ...report.workflowEvidence.tasks.map(task => `- ${task.label}: ${task.passed ? 'pass' : 'not yet'} — ${task.evidence}`),
    '',
    '## Case Study',
    `- Initial state: ${report.caseStudy.initialState}`,
    `- Chosen mode: ${report.caseStudy.chosenMode}`,
    `- What changed: ${report.caseStudy.whatChanged.join(', ') || 'none'}`,
    `- What was preserved: ${report.caseStudy.whatWasPreserved.join(', ') || 'none'}`,
    '',
  ].join('\n');
}

async function runBenchmark(options) {
  const before = await audit({ dir: options.dir, silent: true });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claudex-benchmark-'));
  const sandboxDir = path.join(tempRoot, 'repo');

  try {
    copyProject(options.dir, sandboxDir);
    const applyResult = await setup({
      dir: sandboxDir,
      auto: true,
      silent: true,
      profile: options.profile,
      mcpPacks: options.mcpPacks || [],
    });
    const after = await audit({ dir: sandboxDir, silent: true });
    const analysisReport = await analyzeProject({ dir: sandboxDir, mode: 'suggest-only' });
    const governanceSummary = getGovernanceSummary();
    const workflowEvidence = buildWorkflowEvidence(before, after, analysisReport, governanceSummary);

    return {
      schemaVersion: 1,
      generatedBy: `claudex-setup@${version}`,
      createdAt: new Date().toISOString(),
      directory: options.dir,
      methodology: [
        'Run a baseline audit on the source repo.',
        'Copy the repo into a temporary isolated workspace.',
        'Apply starter-safe Claude artifacts only on the isolated copy.',
        'Re-run the audit and compare the results.',
      ],
      before: summarizeAudit(before),
      after: summarizeAudit(after),
      delta: {
        score: after.score - before.score,
        organicScore: after.organicScore - before.organicScore,
        passed: after.passed - before.passed,
        failed: after.failed - before.failed,
      },
      workflowEvidence,
      executiveSummary: buildExecutiveSummary(before, after, workflowEvidence),
      caseStudy: buildCaseStudy(before, after, applyResult),
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function printBenchmark(report, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('');
  console.log('  claudex-setup benchmark');
  console.log('  ═══════════════════════════════════════');
  console.log('  Runs in an isolated temp copy. Your current repo is not modified.');
  console.log('');
  console.log(`  Before:  ${report.before.score}/100 (organic ${report.before.organicScore}/100)`);
  console.log(`  After:   ${report.after.score}/100 (organic ${report.after.organicScore}/100)`);
  console.log(`  Delta:   score ${report.delta.score >= 0 ? '+' : ''}${report.delta.score}, organic ${report.delta.organicScore >= 0 ? '+' : ''}${report.delta.organicScore}`);
  console.log('');
  console.log(`  ${report.executiveSummary.headline}`);
  console.log(`  Recommendation: ${report.executiveSummary.decisionGuidance}`);
  console.log(`  Workflow evidence: ${report.workflowEvidence.summary.passed}/${report.workflowEvidence.summary.total} tasks (${report.workflowEvidence.summary.coverageScore}%)`);
  console.log('');
}

function writeBenchmarkReport(report, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const content = path.extname(outFile).toLowerCase() === '.md'
    ? renderBenchmarkMarkdown(report)
    : JSON.stringify(report, null, 2);
  fs.writeFileSync(outFile, content, 'utf8');
}

module.exports = {
  runBenchmark,
  printBenchmark,
  writeBenchmarkReport,
};
