const fs = require('fs');
const path = require('path');

const { version } = require('../package.json');
const { analyzeProject } = require('./analyze');
const { ProjectContext } = require('./context');
const { TECHNIQUES, STACKS } = require('./techniques');
const { TEMPLATES } = require('./setup');
const { writeActivityArtifact, writeRollbackArtifact } = require('./activity');

const TEMPLATE_DIR_MAP = {
  hooks: '.claude/hooks',
  commands: '.claude/commands',
  skills: '.claude/skills',
  rules: '.claude/rules',
  agents: '.claude/agents',
};

const TEMPLATE_LABELS = {
  'claude-md': 'CLAUDE.md baseline',
  hooks: 'Hooks bundle',
  commands: 'Slash commands',
  skills: 'Skills pack',
  rules: 'Rules pack',
  agents: 'Specialized agents',
};

const TEMPLATE_MODULES = {
  'claude-md': 'CLAUDE.md',
  hooks: 'hooks',
  commands: 'commands',
  skills: 'skills',
  rules: 'rules',
  agents: 'agents',
};

const IMPACT_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

function previewContent(content) {
  return content.split('\n').slice(0, 12).join('\n');
}

function riskFromImpact(impact) {
  if (impact === 'critical') return 'medium';
  if (impact === 'high') return 'medium';
  return 'low';
}

function getFailedTemplateGroups(ctx, only = []) {
  const groups = new Map();
  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    const passed = technique.check(ctx);
    if (passed !== false || !technique.template) continue;
    if (technique.template === 'mermaid') continue;
    if (only.length > 0 && !only.includes(key) && !only.includes(technique.template)) continue;
    if (!groups.has(technique.template)) {
      groups.set(technique.template, []);
    }
    groups.get(technique.template).push({ key, ...technique });
  }
  return groups;
}

function buildHookSettings(ctx, plannedHookFiles) {
  const existing = ctx.hasDir('.claude/hooks')
    ? ctx.dirFiles('.claude/hooks').filter(file => file.endsWith('.sh'))
    : [];
  const hookFiles = [...new Set([...existing, ...plannedHookFiles])].sort();
  if (hookFiles.length === 0 || ctx.fileContent('.claude/settings.json')) {
    return null;
  }

  const settings = {
    permissions: {
      defaultMode: 'acceptEdits',
      deny: [
        'Read(./.env*)',
        'Read(./secrets/**)',
        'Bash(rm -rf *)',
        'Bash(git reset --hard *)',
        'Bash(git checkout -- *)',
        'Bash(git clean *)',
        'Bash(git push --force *)',
      ],
    },
    hooks: {
      PostToolUse: [{
        matcher: 'Write|Edit',
        hooks: hookFiles.filter(file => file !== 'protect-secrets.sh').map(file => ({
          type: 'command',
          command: `bash .claude/hooks/${file}`,
          timeout: 10,
        })),
      }],
    },
  };

  if (hookFiles.includes('protect-secrets.sh')) {
    settings.hooks.PreToolUse = [{
      matcher: 'Read|Write|Edit',
      hooks: [{
        type: 'command',
        command: 'bash .claude/hooks/protect-secrets.sh',
        timeout: 5,
      }],
    }];
  }

  return {
    path: '.claude/settings.json',
    content: `${JSON.stringify(settings, null, 2)}\n`,
  };
}

function buildTemplateFiles(templateKey, stacks, ctx) {
  const template = TEMPLATES[templateKey];
  if (!template) return [];

  const result = template(stacks, ctx);
  if (typeof result === 'string') {
    return [{ path: 'CLAUDE.md', content: result }];
  }

  const targetDir = TEMPLATE_DIR_MAP[templateKey];
  if (!targetDir) return [];

  return Object.entries(result).map(([fileName, content]) => ({
    path: path.posix.join(targetDir.replace(/\\/g, '/'), fileName),
    content,
  }));
}

function toProposal(templateKey, triggers, templateFiles, ctx) {
  const sortedTriggers = [...triggers].sort((a, b) => {
    const impactA = IMPACT_ORDER[a.impact] ?? 0;
    const impactB = IMPACT_ORDER[b.impact] ?? 0;
    return impactB - impactA;
  });
  const highestImpact = sortedTriggers[0]?.impact || 'medium';
  const files = templateFiles.map(file => {
    const exists = ctx.fileContent(file.path) !== null || ctx.hasDir(file.path);
    const action = exists ? 'manual-review' : 'create';
    const currentState = exists ? 'file already exists and will be preserved' : 'missing';
    const proposedState = exists ? 'generated baseline available for manual merge' : 'create new file';
    const diffPreview = [
      `--- ${exists ? file.path : 'missing'}`,
      `+++ ${file.path}`,
      ...previewContent(file.content).split('\n').map(line => `+${line}`),
    ].join('\n');
    return {
      path: file.path,
      action,
      currentState,
      proposedState,
      bytes: Buffer.byteLength(file.content, 'utf8'),
      content: file.content,
      preview: previewContent(file.content),
      diffPreview,
    };
  });

  return {
    id: templateKey,
    title: TEMPLATE_LABELS[templateKey] || templateKey,
    module: TEMPLATE_MODULES[templateKey] || templateKey,
    risk: riskFromImpact(highestImpact),
    confidence: sortedTriggers.length >= 2 ? 'high' : 'medium',
    triggers: sortedTriggers.map(trigger => ({
      key: trigger.key,
      name: trigger.name,
      impact: trigger.impact,
      fix: trigger.fix,
    })),
    rationale: sortedTriggers.map(trigger => trigger.fix),
    files,
    readyToApply: files.some(file => file.action === 'create'),
  };
}

async function buildProposalBundle(options) {
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const report = await analyzeProject({ ...options, mode: 'augment' });
  const groups = getFailedTemplateGroups(ctx, options.only || []);
  const proposals = [];

  for (const [templateKey, triggers] of groups.entries()) {
    const templateFiles = buildTemplateFiles(templateKey, stacks, ctx);
    if (templateKey === 'hooks') {
      const plannedHookFiles = templateFiles
        .map(file => path.basename(file.path))
        .filter(file => file.endsWith('.sh'));
      const settingsFile = buildHookSettings(ctx, plannedHookFiles);
      if (settingsFile) {
        templateFiles.push(settingsFile);
      }
    }
    proposals.push(toProposal(templateKey, triggers, templateFiles, ctx));
  }

  proposals.sort((a, b) => {
    const impactA = IMPACT_ORDER[a.triggers[0]?.impact] ?? 0;
    const impactB = IMPACT_ORDER[b.triggers[0]?.impact] ?? 0;
    return impactB - impactA;
  });

  return {
    schemaVersion: 1,
    generatedBy: `claudex-setup@${version}`,
    createdAt: new Date().toISOString(),
    directory: options.dir,
    projectSummary: report.projectSummary,
    strengthsPreserved: report.strengthsPreserved,
    topNextActions: report.topNextActions,
    riskNotes: report.riskNotes,
    proposals,
  };
}

function printProposalBundle(bundle, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  console.log('');
  console.log('  claudex-setup plan');
  console.log('  ═══════════════════════════════════════');
  console.log(`  ${bundle.projectSummary.name} | maturity=${bundle.projectSummary.maturity} | score=${bundle.projectSummary.score}/100`);
  console.log('');

  if (bundle.proposals.length === 0) {
    console.log('  No templated proposals are needed right now.');
    console.log('');
    return;
  }

  console.log('  Proposal Bundles');
  for (const proposal of bundle.proposals) {
    const applyState = proposal.readyToApply ? 'ready' : 'manual-review';
    console.log(`  - ${proposal.id} [${applyState}]`);
    console.log(`    ${proposal.title} | risk=${proposal.risk} | confidence=${proposal.confidence}`);
    console.log(`    triggers: ${proposal.triggers.map(item => item.name).join(', ')}`);
    console.log(`    files: ${proposal.files.map(file => `${file.path} (${file.action})`).join(', ')}`);
  }
  console.log('');
}

function writePlanFile(bundle, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2), 'utf8');
  return writeActivityArtifact(bundle.directory, 'plan-export', {
    exportedPlan: outFile,
    proposalIds: bundle.proposals.map(proposal => proposal.id),
    proposalCount: bundle.proposals.length,
  });
}

function resolvePlan(bundle, options) {
  if (options.planFile) {
    return JSON.parse(fs.readFileSync(options.planFile, 'utf8'));
  }
  return bundle;
}

async function applyProposalBundle(options) {
  const liveBundle = options.planFile ? null : await buildProposalBundle(options);
  const bundle = resolvePlan(liveBundle, options);
  const selectedIds = options.only && options.only.length > 0
    ? new Set(options.only)
    : null;
  const selected = bundle.proposals.filter(proposal => {
    if (selectedIds && !selectedIds.has(proposal.id)) return false;
    return proposal.readyToApply;
  });

  const createdFiles = [];
  const skippedFiles = [];
  for (const proposal of selected) {
    for (const file of proposal.files) {
      if (file.action !== 'create') {
        skippedFiles.push(file.path);
        continue;
      }
      const fullPath = path.join(options.dir, file.path);
      if (fs.existsSync(fullPath)) {
        skippedFiles.push(file.path);
        continue;
      }
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content, 'utf8');
      }
      createdFiles.push(file.path);
    }
  }

  let rollback = null;
  let activity = null;
  if (!options.dryRun && createdFiles.length > 0) {
    rollback = writeRollbackArtifact(options.dir, {
      sourcePlan: options.planFile ? path.basename(options.planFile) : 'live-plan',
      createdFiles,
      rollbackInstructions: createdFiles.map(file => `Delete ${file}`),
    });
    activity = writeActivityArtifact(options.dir, 'apply', {
      sourcePlan: options.planFile ? path.basename(options.planFile) : 'live-plan',
      appliedProposalIds: selected.map(item => item.id),
      createdFiles,
      skippedFiles,
      rollbackArtifact: rollback.relativePath,
    });
  }

  return {
    proposalCount: bundle.proposals.length,
    appliedProposalIds: selected.map(item => item.id),
    createdFiles,
    skippedFiles,
    dryRun: options.dryRun === true,
    rollbackArtifact: rollback ? rollback.relativePath : null,
    activityArtifact: activity ? activity.relativePath : null,
  };
}

function printApplyResult(result, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log('  claudex-setup apply');
  console.log('  ═══════════════════════════════════════');
  if (result.dryRun) {
    console.log('  Dry-run only. No files were written.');
  }
  console.log(`  Applied proposal bundles: ${result.appliedProposalIds.join(', ') || 'none'}`);
  console.log(`  Created files: ${result.createdFiles.join(', ') || 'none'}`);
  if (result.rollbackArtifact) {
    console.log(`  Rollback: ${result.rollbackArtifact}`);
  }
  if (result.activityArtifact) {
    console.log(`  Activity log: ${result.activityArtifact}`);
  }
  console.log('');
}

module.exports = {
  buildProposalBundle,
  printProposalBundle,
  writePlanFile,
  applyProposalBundle,
  printApplyResult,
};
