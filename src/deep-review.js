/**
 * Deep Review - AI-powered analysis of Claude Code configuration quality.
 * Uses Claude API to read and critique your actual config, not just pattern match.
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Usage: npx claudex-setup deep-review
 */

const https = require('https');
const path = require('path');
const { ProjectContext } = require('./context');
const { STACKS } = require('./techniques');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[36m', magenta: '\x1b[35m',
};
const c = (text, color) => `${COLORS[color] || ''}${text}${COLORS.reset}`;

function collectProjectConfig(ctx, stacks) {
  const config = {};

  // CLAUDE.md
  config.claudeMd = ctx.fileContent('CLAUDE.md') || ctx.fileContent('.claude/CLAUDE.md');

  // Settings
  config.settings = ctx.fileContent('.claude/settings.local.json') || ctx.fileContent('.claude/settings.json');

  // Commands
  config.commands = {};
  if (ctx.hasDir('.claude/commands')) {
    for (const f of ctx.dirFiles('.claude/commands')) {
      config.commands[f] = ctx.fileContent(`.claude/commands/${f}`);
    }
  }

  // Agents
  config.agents = {};
  if (ctx.hasDir('.claude/agents')) {
    for (const f of ctx.dirFiles('.claude/agents')) {
      config.agents[f] = ctx.fileContent(`.claude/agents/${f}`);
    }
  }

  // Rules
  config.rules = {};
  if (ctx.hasDir('.claude/rules')) {
    for (const f of ctx.dirFiles('.claude/rules')) {
      config.rules[f] = ctx.fileContent(`.claude/rules/${f}`);
    }
  }

  // Hooks (from settings)
  if (ctx.hasDir('.claude/hooks')) {
    config.hookFiles = {};
    for (const f of ctx.dirFiles('.claude/hooks')) {
      config.hookFiles[f] = ctx.fileContent(`.claude/hooks/${f}`);
    }
  }

  // Package.json (scripts only)
  const pkg = ctx.jsonFile('package.json');
  if (pkg) {
    config.packageScripts = pkg.scripts || {};
    config.packageName = pkg.name;
  }

  config.stacks = stacks.map(s => s.label);

  return config;
}

function buildPrompt(config) {
  const parts = [];

  parts.push(`You are an expert Claude Code configuration reviewer. Analyze this project's Claude Code setup and provide specific, actionable feedback.

The project uses: ${config.stacks.join(', ') || 'unknown stack'}
${config.packageName ? `Project name: ${config.packageName}` : ''}`);

  if (config.claudeMd) {
    parts.push(`\n<claude_md>\n${config.claudeMd.slice(0, 4000)}\n</claude_md>`);
  } else {
    parts.push('\nNo CLAUDE.md found.');
  }

  if (config.settings) {
    parts.push(`\n<settings>\n${config.settings.slice(0, 2000)}\n</settings>`);
  }

  if (Object.keys(config.commands).length > 0) {
    parts.push('\n<commands>');
    for (const [name, content] of Object.entries(config.commands)) {
      parts.push(`--- ${name} ---\n${(content || '').slice(0, 500)}`);
    }
    parts.push('</commands>');
  }

  if (Object.keys(config.agents).length > 0) {
    parts.push('\n<agents>');
    for (const [name, content] of Object.entries(config.agents)) {
      parts.push(`--- ${name} ---\n${(content || '').slice(0, 500)}`);
    }
    parts.push('</agents>');
  }

  if (Object.keys(config.rules || {}).length > 0) {
    parts.push('\n<rules>');
    for (const [name, content] of Object.entries(config.rules)) {
      parts.push(`--- ${name} ---\n${(content || '').slice(0, 300)}`);
    }
    parts.push('</rules>');
  }

  if (config.hookFiles && Object.keys(config.hookFiles).length > 0) {
    parts.push('\n<hooks>');
    for (const [name, content] of Object.entries(config.hookFiles)) {
      parts.push(`--- ${name} ---\n${(content || '').slice(0, 300)}`);
    }
    parts.push('</hooks>');
  }

  parts.push(`
<task>
Provide a deep review with these exact sections:

## Score: X/10

## Strengths (what's done well)
- List 2-4 specific things this config does right, with WHY they're effective

## Issues (what needs fixing)
- List 3-5 specific issues, each with:
  - What's wrong (be specific, quote from the config)
  - Why it matters
  - Exact fix (show the corrected version or command)

## Missing (what's not there but should be)
- List 2-3 things this project should add based on its stack
- Be specific to THIS project's stack and size, not generic advice

## Quick Wins (fastest improvements)
- Top 3 changes that take under 2 minutes each

Be direct, specific, and honest. Don't pad with generic advice. Reference actual content from the config. If the setup is already excellent, say so and focus on micro-optimizations.
</task>`);

  return parts.join('\n');
}

function callClaude(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message));
          } else {
            resolve(parsed.content[0].text);
          }
        } catch (e) {
          reject(new Error(`API response parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function hasClaudeCode() {
  try {
    require('child_process').execSync('claude --version', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

async function callClaudeCode(prompt) {
  const { execSync } = require('child_process');
  const os = require('os');
  const fs = require('fs');
  const tmpFile = path.join(os.tmpdir(), `claudex-review-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf8');
  try {
    const result = execSync(`claude -p --output-format text < "${tmpFile}"`, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 120000,
      shell: true,
    });
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function deepReview(options) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasClaude = hasClaudeCode();

  if (!apiKey && !hasClaude) {
    console.log('');
    console.log(c('  Deep Review needs Claude Code or an API key.', 'bold'));
    console.log('');
    console.log('  Option A (recommended): Install Claude Code, then run this command.');
    console.log(c('    npm install -g @anthropic-ai/claude-code', 'green'));
    console.log('');
    console.log('  Option B: Set an API key:');
    console.log(c('    export ANTHROPIC_API_KEY=sk-ant-...', 'green'));
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(c('  claudex-setup deep review', 'bold'));
  console.log(c('  ═══════════════════════════════════════', 'dim'));

  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);

  console.log(c(`  Scanning: ${options.dir}`, 'dim'));
  if (stacks.length > 0) {
    console.log(c(`  Stack: ${stacks.map(s => s.label).join(', ')}`, 'blue'));
  }

  // Collect config
  const config = collectProjectConfig(ctx, stacks);
  const fileCount = [
    config.claudeMd ? 1 : 0,
    config.settings ? 1 : 0,
    Object.keys(config.commands).length,
    Object.keys(config.agents).length,
    Object.keys(config.rules || {}).length,
    Object.keys(config.hookFiles || {}).length,
  ].reduce((a, b) => a + b, 0);

  console.log(c(`  Found ${fileCount} config files to analyze`, 'dim'));
  console.log('');
  console.log(c('  Sending to Claude for deep analysis...', 'magenta'));
  console.log('');

  try {
    const prompt = buildPrompt(config);
    let review;
    let method;

    if (hasClaude) {
      method = 'Claude Code (your existing subscription)';
      console.log(c('  Using: Claude Code (no API key needed)', 'green'));
      console.log('');
      review = await callClaudeCode(prompt);
    } else {
      method = 'Anthropic API (your key)';
      console.log(c('  Using: Anthropic API', 'dim'));
      console.log('');
      review = await callClaude(apiKey, prompt);
    }

    // Format output
    const lines = review.split('\n');
    for (const line of lines) {
      if (line.startsWith('## Score')) {
        console.log(c(`  ${line}`, 'bold'));
      } else if (line.startsWith('## Strengths')) {
        console.log(c(`  ${line}`, 'green'));
      } else if (line.startsWith('## Issues')) {
        console.log(c(`  ${line}`, 'yellow'));
      } else if (line.startsWith('## Missing')) {
        console.log(c(`  ${line}`, 'red'));
      } else if (line.startsWith('## Quick')) {
        console.log(c(`  ${line}`, 'magenta'));
      } else if (line.startsWith('- ')) {
        console.log(`  ${line}`);
      } else if (line.startsWith('```')) {
        console.log(c(`  ${line}`, 'dim'));
      } else if (line.trim()) {
        console.log(`  ${line}`);
      } else {
        console.log('');
      }
    }

    console.log('');
    console.log(c('  ─────────────────────────────────────', 'dim'));
    console.log(c(`  Reviewed via ${method}`, 'dim'));
    console.log(c('  Your config stays between you and Anthropic. We never see it.', 'dim'));
    console.log('');
  } catch (err) {
    console.log(c(`  Error: ${err.message}`, 'red'));
    console.log('');
    console.log('  Check your ANTHROPIC_API_KEY is valid.');
    process.exit(1);
  }
}

module.exports = { deepReview };
