const fs = require('fs');
const path = require('path');
const readline = require('readline');

let lastTimestamp = '';
let counter = 0;

function timestampId() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (ts === lastTimestamp) {
    counter += 1;
    return `${ts}-${counter}`;
  }
  lastTimestamp = ts;
  counter = 0;
  return ts;
}

function ensureFeedbackDir(dir) {
  const feedbackDir = path.join(dir, '.claude', 'claudex-setup', 'feedback');
  fs.mkdirSync(feedbackDir, { recursive: true });
  return feedbackDir;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function saveFeedback(dir, payload) {
  const feedbackDir = ensureFeedbackDir(dir);
  const id = timestampId();
  const keySlug = String(payload.key || 'finding').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const filePath = path.join(feedbackDir, `${id}-${keySlug}.json`);
  const envelope = {
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  writeJson(filePath, envelope);
  return {
    ...envelope,
    filePath,
    relativePath: path.relative(dir, filePath),
  };
}

function getFeedbackSummary(dir) {
  const feedbackDir = ensureFeedbackDir(dir);
  const files = fs.readdirSync(feedbackDir).filter((name) => name.endsWith('.json'));
  const entries = [];

  for (const file of files) {
    const filePath = path.join(feedbackDir, file);
    try {
      entries.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch {
      // Ignore malformed artifacts so one bad file does not break the summary.
    }
  }

  const summary = {
    totalEntries: entries.length,
    helpful: 0,
    unhelpful: 0,
    byKey: {},
    relativeDir: path.relative(dir, feedbackDir),
  };

  for (const entry of entries) {
    const helpful = entry.helpful === true;
    if (helpful) {
      summary.helpful += 1;
    } else if (entry.helpful === false) {
      summary.unhelpful += 1;
    }

    const bucket = summary.byKey[entry.key] || { total: 0, helpful: 0, unhelpful: 0 };
    bucket.total += 1;
    if (helpful) {
      bucket.helpful += 1;
    } else if (entry.helpful === false) {
      bucket.unhelpful += 1;
    }
    summary.byKey[entry.key] = bucket;
  }

  return summary;
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function collectFeedback(dir, options = {}) {
  const findings = Array.isArray(options.findings) ? options.findings : [];
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;

  if (findings.length === 0) {
    return {
      saved: 0,
      skipped: 0,
      helpful: 0,
      unhelpful: 0,
      entries: [],
      relativeDir: path.relative(dir, ensureFeedbackDir(dir)),
    };
  }

  if (!(stdin.isTTY && stdout.isTTY)) {
    return {
      mode: 'skipped-noninteractive',
      saved: 0,
      skipped: findings.length,
      helpful: 0,
      unhelpful: 0,
      entries: [],
      relativeDir: path.relative(dir, ensureFeedbackDir(dir)),
    };
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const entries = [];

  try {
    for (const finding of findings) {
      stdout.write(`\n  Feedback for ${finding.name} (${finding.key})\n`);
      let answer = await askQuestion(rl, '  Was this helpful? (y/n) ');
      answer = String(answer || '').trim().toLowerCase();

      if (!['y', 'yes', 'n', 'no'].includes(answer)) {
        continue;
      }

      entries.push(saveFeedback(dir, {
        key: finding.key,
        name: finding.name,
        helpful: answer === 'y' || answer === 'yes',
        platform: options.platform || null,
        sourceCommand: options.sourceCommand || 'audit',
        sourceUrl: finding.sourceUrl || null,
        impact: finding.impact || null,
        category: finding.category || null,
        score: Number.isFinite(options.score) ? options.score : null,
      }));
    }
  } finally {
    rl.close();
  }

  const helpful = entries.filter((entry) => entry.helpful).length;
  const unhelpful = entries.filter((entry) => entry.helpful === false).length;

  return {
    saved: entries.length,
    skipped: findings.length - entries.length,
    helpful,
    unhelpful,
    entries,
    relativeDir: path.relative(dir, ensureFeedbackDir(dir)),
    summary: getFeedbackSummary(dir),
  };
}

module.exports = {
  collectFeedback,
  saveFeedback,
  getFeedbackSummary,
};
