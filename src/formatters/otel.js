/**
 * OpenTelemetry Metrics Formatter
 *
 * Converts a nerviq audit result into an OpenTelemetry-compatible
 * metrics export format (OTLP JSON, metrics signal).
 *
 * Metrics emitted:
 *   nerviq.audit.score          — gauge   0-100
 *   nerviq.audit.checks.passed  — gauge   count of passing checks
 *   nerviq.audit.checks.failed  — gauge   count of failing checks
 *   nerviq.audit.checks.total   — gauge   total checks evaluated
 *   nerviq.audit.duration_ms    — gauge   audit wall-clock time (if provided)
 *
 * Each metric is tagged with:
 *   platform   — e.g. "claude", "codex", "cursor"
 *   version    — nerviq package version
 *
 * Output conforms to OTLP ExportMetricsServiceRequest JSON structure
 * (opentelemetry-proto/collector/metrics/v1).
 */

'use strict';

const { version: nerviqVersion } = require('../../package.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unixNanoNow() {
  // Returns current time as a bigint nanoseconds string for OTLP
  return String(BigInt(Date.now()) * 1_000_000n);
}

function makeResource(platform) {
  return {
    attributes: [
      { key: 'service.name', value: { stringValue: 'nerviq' } },
      { key: 'service.version', value: { stringValue: nerviqVersion } },
      { key: 'nerviq.platform', value: { stringValue: platform } },
    ],
    droppedAttributesCount: 0,
  };
}

function makeGauge(name, description, unit, value, attributes = [], timeUnixNano) {
  if (value === null || value === undefined) return null;
  return {
    name,
    description,
    unit,
    gauge: {
      dataPoints: [
        {
          attributes,
          startTimeUnixNano: timeUnixNano,
          timeUnixNano,
          asDouble: Number(value),
        },
      ],
    },
  };
}

// ─── Main formatter ───────────────────────────────────────────────────────────

/**
 * Convert a nerviq audit result to an OTLP-compatible metrics payload.
 *
 * @param {object} auditResult         — result from audit()
 * @param {number} [auditResult.score]
 * @param {number} [auditResult.passed]
 * @param {number} [auditResult.failed]
 * @param {number} [auditResult.total]
 * @param {string} [auditResult.platform]
 * @param {number} [auditResult.durationMs]  — optional, set by caller
 * @returns {object} OTLP ExportMetricsServiceRequest JSON
 */
function formatOtelMetrics(auditResult) {
  const platform = auditResult.platform || 'claude';
  const now = unixNanoNow();

  const sharedAttributes = [
    { key: 'nerviq.platform', value: { stringValue: platform } },
    { key: 'nerviq.version', value: { stringValue: nerviqVersion } },
  ];

  const metrics = [
    makeGauge(
      'nerviq.audit.score',
      'Nerviq audit score (0-100)',
      '1',
      auditResult.score,
      sharedAttributes,
      now,
    ),
    makeGauge(
      'nerviq.audit.checks.passed',
      'Number of checks that passed',
      '{checks}',
      auditResult.passed,
      sharedAttributes,
      now,
    ),
    makeGauge(
      'nerviq.audit.checks.failed',
      'Number of checks that failed',
      '{checks}',
      auditResult.failed,
      sharedAttributes,
      now,
    ),
    makeGauge(
      'nerviq.audit.checks.total',
      'Total number of checks evaluated',
      '{checks}',
      auditResult.total ?? ((auditResult.passed || 0) + (auditResult.failed || 0)),
      sharedAttributes,
      now,
    ),
  ].filter(Boolean);

  if (auditResult.durationMs != null) {
    const dm = makeGauge(
      'nerviq.audit.duration_ms',
      'Audit wall-clock duration in milliseconds',
      'ms',
      auditResult.durationMs,
      sharedAttributes,
      now,
    );
    if (dm) metrics.push(dm);
  }

  return {
    resourceMetrics: [
      {
        resource: makeResource(platform),
        scopeMetrics: [
          {
            scope: {
              name: 'nerviq',
              version: nerviqVersion,
            },
            metrics,
          },
        ],
      },
    ],
  };
}

module.exports = { formatOtelMetrics };
