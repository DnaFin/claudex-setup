/**
 * Public Check Catalog Generator
 * Reads ALL technique files from all 8 platforms and generates a unified JSON catalog.
 */

const fs = require('fs');
const path = require('path');

const { TECHNIQUES: CLAUDE_TECHNIQUES } = require('./techniques');
const { CODEX_TECHNIQUES } = require('./codex/techniques');
const { GEMINI_TECHNIQUES } = require('./gemini/techniques');
const { COPILOT_TECHNIQUES } = require('./copilot/techniques');
const { CURSOR_TECHNIQUES } = require('./cursor/techniques');
const { WINDSURF_TECHNIQUES } = require('./windsurf/techniques');
const { AIDER_TECHNIQUES } = require('./aider/techniques');
const { OPENCODE_TECHNIQUES } = require('./opencode/techniques');
const { attachSourceUrls } = require('./source-urls');

const PLATFORM_MAP = {
  claude:   CLAUDE_TECHNIQUES,
  codex:    CODEX_TECHNIQUES,
  gemini:   GEMINI_TECHNIQUES,
  copilot:  COPILOT_TECHNIQUES,
  cursor:   CURSOR_TECHNIQUES,
  windsurf: WINDSURF_TECHNIQUES,
  aider:    AIDER_TECHNIQUES,
  opencode: OPENCODE_TECHNIQUES,
};

/**
 * Generate a unified catalog array from all platform technique files.
 * Each entry contains:
 *   platform, id, key, name, category, impact, rating, fix, sourceUrl,
 *   confidence, template, deprecated
 */
function generateCatalog() {
  const catalog = [];

  for (const [platform, techniques] of Object.entries(PLATFORM_MAP)) {
    // Clone techniques so we don't mutate the originals
    const cloned = {};
    for (const [key, tech] of Object.entries(techniques)) {
      cloned[key] = { ...tech };
    }

    // Attach source URLs
    try {
      attachSourceUrls(platform, cloned);
    } catch (_) {
      // If source URLs fail for a platform, continue without them
    }

    for (const [key, tech] of Object.entries(cloned)) {
      catalog.push({
        platform,
        id: tech.id ?? null,
        key,
        name: tech.name ?? null,
        category: tech.category ?? null,
        impact: tech.impact ?? null,
        rating: tech.rating ?? null,
        fix: tech.fix ?? null,
        sourceUrl: tech.sourceUrl ?? null,
        confidence: tech.confidence ?? null,
        template: tech.template ?? null,
        deprecated: tech.deprecated ?? false,
      });
    }
  }

  return catalog;
}

/**
 * Write the catalog as formatted JSON to the given output path.
 * @param {string} outputPath - Absolute or relative path for the JSON file
 * @returns {{ path: string, count: number }} Written path and entry count
 */
function writeCatalogJson(outputPath) {
  const catalog = generateCatalog();
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  return { path: resolved, count: catalog.length };
}

module.exports = { generateCatalog, writeCatalogJson };
