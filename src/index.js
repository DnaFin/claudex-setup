const { audit } = require('./audit');
const { setup } = require('./setup');
const { analyzeProject } = require('./analyze');
const { buildProposalBundle, applyProposalBundle } = require('./plans');
const { getGovernanceSummary } = require('./governance');
const { runBenchmark } = require('./benchmark');
const { DOMAIN_PACKS, detectDomainPacks } = require('./domain-packs');
const { MCP_PACKS, getMcpPack, mergeMcpServers, getMcpPackPreflight, recommendMcpPacks } = require('./mcp-packs');
const { recordRecommendationOutcome, getRecommendationOutcomeSummary, formatRecommendationOutcomeSummary } = require('./activity');

module.exports = {
  audit,
  setup,
  analyzeProject,
  buildProposalBundle,
  applyProposalBundle,
  getGovernanceSummary,
  runBenchmark,
  DOMAIN_PACKS,
  detectDomainPacks,
  MCP_PACKS,
  getMcpPack,
  mergeMcpServers,
  getMcpPackPreflight,
  recommendMcpPacks,
  recordRecommendationOutcome,
  getRecommendationOutcomeSummary,
  formatRecommendationOutcomeSummary,
};
