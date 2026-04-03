const EMBEDDED_SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
];

function containsEmbeddedSecret(text = '') {
  return EMBEDDED_SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function redactEmbeddedSecrets(text = '') {
  let output = text;
  for (const pattern of EMBEDDED_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, '[REDACTED_SECRET]');
  }
  return output;
}

module.exports = {
  EMBEDDED_SECRET_PATTERNS,
  containsEmbeddedSecret,
  redactEmbeddedSecrets,
};
