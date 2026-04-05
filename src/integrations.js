/**
 * Nerviq Integrations
 *
 * Webhook dispatch and message formatting for Slack, Discord,
 * and generic HTTP endpoints.
 *
 * All functions are synchronous-friendly; sendWebhook is async
 * (uses built-in https module, no external dependencies).
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Webhook delivery ────────────────────────────────────────────────────────

/**
 * POST JSON payload to a webhook URL.
 * @param {string} url  - Destination URL (http or https)
 * @param {object} payload - JSON-serialisable object
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=10000]
 * @param {object} [opts.headers]
 * @returns {Promise<{ ok: boolean, status: number, body: string }>}
 */
function sendWebhook(url, payload, opts = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid webhook URL: ${url}`));
    }

    const body = JSON.stringify(payload);
    const timeoutMs = opts.timeoutMs ?? 10_000;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': `nerviq/${require('../package.json').version}`,
        ...(opts.headers || {}),
      },
    };

    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const respBody = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: respBody });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Webhook request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Slack formatting ─────────────────────────────────────────────────────────

/**
 * Format an audit result as a Slack Block Kit message payload.
 * @param {object} auditResult - Result from audit()
 * @returns {object} Slack-compatible message payload (blocks API)
 */
function formatSlackMessage(auditResult) {
  const score = auditResult.score ?? 0;
  const platform = auditResult.platform ?? 'claude';
  const emoji = score >= 70 ? ':white_check_mark:' : score >= 40 ? ':warning:' : ':x:';
  const color = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'danger';

  const criticals = (auditResult.results || [])
    .filter((r) => r.passed === false && r.impact === 'critical')
    .slice(0, 5);

  const sections = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} Nerviq Audit — ${platform}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Score*\n${score}/100` },
        { type: 'mrkdwn', text: `*Checks*\n${auditResult.passed ?? 0} pass / ${auditResult.failed ?? 0} fail` },
      ],
    },
  ];

  if (criticals.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Critical gaps:*\n${criticals.map((r) => `• ${r.name}`).join('\n')}`,
      },
    });
  }

  if (auditResult.suggestedNextCommand) {
    sections.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Next step:* \`${auditResult.suggestedNextCommand}\`` },
    });
  }

  // Also include legacy attachment for clients that don't support blocks
  return {
    blocks: sections,
    attachments: [
      {
        color,
        fallback: `Nerviq audit (${platform}): ${score}/100 — ${auditResult.passed ?? 0} pass, ${auditResult.failed ?? 0} fail`,
      },
    ],
  };
}

// ─── Discord formatting ───────────────────────────────────────────────────────

/**
 * Format an audit result as a Discord webhook embed payload.
 * @param {object} auditResult - Result from audit()
 * @returns {object} Discord-compatible webhook payload (embeds)
 */
function formatDiscordMessage(auditResult) {
  const score = auditResult.score ?? 0;
  const platform = auditResult.platform ?? 'claude';
  const color = score >= 70 ? 0x2ecc71 : score >= 40 ? 0xf39c12 : 0xe74c3c; // green / yellow / red
  const icon = score >= 70 ? '✅' : score >= 40 ? '⚠️' : '❌';

  const criticals = (auditResult.results || [])
    .filter((r) => r.passed === false && r.impact === 'critical')
    .slice(0, 5);

  const highs = (auditResult.results || [])
    .filter((r) => r.passed === false && r.impact === 'high')
    .slice(0, 3);

  const fields = [
    { name: 'Score', value: `**${score}/100**`, inline: true },
    { name: 'Pass / Fail', value: `${auditResult.passed ?? 0} / ${auditResult.failed ?? 0}`, inline: true },
    { name: 'Platform', value: platform, inline: true },
  ];

  if (criticals.length > 0) {
    fields.push({
      name: '🚨 Critical',
      value: criticals.map((r) => `• ${r.name}`).join('\n'),
      inline: false,
    });
  }

  if (highs.length > 0) {
    fields.push({
      name: '⚠️ High',
      value: highs.map((r) => `• ${r.name}`).join('\n'),
      inline: false,
    });
  }

  if (auditResult.suggestedNextCommand) {
    fields.push({ name: '▶️ Next step', value: `\`${auditResult.suggestedNextCommand}\``, inline: false });
  }

  return {
    embeds: [
      {
        title: `${icon} Nerviq Audit — ${platform}`,
        color,
        fields,
        footer: { text: `nerviq v${require('../package.json').version} • ${new Date().toISOString()}` },
      },
    ],
  };
}

module.exports = { sendWebhook, formatSlackMessage, formatDiscordMessage };
