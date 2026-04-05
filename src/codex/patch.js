/**
 * Codex Patch Intelligence — CP-09
 *
 * Safe patching of existing Codex files using managed blocks.
 * Supports AGENTS.md (HTML comment blocks) and config.toml (TOML comment blocks).
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
const MANAGED_START_TOML = '# <!-- nerviq:managed:start -->';
const MANAGED_END_TOML = '# <!-- nerviq:managed:end -->';

/**
 * Extract managed blocks from a file.
 * Returns { before, managed, after } where managed is the content between markers.
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
 * If the file already has managed markers, replace the content between them.
 * If not, append the managed block at the end.
 */
function upsertManagedBlock(content, newManaged, startMarker, endMarker) {
  const { before, managed, after } = extractManagedBlock(content, startMarker, endMarker);

  if (managed !== null) {
    // Replace existing managed block
    return `${before}${startMarker}\n${newManaged}\n${endMarker}${after}`;
  }

  // Append new managed block
  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${startMarker}\n${newManaged}\n${endMarker}\n`;
}

/**
 * Patch AGENTS.md with managed sections.
 * Preserves all hand-authored content.
 */
function patchAgentsMd(existingContent, managedSections) {
  const newManaged = Object.entries(managedSections)
    .map(([section, content]) => `## ${section}\n${content}`)
    .join('\n\n');

  return upsertManagedBlock(existingContent, newManaged, MANAGED_START_MD, MANAGED_END_MD);
}

/**
 * Patch config.toml by safely adding new sections.
 * Never weakens existing sandbox or approval posture.
 * Only adds new [section] blocks that don't already exist.
 */
function patchConfigToml(existingContent, newSections) {
  const existingSections = new Set();
  const sectionPattern = /^\[([^\]]+)\]/gm;
  let match;
  while ((match = sectionPattern.exec(existingContent)) !== null) {
    existingSections.add(match[1]);
  }

  const additions = [];
  for (const [section, content] of Object.entries(newSections)) {
    if (!existingSections.has(section)) {
      additions.push(`[${section}]\n${content}`);
    }
  }

  if (additions.length === 0) return existingContent;

  const newManaged = additions.join('\n\n');
  return upsertManagedBlock(existingContent, newManaged, MANAGED_START_TOML, MANAGED_END_TOML);
}

/**
 * Detect if a repo has both Claude and Codex surfaces (mixed-agent repo).
 */
function detectMixedAgentRepo(dir) {
  const hasClaude = fs.existsSync(path.join(dir, 'CLAUDE.md')) ||
    fs.existsSync(path.join(dir, '.claude'));
  const hasCodex = fs.existsSync(path.join(dir, 'AGENTS.md')) ||
    fs.existsSync(path.join(dir, '.codex'));

  return {
    isMixed: hasClaude && hasCodex,
    hasClaude,
    hasCodex,
    guidance: hasClaude && hasCodex
      ? 'This is a mixed-agent repo. Keep Claude instructions in CLAUDE.md and Codex instructions in AGENTS.md. Do not merge them.'
      : null,
  };
}

/**
 * Generate a diff preview for a patch operation.
 */
function generatePatchPreview(originalContent, patchedContent, filePath) {
  const origLines = originalContent.split('\n');
  const patchLines = patchedContent.split('\n');

  const lines = [`--- ${filePath} (original)`, `+++ ${filePath} (patched)`];

  // Simple line-by-line diff showing only changed sections
  let inChange = false;
  for (let i = 0; i < Math.max(origLines.length, patchLines.length); i++) {
    const orig = origLines[i] || '';
    const patched = patchLines[i] || '';
    if (orig !== patched) {
      if (!inChange) {
        lines.push(`@@ line ${i + 1} @@`);
        inChange = true;
      }
      if (i < origLines.length) lines.push(`-${orig}`);
      if (i < patchLines.length) lines.push(`+${patched}`);
    } else {
      inChange = false;
    }
  }

  return lines.join('\n');
}

/**
 * Apply a patch to a file with backup and rollback support.
 */
function applyPatch(dir, filePath, patchFn, options = {}) {
  const fullPath = path.join(dir, filePath);
  const dryRun = options.dryRun === true;

  if (!fs.existsSync(fullPath)) {
    return { success: false, reason: `${filePath} does not exist`, preview: null };
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const patched = patchFn(original);

  if (patched === original) {
    return { success: true, reason: 'no changes needed', preview: null, unchanged: true };
  }

  const preview = generatePatchPreview(original, patched, filePath);

  if (dryRun) {
    return { success: true, reason: 'dry run', preview, unchanged: false };
  }

  // Backup + write
  const backupPath = fullPath + '.nerviq-backup';
  fs.writeFileSync(backupPath, original, 'utf8');
  fs.writeFileSync(fullPath, patched, 'utf8');

  // Rollback artifact
  const rollback = writeRollbackArtifact(dir, {
    sourcePlan: 'codex-patch',
    patchedFiles: [filePath],
    backupFiles: [{ original: filePath, backup: path.relative(dir, backupPath) }],
    rollbackInstructions: [`Restore ${filePath} from ${path.relative(dir, backupPath)}`],
  });

  const activity = writeActivityArtifact(dir, 'codex-patch', {
    platform: 'codex',
    patchedFiles: [filePath],
    rollbackArtifact: rollback.relativePath,
  });

  return {
    success: true,
    reason: 'patched',
    preview,
    unchanged: false,
    rollbackArtifact: rollback.relativePath,
    activityArtifact: activity.relativePath,
  };
}

module.exports = {
  MANAGED_START_MD,
  MANAGED_END_MD,
  MANAGED_START_TOML,
  MANAGED_END_TOML,
  extractManagedBlock,
  upsertManagedBlock,
  patchAgentsMd,
  patchConfigToml,
  detectMixedAgentRepo,
  generatePatchPreview,
  applyPatch,
};
