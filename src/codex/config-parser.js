const COMMENT_MARKER = '#';

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

    if (char === COMMENT_MARKER && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }

  return line;
}

function assignPath(target, pathParts, value) {
  let cursor = target;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

function parseString(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return null;
}

function splitInlineItems(value, separator = ',') {
  const items = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const prev = i > 0 ? value[i - 1] : '';

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble) {
      if (char === '[' || char === '{') depth++;
      if (char === ']' || char === '}') depth--;
      if (char === separator && depth === 0) {
        items.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function parseValue(rawValue) {
  const value = rawValue.trim();

  const asString = parseString(value);
  if (asString !== null) return asString;

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitInlineItems(inner).map(parseValue);
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1).trim();
    const result = {};
    if (!inner) return result;

    for (const entry of splitInlineItems(inner)) {
      const idx = entry.indexOf('=');
      if (idx === -1) {
        throw new Error(`Invalid inline table entry: ${entry}`);
      }
      const key = entry.slice(0, idx).trim();
      const entryValue = entry.slice(idx + 1).trim();
      assignPath(result, key.split('.').map(part => part.trim()).filter(Boolean), parseValue(entryValue));
    }
    return result;
  }

  return value;
}

function parseToml(content) {
  const root = {};
  let currentSection = [];

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionName = line.slice(1, -1).trim();
      if (!sectionName) {
        throw new Error(`Line ${i + 1}: empty section header`);
      }
      currentSection = sectionName.split('.').map(part => part.trim()).filter(Boolean);
      assignPath(root, currentSection, {});
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      throw new Error(`Line ${i + 1}: expected key = value`);
    }

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();
    if (!key || !rawValue) {
      throw new Error(`Line ${i + 1}: invalid key/value pair`);
    }

    const keyPath = key.split('.').map(part => part.trim()).filter(Boolean);
    assignPath(root, [...currentSection, ...keyPath], parseValue(rawValue));
  }

  return root;
}

function tryParseToml(content) {
  try {
    return { ok: true, data: parseToml(content), error: null };
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
  parseToml,
  tryParseToml,
  getValueByPath,
};
