/**
 * Aider Config Parser — YAML parser for .aider.conf.yml
 *
 * Aider uses YAML config (.aider.conf.yml) with a 4-level precedence:
 *   env vars > CLI args > .aider.conf.yml > defaults
 *
 * This is a lightweight YAML subset parser (no dependency on js-yaml).
 * Handles the flat key-value pairs and simple lists that .aider.conf.yml uses.
 */

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const prev = i > 0 ? line[i - 1] : '';

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }

    if (char === '#' && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }

  return line;
}

function parseYamlValue(rawValue) {
  const value = rawValue.trim();

  if (value === '' || value === '~' || value === 'null') return null;
  if (value === 'true' || value === 'True' || value === 'TRUE') return true;
  if (value === 'false' || value === 'False' || value === 'FALSE') return false;

  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);

  // Quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Inline list: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(item => parseYamlValue(item.trim()));
  }

  return value;
}

function getIndentLevel(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Parse a simple YAML config file (flat keys, simple lists, no nested objects).
 * Covers the subset used by .aider.conf.yml and .aider.model.settings.yml.
 */
function parseYaml(content) {
  const root = {};
  const lines = content.split(/\r?\n/);
  let currentKey = null;
  let collectingList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = stripInlineComment(rawLine);
    const trimmed = stripped.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = getIndentLevel(stripped);

    // List item under a key
    if (trimmed.startsWith('- ') && collectingList && currentKey) {
      const listValue = parseYamlValue(trimmed.slice(2).trim());
      if (!Array.isArray(root[currentKey])) {
        root[currentKey] = [];
      }
      root[currentKey].push(listValue);
      continue;
    }

    // Key-value pair
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(`Line ${i + 1}: expected key: value — got "${trimmed}"`);
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();

    if (!afterColon) {
      // Could be start of a list or nested block
      currentKey = key;
      collectingList = true;
      continue;
    }

    collectingList = false;
    currentKey = key;
    root[key] = parseYamlValue(afterColon);
  }

  return root;
}

function tryParseYaml(content) {
  try {
    return { ok: true, data: parseYaml(content), error: null };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

function getValueByKey(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj[key];
}

/**
 * Parse .env file content into key-value pairs.
 */
function parseDotEnv(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

module.exports = {
  parseYaml,
  tryParseYaml,
  getValueByKey,
  parseDotEnv,
};
