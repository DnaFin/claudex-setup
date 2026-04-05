/**
 * Platform Addition Wizard
 * Helps users add a new platform config to their project.
 */

const fs = require('fs');
const path = require('path');
const { detectActivePlatforms, PLATFORM_SIGNATURES } = require('./canon');
const { applyHarmonySync } = require('./sync');

const PLATFORM_BOOTSTRAPS = {
  claude: { files: [{ path: 'CLAUDE.md', content: '# Project Instructions\n\nAdd your Claude Code instructions here.\n' }] },
  codex: { files: [{ path: 'AGENTS.md', content: '# Agents Instructions\n\nAdd your Codex instructions here.\n' }] },
  gemini: { files: [{ path: 'GEMINI.md', content: '# Gemini Instructions\n\nAdd your Gemini CLI instructions here.\n' }] },
  copilot: { files: [{ path: '.github/copilot-instructions.md', content: '# Copilot Instructions\n\nAdd your GitHub Copilot instructions here.\n' }] },
  cursor: { files: [{ path: '.cursorrules', content: '# Cursor Rules\n\nAdd your Cursor rules here.\n' }] },
  windsurf: { files: [{ path: '.windsurfrules', content: '# Windsurf Rules\n\nAdd your Windsurf rules here.\n' }] },
  aider: { files: [{ path: '.aider.conf.yml', content: '# Aider Configuration\n# See: https://aider.chat/docs/config/aider_conf.html\n' }] },
  opencode: { files: [{ path: 'opencode.json', content: '{\n  "instructions": "Add your OpenCode instructions here."\n}\n' }] },
};

function addPlatform(dir, platformKey) {
  // Validate platform
  if (!PLATFORM_SIGNATURES[platformKey]) {
    return { success: false, error: `Unknown platform: ${platformKey}. Available: ${Object.keys(PLATFORM_SIGNATURES).join(', ')}` };
  }

  // Check if already active
  const active = detectActivePlatforms(dir);
  const alreadyActive = active.find(p => p.platform === platformKey);
  if (alreadyActive) {
    return { success: false, error: `${platformKey} is already active in this project.` };
  }

  const beforeCount = active.length;
  const bootstrap = PLATFORM_BOOTSTRAPS[platformKey];
  const created = [];

  // Create bootstrap files
  for (const file of bootstrap.files) {
    const fullPath = path.join(dir, file.path);
    if (fs.existsSync(fullPath)) continue;
    const dirName = path.dirname(fullPath);
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf8');
    created.push(file.path);
  }

  // Run harmony sync to populate managed blocks
  let syncResult = null;
  try {
    syncResult = applyHarmonySync(dir);
  } catch { /* sync is optional */ }

  const afterActive = detectActivePlatforms(dir);
  const afterCount = afterActive.length;

  return {
    success: true,
    platform: platformKey,
    created,
    beforeCount,
    afterCount,
    syncApplied: syncResult ? syncResult.applied.length : 0,
  };
}

module.exports = { addPlatform, PLATFORM_BOOTSTRAPS };
