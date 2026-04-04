/**
 * OpenCode Patch Intelligence
 *
 * Safe patching of existing OpenCode files using managed blocks.
 * Supports AGENTS.md (HTML comment blocks) and opencode.json (JSONC managed sections).
 *
 * Managed blocks are sections that nerviq controls.
 * Hand-authored content outside managed blocks is preserved.
 */

const fs = require('fs');
const path = require('path');
const { writeRollbackArtifact, writeActivityArtifact } = require('../activity');
const { tryParseJsonc } = require('./config-parser');

// Managed block markers
const MANAGED_START_MD = '<!-- nerviq:managed:start -->';
const MANAGED_END_MD = '<!-- nerviq:managed:end -->';
const MANAGED_START_JSONC = '// nerviq:managed:start';
const MANAGED_END_JSONC = '// nerviq:managed:end';

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

function upsertManagedBlock(content, newManaged, startMarker, endMarker) {
  const { before, managed, after } = extractManagedBlock(content, startMarker, endMarker);

  if (managed !== null) {
    return `${before}${startMarker}\n${newManaged}\n${endMarker}${after}`;
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${startMarker}\n${newManaged}\n${endMarker}\n`;
}

function patchAgentsMd(existingContent, managedSections) {
  const newManaged = Object.entries(managedSections)
    .map(([section, content]) => `## ${section}\n${content}`)
    .join('\n\n');

  return upsertManagedBlock(existingContent, newManaged, MANAGED_START_MD, MANAGED_END_MD);
}

/**
 * Patch opencode.json by safely merging new keys.
 * Never weakens existing permission posture.
 * Only adds new keys that don't already exist.
 */
function patchConfigJsonc(existingContent, newKeys) {
  const parsed = tryParseJsonc(existingContent);
  if (!parsed.ok) return existingContent;

  const existing = parsed.data;
  let changed = false;

  for (const [key, value] of Object.entries(newKeys)) {
    if (existing[key] === undefined) {
      existing[key] = value;
      changed = true;
    }
  }

  if (!changed) return existingContent;

  return JSON.stringify(existing, null, 2) + '\n';
}

function detectMixedAgentRepo(dir) {
  const hasClaude = fs.existsSync(path.join(dir, 'CLAUDE.md')) ||
    fs.existsSync(path.join(dir, '.claude'));
  const hasOpenCode = fs.existsSync(path.join(dir, 'opencode.json')) ||
    fs.existsSync(path.join(dir, 'opencode.jsonc')) ||
    fs.existsSync(path.join(dir, '.opencode'));
  const hasAgentsMd = fs.existsSync(path.join(dir, 'AGENTS.md'));

  return {
    isMixed: hasClaude && (hasOpenCode || hasAgentsMd),
    hasClaude,
    hasOpenCode,
    hasAgentsMd,
    guidance: hasClaude && hasOpenCode
      ? 'This is a mixed-agent repo. Keep Claude instructions in CLAUDE.md and OpenCode instructions in AGENTS.md. AGENTS.md takes precedence in OpenCode.'
      : null,
  };
}

function generatePatchPreview(originalContent, patchedContent, filePath) {
  const origLines = originalContent.split('\n');
  const patchLines = patchedContent.split('\n');

  const lines = [`--- ${filePath} (original)`, `+++ ${filePath} (patched)`];

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

  const backupPath = fullPath + '.claudex-backup';
  fs.writeFileSync(backupPath, original, 'utf8');
  fs.writeFileSync(fullPath, patched, 'utf8');

  const rollback = writeRollbackArtifact(dir, {
    sourcePlan: 'opencode-patch',
    patchedFiles: [filePath],
    backupFiles: [{ original: filePath, backup: path.relative(dir, backupPath) }],
    rollbackInstructions: [`Restore ${filePath} from ${path.relative(dir, backupPath)}`],
  });

  const activity = writeActivityArtifact(dir, 'opencode-patch', {
    platform: 'opencode',
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
  MANAGED_START_JSONC,
  MANAGED_END_JSONC,
  extractManagedBlock,
  upsertManagedBlock,
  patchAgentsMd,
  patchConfigJsonc,
  detectMixedAgentRepo,
  generatePatchPreview,
  applyPatch,
};
