/**
 * Windsurf config parser.
 *
 * Windsurf uses Markdown + YAML frontmatter for .windsurf/rules/*.md,
 * and JSON for .windsurf/mcp.json and other config.
 * Key difference from Cursor: NO MDC format — standard Markdown with YAML frontmatter.
 * 4 activation modes: Always, Auto, Agent-Requested, Manual.
 * 10K char rule limit per file.
 * This module handles both formats with unified value extraction.
 */

// ─── JSON parsing ────────────────────────────────────────────────────────────

function tryParseJson(content) {
  try {
    const data = JSON.parse(content);
    return { ok: true, data, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

// ─── YAML frontmatter parsing (Markdown files) ─────────────────────────────

/**
 * Parse a Windsurf rule file (YAML frontmatter delimited by --- + Markdown body).
 * Returns { frontmatter: object|null, body: string, raw: string|null }
 */
function parseWindsurfRule(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: null, body: content || '', raw: null };
  }

  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, body: content, raw: null };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { frontmatter: null, body: content, raw: null };
  }

  const raw = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();
  const frontmatter = parseSimpleYaml(raw);

  return { frontmatter, body, raw };
}

/**
 * Minimal YAML parser for Windsurf rule frontmatter fields.
 * Handles: key: value, key: [item1, item2], key: "quoted", booleans, numbers.
 * Also handles multi-line array syntax (indented with -).
 */
function parseSimpleYaml(yamlStr) {
  if (!yamlStr || typeof yamlStr !== 'string') return {};

  const result = {};
  const lines = yamlStr.split(/\r?\n/);
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    // Check for multi-line array item (  - "value")
    if (currentKey && currentArray !== null && /^\s*-\s+/.test(line)) {
      const itemValue = trimmedLine.slice(1).trim();
      currentArray.push(stripQuotes(itemValue));
      continue;
    }

    // If we were collecting an array, commit it
    if (currentKey && currentArray !== null) {
      result[currentKey] = currentArray;
      currentKey = null;
      currentArray = null;
    }

    const colonIdx = trimmedLine.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmedLine.slice(0, colonIdx).trim();
    let value = trimmedLine.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Parse value
    if (value === '') {
      // Could be start of multi-line array
      currentKey = key;
      currentArray = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array: [item1, item2]
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        result[key] = [];
      } else {
        result[key] = inner.split(',').map(item => {
          const t = item.trim();
          return stripQuotes(t);
        });
      }
    } else if ((value.startsWith('"') && value.endsWith('"')) ||
               (value.startsWith("'") && value.endsWith("'"))) {
      result[key] = value.slice(1, -1);
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (/^-?\d+$/.test(value)) {
      result[key] = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      result[key] = parseFloat(value);
    } else {
      result[key] = value;
    }
  }

  // Commit any remaining array
  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray;
  }

  return result;
}

function stripQuotes(str) {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

// ─── Windsurf rule type detection ───────────────────────────────────────────

/**
 * Determine the Windsurf rule activation mode from frontmatter fields.
 *
 * Windsurf 4 activation modes:
 *   Always:           trigger: always
 *   Auto:             trigger: auto, globs set
 *   Agent-Requested:  trigger: agent_requested, description set
 *   Manual:           trigger: manual (or no trigger field)
 */
function detectRuleType(frontmatter) {
  if (!frontmatter) return 'manual';

  const trigger = (frontmatter.trigger || '').toLowerCase().trim();

  if (trigger === 'always') return 'always';
  if (trigger === 'auto' || trigger === 'auto_attached') return 'auto';
  if (trigger === 'agent_requested' || trigger === 'agent-requested') return 'agent-requested';
  if (trigger === 'manual') return 'manual';

  // Fallback heuristic based on fields
  const hasGlobs = Array.isArray(frontmatter.globs)
    ? frontmatter.globs.length > 0
    : Boolean(frontmatter.globs);
  const hasDescription = Boolean(frontmatter.description && String(frontmatter.description).trim());

  if (hasGlobs) return 'auto';
  if (hasDescription && !hasGlobs) return 'agent-requested';
  return 'manual';
}

// ─── Value extraction ────────────────────────────────────────────────────────

function getValueByPath(obj, dottedPath) {
  if (!obj) return undefined;
  const parts = dottedPath.split('.').filter(Boolean);
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

// ─── Windsurf frontmatter validation ────────────────────────────────────────

const VALID_WINDSURF_FIELDS = new Set(['trigger', 'description', 'globs', 'name']);

/**
 * Validate Windsurf rule file frontmatter.
 * Returns { valid, errors, ruleType }.
 */
function validateWindsurfFrontmatter(frontmatter) {
  if (!frontmatter) return { valid: false, errors: ['No frontmatter found'], ruleType: 'manual' };

  const errors = [];

  for (const key of Object.keys(frontmatter)) {
    if (!VALID_WINDSURF_FIELDS.has(key)) {
      errors.push(`Unknown Windsurf frontmatter field: "${key}"`);
    }
  }

  // Validate trigger field
  const validTriggers = ['always', 'auto', 'auto_attached', 'agent_requested', 'agent-requested', 'manual'];
  if (frontmatter.trigger && !validTriggers.includes(String(frontmatter.trigger).toLowerCase().trim())) {
    errors.push(`Invalid trigger value: "${frontmatter.trigger}". Must be one of: always, auto, agent_requested, manual`);
  }

  // Validate globs is an array if present
  if (frontmatter.globs !== undefined && !Array.isArray(frontmatter.globs) && typeof frontmatter.globs !== 'string') {
    errors.push('globs must be a string or array of strings');
  }

  // Warn on 10K char limit
  const ruleType = detectRuleType(frontmatter);

  return { valid: errors.length === 0, errors, ruleType };
}

// ─── MCP config validation ──────────────────────────────────────────────────

/**
 * Count total MCP tools across all servers.
 * Windsurf has team-level MCP whitelisting.
 */
function countMcpTools(mcpData) {
  if (!mcpData || !mcpData.mcpServers) return 0;

  let total = 0;
  for (const server of Object.values(mcpData.mcpServers)) {
    // Each server exposes tools; estimate ~5 per server if no explicit count
    const toolCount = server.tools ? Object.keys(server.tools).length : 5;
    total += toolCount;
  }
  return total;
}

/**
 * Validate MCP env vars use proper syntax (not hardcoded secrets).
 */
function validateMcpEnvVars(mcpData) {
  if (!mcpData || !mcpData.mcpServers) return { valid: true, hardcodedVars: [] };

  const hardcodedVars = [];
  for (const [serverName, config] of Object.entries(mcpData.mcpServers)) {
    if (!config.env) continue;
    for (const [key, value] of Object.entries(config.env)) {
      if (typeof value === 'string' && !value.startsWith('${env:') && /key|token|secret|password|api/i.test(key)) {
        hardcodedVars.push({ server: serverName, key, value: '[REDACTED]' });
      }
    }
  }

  return { valid: hardcodedVars.length === 0, hardcodedVars };
}

module.exports = {
  tryParseJson,
  parseWindsurfRule,
  parseSimpleYaml,
  detectRuleType,
  getValueByPath,
  validateWindsurfFrontmatter,
  countMcpTools,
  validateMcpEnvVars,
};
