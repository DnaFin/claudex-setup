/**
 * Recommendation Rules Export
 *
 * Reads all TECHNIQUES, groups by category, and generates
 * a structured JSON-serializable recommendation rules object.
 */

const { TECHNIQUES } = require('./techniques');
const { version } = require('../package.json');

const IMPACT_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function impactLabel(avg) {
  if (avg >= 3.5) return 'critical';
  if (avg >= 2.5) return 'high';
  if (avg >= 1.5) return 'medium';
  return 'low';
}

function generateRecommendationRules(options) {
  const opts = options || {};
  const entries = Object.entries(TECHNIQUES);

  // Group by category
  const grouped = {};
  for (const [key, t] of entries) {
    const cat = t.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...t });
  }

  // Build categories summary
  const categories = {};
  for (const [cat, checks] of Object.entries(grouped)) {
    const weights = checks.map(c => IMPACT_ORDER[c.impact] || 0);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

    // Top 5 by impact weight (descending), then by rating (descending)
    const sorted = [...checks].sort((a, b) => {
      const impactDiff = (IMPACT_ORDER[b.impact] || 0) - (IMPACT_ORDER[a.impact] || 0);
      if (impactDiff !== 0) return impactDiff;
      return (b.rating || 0) - (a.rating || 0);
    });

    const topChecks = sorted.slice(0, 5).map(c => ({
      key: c.key,
      name: c.name,
      impact: c.impact,
      fix: c.fix,
    }));

    categories[cat] = {
      checkCount: checks.length,
      averageImpact: impactLabel(avgWeight),
      topChecks,
    };
  }

  const byRepoType = {
    frontend: ['security', 'design', 'performance-budget', 'accessibility'],
    backend: ['security', 'api-versioning', 'caching', 'rate-limiting', 'observability'],
    fullstack: ['security', 'quality', 'automation', 'observability'],
    mobile: ['flutter', 'swift', 'kotlin', 'security'],
    infrastructure: ['devops', 'supply-chain', 'monitoring'],
    library: ['docs-quality', 'quality', 'git'],
  };

  const byMaturity = {
    'new-project': { focus: ['hygiene', 'security', 'quality'], skipCategories: ['quality-deep', 'enterprise'] },
    growing: { focus: ['automation', 'workflow', 'observability'], skipCategories: [] },
    mature: { focus: ['quality-deep', 'performance-budget', 'governance'], skipCategories: [] },
  };

  return {
    generatedAt: new Date().toISOString(),
    version,
    totalRules: entries.length,
    categories,
    byRepoType,
    byMaturity,
  };
}

module.exports = { generateRecommendationRules };
