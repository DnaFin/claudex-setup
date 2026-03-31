/**
 * Project scanner + recommendation layer for augment and suggest-only modes.
 * Produces a structured repo-aware analysis without writing files.
 */

const path = require('path');
const { audit } = require('./audit');
const { ProjectContext } = require('./context');
const { STACKS } = require('./techniques');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
};

function c(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTomlSection(content, sectionName) {
  const pattern = new RegExp(`\\[${escapeRegex(sectionName)}\\]([\\s\\S]*?)(?:\\n\\s*\\[|$)`);
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function extractTomlValue(sectionContent, key) {
  if (!sectionContent) return null;
  const pattern = new RegExp(`^\\s*${escapeRegex(key)}\\s*=\\s*["']([^"']+)["']`, 'm');
  const match = sectionContent.match(pattern);
  return match ? match[1].trim() : null;
}

function detectProjectMetadata(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (pkg && (pkg.name || pkg.description)) {
    return {
      name: pkg.name || path.basename(ctx.dir),
      description: pkg.description || '',
    };
  }

  const pyproject = ctx.fileContent('pyproject.toml') || '';
  if (pyproject) {
    const projectSection = extractTomlSection(pyproject, 'project');
    const poetrySection = extractTomlSection(pyproject, 'tool.poetry');
    const name = extractTomlValue(projectSection, 'name') ||
      extractTomlValue(poetrySection, 'name');
    const description = extractTomlValue(projectSection, 'description') ||
      extractTomlValue(poetrySection, 'description');

    if (name || description) {
      return {
        name: name || path.basename(ctx.dir),
        description: description || '',
      };
    }
  }

  return {
    name: path.basename(ctx.dir),
    description: '',
  };
}

function detectMainDirs(ctx) {
  const candidates = [
    'src', 'lib', 'app', 'pages', 'components', 'api', 'routes', 'utils', 'helpers',
    'services', 'models', 'controllers', 'views', 'public', 'assets', 'config', 'tests',
    'test', '__tests__', 'spec', 'scripts', 'prisma', 'db', 'middleware', 'hooks',
    'agents', 'chains', 'workers', 'jobs', 'dags', 'macros', 'migrations',
    'src/components', 'src/app', 'src/pages', 'src/api', 'src/lib', 'src/hooks',
    'src/utils', 'src/services', 'src/models', 'src/middleware', 'src/agents',
    'src/chains', 'src/workers', 'src/jobs', 'src/app/api', 'app/api',
    'models/staging', 'models/marts'
  ];

  const dirs = [];
  for (const dir of candidates) {
    if (ctx.hasDir(dir)) {
      dirs.push(dir);
    }
  }
  return dirs;
}

function collectClaudeAssets(ctx) {
  const sharedSettings = ctx.jsonFile('.claude/settings.json');
  const localSettings = ctx.jsonFile('.claude/settings.local.json');
  const settings = sharedSettings || localSettings || null;

  const assetFiles = {
    claudeMd: ctx.fileContent('CLAUDE.md') ? 'CLAUDE.md' : (ctx.fileContent('.claude/CLAUDE.md') ? '.claude/CLAUDE.md' : null),
    settings: sharedSettings ? '.claude/settings.json' : (localSettings ? '.claude/settings.local.json' : null),
    commands: ctx.hasDir('.claude/commands') ? ctx.dirFiles('.claude/commands') : [],
    rules: ctx.hasDir('.claude/rules') ? ctx.dirFiles('.claude/rules') : [],
    hooks: ctx.hasDir('.claude/hooks') ? ctx.dirFiles('.claude/hooks') : [],
    agents: ctx.hasDir('.claude/agents') ? ctx.dirFiles('.claude/agents') : [],
    skills: ctx.hasDir('.claude/skills') ? ctx.dirFiles('.claude/skills') : [],
  };

  return {
    files: assetFiles,
    counts: {
      commands: assetFiles.commands.length,
      rules: assetFiles.rules.length,
      hooks: assetFiles.hooks.length,
      agents: assetFiles.agents.length,
      skills: assetFiles.skills.length,
      mcpServers: settings && settings.mcpServers ? Object.keys(settings.mcpServers).length : 0,
    },
    permissions: settings && settings.permissions ? {
      defaultMode: settings.permissions.defaultMode || null,
      hasDenyRules: Array.isArray(settings.permissions.deny) && settings.permissions.deny.length > 0,
    } : null,
    settingsSource: assetFiles.settings,
  };
}

function detectMaturity(assets) {
  let score = 0;
  if (assets.files.claudeMd) score += 2;
  if (assets.files.settings) score += 1;
  if (assets.counts.rules > 0) score += 1;
  if (assets.counts.commands > 0) score += 1;
  if (assets.counts.hooks > 0) score += 1;
  if (assets.counts.agents > 0) score += 1;
  if (assets.counts.skills > 0) score += 1;

  if (score === 0) return 'none';
  if (score <= 2) return 'starter';
  if (score <= 5) return 'developing';
  return 'mature';
}

function riskFromImpact(impact) {
  if (impact === 'critical') return 'high';
  if (impact === 'high') return 'medium';
  return 'low';
}

function moduleFromCategory(category) {
  const map = {
    memory: 'CLAUDE.md',
    quality: 'verification',
    git: 'safety',
    workflow: 'commands-agents-skills',
    security: 'permissions',
    automation: 'hooks',
    design: 'design-rules',
    devops: 'ci-devops',
    hygiene: 'project-hygiene',
    performance: 'context-management',
    tools: 'mcp-tools',
    prompting: 'prompt-structure',
    features: 'modern-claude-features',
    'quality-deep': 'quality-deep',
  };
  return map[category] || category;
}

function toStrengths(results) {
  return results
    .filter(r => r.passed === true)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    })
    .slice(0, 6)
    .map(r => ({
      key: r.key,
      name: r.name,
      category: r.category,
      note: `Already present and worth preserving: ${r.name}.`,
    }));
}

function toGaps(results) {
  return results
    .filter(r => r.passed === false)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    })
    .slice(0, 8)
    .map(r => ({
      key: r.key,
      name: r.name,
      impact: r.impact,
      category: r.category,
      fix: r.fix,
    }));
}

function toRecommendations(auditResult) {
  const failed = auditResult.results
    .filter(r => r.passed === false)
    .sort((a, b) => {
      const order = { critical: 3, high: 2, medium: 1, low: 0 };
      return (order[b.impact] || 0) - (order[a.impact] || 0);
    });

  return failed.slice(0, 10).map((r, index) => ({
    priority: index + 1,
    key: r.key,
    name: r.name,
    impact: r.impact,
    module: moduleFromCategory(r.category),
    risk: riskFromImpact(r.impact),
    why: r.fix,
  }));
}

function buildOptionalModules(stacks, assets) {
  const stackKeys = stacks.map(s => s.key);
  const modules = [];

  if (!assets.files.claudeMd) modules.push('CLAUDE.md baseline');
  if (assets.counts.commands === 0) modules.push('Slash commands');
  if (assets.counts.hooks === 0) modules.push('Hooks automation');
  if (!assets.permissions || !assets.permissions.hasDenyRules) modules.push('Permission safety profile');
  if (assets.counts.rules === 0) modules.push('Path-specific rules');
  if (stackKeys.some(k => ['react', 'nextjs', 'vue', 'angular', 'svelte'].includes(k))) modules.push('Frontend pack');
  if (stackKeys.some(k => ['node', 'python', 'django', 'fastapi', 'go', 'rust', 'java'].includes(k))) modules.push('Backend pack');
  if (stackKeys.some(k => ['docker', 'terraform', 'kubernetes'].includes(k))) modules.push('DevOps pack');
  if (assets.counts.agents === 0) modules.push('Specialized agents');

  return [...new Set(modules)].slice(0, 8);
}

function buildRiskNotes(auditResult, assets, maturity) {
  const notes = [];
  if (!assets.files.claudeMd) notes.push('No CLAUDE.md exists yet, so Claude has no persistent project-specific guidance.');
  if (assets.permissions && assets.permissions.defaultMode === 'bypassPermissions') {
    notes.push('Current settings use bypassPermissions, which is risky for broader team adoption.');
  }
  if (!assets.permissions || !assets.permissions.hasDenyRules) {
    notes.push('Permissions lack deny rules, so secret access and destructive commands are not strongly guarded.');
  }
  if (maturity === 'mature') {
    notes.push('This repo already has meaningful Claude assets, so augment mode should preserve existing structure instead of overwriting it.');
  }
  if (auditResult.results.some(r => r.key === 'ciPipeline' && r.passed === false)) {
    notes.push('Without CI enforcement, readiness can drift after setup.');
  }
  return notes.slice(0, 5);
}

function buildRolloutOrder(report) {
  const steps = [];
  if (!report.existingClaudeAssets.claudeMd) steps.push('Create a project-specific CLAUDE.md baseline');
  if (report.gapsIdentified.some(g => g.category === 'security')) steps.push('Add safe settings and deny rules');
  if (report.gapsIdentified.some(g => g.category === 'automation')) steps.push('Add hooks and automate verification');
  if (report.gapsIdentified.some(g => g.category === 'workflow')) steps.push('Add commands, rules, and specialization modules');
  if (report.gapsIdentified.some(g => g.category === 'devops')) steps.push('Connect CI threshold enforcement');
  if (steps.length === 0) steps.push('Tighten quality-deep items and preserve the current setup');
  return steps;
}

async function analyzeProject(options) {
  const mode = options.mode || 'augment';
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);
  const auditResult = await audit({ ...options, silent: true });
  const assets = collectClaudeAssets(ctx);
  const metadata = detectProjectMetadata(ctx);
  const maturity = detectMaturity(assets);
  const mainDirs = detectMainDirs(ctx);

  const report = {
    mode,
    writeBehavior: 'No files are written in this mode.',
    projectSummary: {
      name: metadata.name,
      description: metadata.description,
      directory: options.dir,
      stacks: stacks.map(s => s.label),
      maturity,
      score: auditResult.score,
      organicScore: auditResult.organicScore,
      checkCount: auditResult.checkCount,
    },
    detectedArchitecture: {
      repoType: stacks.length > 0 ? 'stack-detected repo' : 'generic repo',
      mainDirectories: mainDirs,
      stackSignals: stacks.map(s => s.key),
    },
    existingClaudeAssets: {
      claudeMd: assets.files.claudeMd,
      settings: assets.settingsSource,
      commands: assets.files.commands,
      rules: assets.files.rules,
      hooks: assets.files.hooks,
      agents: assets.files.agents,
      skills: assets.files.skills,
      mcpServers: assets.counts.mcpServers,
    },
    strengthsPreserved: toStrengths(auditResult.results),
    gapsIdentified: toGaps(auditResult.results),
    topNextActions: auditResult.quickWins,
    recommendedImprovements: toRecommendations(auditResult),
    riskNotes: buildRiskNotes(auditResult, assets, maturity),
    optionalModules: buildOptionalModules(stacks, assets),
  };

  report.suggestedRolloutOrder = buildRolloutOrder(report);
  return report;
}

function printAnalysis(report, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const modeLabel = report.mode === 'suggest-only' ? 'suggest-only' : report.mode;
  console.log('');
  console.log(c(`  claudex-setup ${modeLabel}`, 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));
  console.log(c(`  ${report.writeBehavior}`, 'dim'));
  console.log('');

  console.log(c('  Project Summary', 'blue'));
  console.log(`  ${report.projectSummary.name}${report.projectSummary.description ? ` — ${report.projectSummary.description}` : ''}`);
  console.log(c(`  Stack: ${report.projectSummary.stacks.join(', ') || 'Unknown'}`, 'dim'));
  console.log(c(`  Maturity: ${report.projectSummary.maturity} | Score: ${report.projectSummary.score}/100 | Organic: ${report.projectSummary.organicScore}/100`, 'dim'));
  console.log('');

  console.log(c('  Detected Architecture', 'blue'));
  console.log(c(`  Main directories: ${report.detectedArchitecture.mainDirectories.join(', ') || 'No strong structure detected yet'}`, 'dim'));
  console.log('');

  console.log(c('  Existing Claude Assets', 'blue'));
  console.log(c(`  CLAUDE.md: ${report.existingClaudeAssets.claudeMd || 'missing'}`, 'dim'));
  console.log(c(`  Settings: ${report.existingClaudeAssets.settings || 'missing'}`, 'dim'));
  console.log(c(`  Commands: ${report.existingClaudeAssets.commands.length} | Rules: ${report.existingClaudeAssets.rules.length} | Hooks: ${report.existingClaudeAssets.hooks.length} | Agents: ${report.existingClaudeAssets.agents.length} | Skills: ${report.existingClaudeAssets.skills.length}`, 'dim'));
  console.log('');

  if (report.strengthsPreserved.length > 0) {
    console.log(c('  Strengths Preserved', 'green'));
    for (const item of report.strengthsPreserved) {
      console.log(`  - ${item.name}`);
    }
    console.log('');
  }

  if (report.gapsIdentified.length > 0) {
    console.log(c('  Gaps Identified', 'yellow'));
    for (const item of report.gapsIdentified.slice(0, 5)) {
      console.log(`  - [${item.impact}] ${item.name}`);
      console.log(c(`    ${item.fix}`, 'dim'));
    }
    console.log('');
  }

  if (report.topNextActions.length > 0) {
    console.log(c('  Top 5 Next Actions', 'magenta'));
    report.topNextActions.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}`);
      console.log(c(`     ${item.fix}`, 'dim'));
    });
    console.log('');
  }

  if (report.riskNotes.length > 0) {
    console.log(c('  Risk Notes', 'red'));
    for (const note of report.riskNotes) {
      console.log(`  - ${note}`);
    }
    console.log('');
  }

  if (report.optionalModules.length > 0) {
    console.log(c('  Optional Modules', 'blue'));
    console.log(c(`  ${report.optionalModules.join(' | ')}`, 'dim'));
    console.log('');
  }

  if (report.suggestedRolloutOrder.length > 0) {
    console.log(c('  Suggested Rollout Order', 'blue'));
    report.suggestedRolloutOrder.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
    console.log('');
  }
}

module.exports = { analyzeProject, printAnalysis };
