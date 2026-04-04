/**
 * Aider Patch Intelligence — managed blocks for YAML config
 *
 * Safe patching of existing Aider files using managed blocks.
 * Supports .aider.conf.yml (YAML comment blocks) and CONVENTIONS.md (HTML comment blocks).
 *
 * Managed blocks are sections that nerviq controls.
 * Hand-authored content outside managed blocks is preserved.
 */

const fs = require('fs');
const path = require('path');
const { writeRollbackArtifact, writeActivityArtifact } = require('../activity');

// Managed block markers
const MANAGED_START_MD = '<!-- nerviq:managed:start -->';
const MANAGED_END_MD = '<!-- nerviq:managed:end -->';
const MANAGED_START_YAML = '# <!-- nerviq:managed:start -->';
const MANAGED_END_YAML = '# <!-- nerviq:managed:end -->';

/**
 * Extract managed blocks from a file.
 */
function extractManagedBlock(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { before: content, managed: null, after: '' };
  }

  return {
    before: content.substring(0, startIdx),
    managed: content.substring(startIdx + startMarker.length, endIdx).trim(),
    after: content.substring(endIdx + endMarker.length),
  };
}

/**
 * Replace or insert a managed block in a file.
 */
function upsertManagedBlock(content, newManaged, startMarker, endMarker) {
  const { before, managed, after } = extractManagedBlock(content, startMarker, endMarker);

  if (managed !== null) {
    return `${before}${startMarker}\n${newManaged}\n${endMarker}${after}`;
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${startMarker}\n${newManaged}\n${endMarker}\n`;
}

/**
 * Patch CONVENTIONS.md with managed sections.
 */
function patchConventionsMd(existingContent, managedSections) {
  const newManaged = Object.entries(managedSections)
    .map(([section, content]) => `## ${section}\n${content}`)
    .join('\n\n');

  return upsertManagedBlock(existingContent, newManaged, MANAGED_START_MD, MANAGED_END_MD);
}

/**
 * Patch .aider.conf.yml by safely adding new keys.
 * Never weakens existing safety settings (auto-commits, etc.).
 * Only adds keys that don't already exist.
 */
function patchAiderConfYml(existingContent, newKeys) {
  const existingKeys = new Set();
  const lines = existingContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      existingKeys.add(trimmed.slice(0, colonIdx).trim());
    }
  }

  const additions = [];
  for (const [key, value] of Object.entries(newKeys)) {
    if (existingKeys.has(key)) continue;

    // Safety: never weaken these settings
    if (key === 'auto-commits' && value === false) continue;
    if (key === 'yes-always' && value === true) continue;

    if (typeof value === 'string') {
      additions.push(`${key}: "${value}"`);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      additions.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      additions.push(`${key}:`);
      for (const item of value) {
        additions.push(`  - ${item}`);
      }
    }
  }

  if (additions.length === 0) return existingContent;

  const newContent = additions.join('\n');
  return upsertManagedBlock(existingContent, newContent, MANAGED_START_YAML, MANAGED_END_YAML);
}

/**
 * Detect mixed-platform repo (e.g., has both .aider.conf.yml and CLAUDE.md).
 */
function detectMixedAiderRepo(ctx) {
  const platforms = [];

  if (ctx.fileContent('.aider.conf.yml')) platforms.push('aider');
  if (ctx.fileContent('CLAUDE.md') || ctx.fileContent('.claude/CLAUDE.md')) platforms.push('claude');
  if (ctx.fileContent('AGENTS.md') || ctx.fileContent('.codex')) platforms.push('codex');
  if (ctx.fileContent('.cursor/rules') || ctx.fileContent('.cursorrules')) platforms.push('cursor');
  if (ctx.fileContent('.github/copilot-instructions.md')) platforms.push('copilot');

  return {
    isMultiPlatform: platforms.length > 1,
    platforms,
    primaryPlatform: platforms[0] || null,
  };
}

/**
 * Generate a patch preview without writing.
 */
function generatePatchPreview(ctx, patches = {}) {
  const previews = [];

  if (patches.confYml) {
    const existing = ctx.configContent ? (ctx.configContent() || '') : '';
    const patched = existing
      ? patchAiderConfYml(existing, patches.confYml)
      : Object.entries(patches.confYml).map(([k, v]) => `${k}: ${v}`).join('\n');

    previews.push({
      file: '.aider.conf.yml',
      exists: Boolean(existing),
      unchanged: patched === existing,
      preview: patched,
    });
  }

  if (patches.conventions) {
    const existing = ctx.fileContent('CONVENTIONS.md') || '';
    const patched = existing
      ? patchConventionsMd(existing, patches.conventions)
      : Object.entries(patches.conventions).map(([s, c]) => `## ${s}\n${c}`).join('\n\n');

    previews.push({
      file: 'CONVENTIONS.md',
      exists: Boolean(existing),
      unchanged: patched === existing,
      preview: patched,
    });
  }

  return previews;
}

/**
 * Apply patches to disk with rollback support.
 */
function applyPatch(dir, filePath, newContent) {
  const fullPath = path.join(dir, filePath);
  const existed = fs.existsSync(fullPath);
  const originalContent = existed ? fs.readFileSync(fullPath, 'utf8') : null;

  if (existed && originalContent === newContent) {
    return { success: true, reason: 'unchanged', unchanged: true };
  }

  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  fs.writeFileSync(fullPath, newContent, 'utf8');

  const rollback = writeRollbackArtifact(dir, 'aider-patch', [filePath], {
    [filePath]: originalContent,
  });

  const activity = writeActivityArtifact(dir, 'aider-patch', {
    platform: 'aider',
    patchedFiles: [filePath],
    rollbackArtifact: rollback.relativePath,
  });

  return {
    success: true,
    reason: 'patched',
    unchanged: false,
    rollbackArtifact: rollback.relativePath,
    activityArtifact: activity.relativePath,
  };
}

module.exports = {
  MANAGED_START_MD,
  MANAGED_END_MD,
  MANAGED_START_YAML,
  MANAGED_END_YAML,
  extractManagedBlock,
  upsertManagedBlock,
  patchConventionsMd,
  patchAiderConfYml,
  detectMixedAiderRepo,
  generatePatchPreview,
  applyPatch,
};
