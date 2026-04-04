/**
 * OpenCode JSONC Parser
 *
 * Parses JSONC (JSON with Comments) format used by opencode.json / opencode.jsonc.
 * Strips single-line (//) and multi-line comments before parsing.
 */

function stripJsoncComments(content) {
  let result = '';
  let inString = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = i + 1 < content.length ? content[i + 1] : '';
    const prev = i > 0 ? content[i - 1] : '';

    if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
        result += char;
      }
      continue;
    }

    if (inMultiLineComment) {
      if (char === '*' && next === '/') {
        inMultiLineComment = false;
        i++; // skip closing /
      } else if (char === '\n') {
        result += char; // preserve newlines for line counting
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '"' && prev !== '\\') {
        inString = false;
      }
      continue;
    }

    // Not in string or comment
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inSingleLineComment = true;
      i++; // skip second /
      continue;
    }

    if (char === '/' && next === '*') {
      inMultiLineComment = true;
      i++; // skip *
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Strip trailing commas from JSON (common in JSONC).
 */
function stripTrailingCommas(content) {
  return content.replace(/,\s*([\]}])/g, '$1');
}

function parseJsonc(content) {
  const stripped = stripTrailingCommas(stripJsoncComments(content));
  return JSON.parse(stripped);
}

function tryParseJsonc(content) {
  try {
    return { ok: true, data: parseJsonc(content), error: null };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

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

module.exports = {
  stripJsoncComments,
  stripTrailingCommas,
  parseJsonc,
  tryParseJsonc,
  getValueByPath,
};
