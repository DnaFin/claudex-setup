/**
 * S8. Adaptive Project Configuration
 *
 * Detects project changes and propagates configuration updates
 * across all active platforms automatically.
 */

const fs = require('fs');
const path = require('path');

const PLATFORM_CONFIG_FILES = {
  claude: ['CLAUDE.md', '.claude/settings.json', '.claude/commands', '.claude/rules'],
  codex: ['AGENTS.md', 'codex.json', '.codex'],
  gemini: ['GEMINI.md', '.gemini/settings.json'],
  copilot: ['.github/copilot-instructions.md', '.github/copilot'],
  cursor: ['.cursor/rules', '.cursorrules'],
};

const CHANGE_DETECTORS = [
  {
    type: 'new-api-route',
    detect: (current, previous) => {
      const currentRoutes = (current.routes || []);
      const previousRoutes = (previous.routes || []);
      const newRoutes = currentRoutes.filter(r => !previousRoutes.includes(r));
      return newRoutes.length > 0 ? { newRoutes } : null;
    },
    impact: (data) => ({
      description: `New API route(s): ${data.newRoutes.join(', ')}`,
      affectedPlatforms: ['claude', 'codex', 'gemini', 'copilot', 'cursor'],
      recommendedAction: 'Update architecture documentation in all instruction files',
      priority: 'medium',
    }),
  },
  {
    type: 'new-dependency',
    detect: (current, previous) => {
      const currentDeps = Object.keys(current.dependencies || {});
      const previousDeps = Object.keys(previous.dependencies || {});
      const newDeps = currentDeps.filter(d => !previousDeps.includes(d));
      return newDeps.length > 0 ? { newDeps } : null;
    },
    impact: (data) => ({
      description: `New dependencies: ${data.newDeps.join(', ')}`,
      affectedPlatforms: ['claude', 'codex', 'gemini', 'copilot', 'cursor'],
      recommendedAction: 'Add dependency context to instruction files; check for MCP pack needs',
      priority: 'low',
    }),
  },
  {
    type: 'new-ci-workflow',
    detect: (current, previous) => {
      const currentCI = (current.ciWorkflows || []);
      const previousCI = (previous.ciWorkflows || []);
      const newCI = currentCI.filter(w => !previousCI.includes(w));
      return newCI.length > 0 ? { newCI } : null;
    },
    impact: (data) => ({
      description: `New CI workflow(s): ${data.newCI.join(', ')}`,
      affectedPlatforms: ['claude', 'codex', 'copilot'],
      recommendedAction: 'Align CI review commands across platforms',
      priority: 'medium',
    }),
  },
  {
    type: 'new-database',
    detect: (current, previous) => {
      const currentDBs = (current.databases || []);
      const previousDBs = (previous.databases || []);
      const newDBs = currentDBs.filter(db => !previousDBs.includes(db));
      return newDBs.length > 0 ? { newDBs } : null;
    },
    impact: (data) => ({
      description: `New database(s): ${data.newDBs.join(', ')}`,
      affectedPlatforms: ['claude', 'codex', 'gemini', 'copilot', 'cursor'],
      recommendedAction: 'Add database MCP on all platforms; update architecture docs',
      priority: 'high',
    }),
  },
  {
    type: 'stack-change',
    detect: (current, previous) => {
      const currentStacks = (current.stacks || []);
      const previousStacks = (previous.stacks || []);
      const added = currentStacks.filter(s => !previousStacks.includes(s));
      const removed = previousStacks.filter(s => !currentStacks.includes(s));
      return (added.length > 0 || removed.length > 0) ? { added, removed } : null;
    },
    impact: (data) => ({
      description: `Stack changes — added: ${data.added.join(', ') || 'none'}, removed: ${data.removed.join(', ') || 'none'}`,
      affectedPlatforms: ['claude', 'codex', 'gemini', 'copilot', 'cursor'],
      recommendedAction: 'Reconfigure domain packs and technique checks for new stack',
      priority: 'high',
    }),
  },
  {
    type: 'config-file-change',
    detect: (current, previous) => {
      const currentConfigs = (current.configFiles || []);
      const previousConfigs = (previous.configFiles || []);
      const changed = currentConfigs.filter(c => !previousConfigs.includes(c));
      return changed.length > 0 ? { changed } : null;
    },
    impact: (data) => ({
      description: `Config file changes: ${data.changed.join(', ')}`,
      affectedPlatforms: ['claude', 'codex', 'gemini', 'copilot', 'cursor'],
      recommendedAction: 'Review and sync configuration changes across platforms',
      priority: 'low',
    }),
  },
];

/**
 * Build a simple canonical model of the project state for comparison.
 */
function buildSimpleCanon(dir) {
  const canon = {
    dependencies: {},
    routes: [],
    ciWorkflows: [],
    databases: [],
    stacks: [],
    configFiles: [],
  };

  // Read package.json dependencies
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    canon.dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect databases from dependencies
    const dbIndicators = {
      pg: 'postgres', mysql2: 'mysql', mongodb: 'mongodb', mongoose: 'mongodb',
      redis: 'redis', ioredis: 'redis', sqlite3: 'sqlite', prisma: 'prisma',
      typeorm: 'typeorm', sequelize: 'sequelize',
    };
    for (const dep of Object.keys(canon.dependencies)) {
      if (dbIndicators[dep]) canon.databases.push(dbIndicators[dep]);
    }
  } catch { /* no package.json */ }

  // Detect CI workflows
  try {
    const ghDir = path.join(dir, '.github', 'workflows');
    if (fs.existsSync(ghDir)) {
      canon.ciWorkflows = fs.readdirSync(ghDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    }
  } catch { /* no workflows */ }

  // Detect config files
  for (const configs of Object.values(PLATFORM_CONFIG_FILES)) {
    for (const configPath of configs) {
      try {
        if (fs.existsSync(path.join(dir, configPath))) {
          canon.configFiles.push(configPath);
        }
      } catch { /* skip */ }
    }
  }

  return canon;
}

/**
 * Detect project changes by comparing current state against previous canon.
 *
 * @param {string} dir - Project directory
 * @param {Object} previousCanon - Previous canonical model (from last run)
 * @returns {Object} Detected changes with cross-platform impact
 */
function detectProjectChanges(dir, previousCanon) {
  const currentCanon = buildSimpleCanon(dir);
  const prev = previousCanon || {};
  const changes = [];

  for (const detector of CHANGE_DETECTORS) {
    const data = detector.detect(currentCanon, prev);
    if (data) {
      const impact = detector.impact(data);
      changes.push({
        type: detector.type,
        ...impact,
        data,
      });
    }
  }

  return {
    changes,
    currentCanon,
    summary: changes.length > 0
      ? `${changes.length} change(s) detected affecting ${new Set(changes.flatMap(c => c.affectedPlatforms)).size} platform(s)`
      : 'No changes detected',
  };
}

/**
 * Generate platform-native configuration updates for detected changes.
 *
 * @param {Object[]} changes - Changes from detectProjectChanges
 * @returns {Object} Platform-specific update instructions
 */
function generateAdaptiveUpdates(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { updates: [], summary: 'No changes to propagate' };
  }

  const updates = [];

  for (const change of changes) {
    const platforms = change.affectedPlatforms || [];

    for (const platform of platforms) {
      const configFiles = PLATFORM_CONFIG_FILES[platform] || [];
      const primaryConfig = configFiles[0];
      if (!primaryConfig) continue;

      let content = '';
      let action = 'append';

      switch (change.type) {
        case 'new-api-route':
          content = `\n## API Routes (auto-detected)\n${(change.data.newRoutes || []).map(r => `- ${r}`).join('\n')}\n`;
          break;
        case 'new-dependency':
          content = `\n<!-- New dependencies: ${(change.data.newDeps || []).join(', ')} -->\n`;
          action = 'append';
          break;
        case 'new-database':
          content = `\n## Database\nThis project uses: ${(change.data.newDBs || []).join(', ')}\n`;
          break;
        case 'new-ci-workflow':
          content = `\n## CI/CD\nWorkflows: ${(change.data.newCI || []).join(', ')}\n`;
          break;
        case 'stack-change':
          content = `\n## Stack Update\nAdded: ${(change.data.added || []).join(', ') || 'none'}\nRemoved: ${(change.data.removed || []).join(', ') || 'none'}\n`;
          break;
        default:
          content = `\n<!-- Change detected: ${change.description} -->\n`;
      }

      updates.push({
        platform,
        file: primaryConfig,
        action,
        content,
        reason: change.description,
        priority: change.priority || 'low',
      });
    }
  }

  const affectedPlatforms = new Set(updates.map(u => u.platform));

  return {
    updates,
    summary: `${changes.length} change(s) detected, ${affectedPlatforms.size} platform(s) affected, ${updates.length} update(s) generated`,
  };
}

module.exports = { detectProjectChanges, generateAdaptiveUpdates };
