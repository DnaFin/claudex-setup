/**
 * Aider MCP Pack System — Minimal
 *
 * Aider has NO native MCP support. This module provides:
 * - Recommendations for editor integrations that bridge MCP to Aider
 * - Awareness of the --browser and /web commands for documentation
 * - Future-proofing for when/if Aider adds MCP support
 *
 * Instead of MCP, Aider users should rely on:
 * - /web command for pulling in web documentation
 * - /read for adding files to context
 * - Editor extensions (VS Code, NeoVim) that may have MCP bridges
 */

const AIDER_MCP_PACKS = [
  {
    key: 'editor-bridge-vscode',
    label: 'VS Code Extension Bridge',
    description: 'Use the Aider VS Code extension for tighter editor integration.',
    useWhen: 'VS Code users who want in-editor Aider access.',
    adoption: 'Recommended for VS Code users. Install from marketplace.',
    trustLevel: 'high',
    transport: 'editor-extension',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Install aider-chat VS Code extension for in-editor chat.',
  },
  {
    key: 'editor-bridge-neovim',
    label: 'NeoVim Plugin Bridge',
    description: 'Use the Aider NeoVim plugin for terminal-native integration.',
    useWhen: 'NeoVim users who want in-editor Aider access.',
    adoption: 'Recommended for NeoVim users. Install via plugin manager.',
    trustLevel: 'high',
    transport: 'editor-plugin',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Install aider.nvim for NeoVim integration.',
  },
  {
    key: 'web-docs',
    label: 'Web Documentation (/web)',
    description: 'Use Aider\'s built-in /web command to scrape documentation into context.',
    useWhen: 'Any project where Aider needs live documentation context.',
    adoption: 'Built-in feature, no setup required.',
    trustLevel: 'high',
    transport: 'built-in',
    requiredAuth: [],
    serverName: null,
    configProjection: null,
    recommendation: 'Use /web <url> to pull documentation into the Aider chat context.',
  },
];

/**
 * Recommend MCP-equivalent integrations for Aider.
 * Since Aider has no native MCP, these are editor/workflow recommendations.
 */
function recommendAiderMcpPacks(ctx) {
  const recommendations = [];

  // Always recommend /web for docs
  recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'web-docs'));

  // Detect editor signals
  const hasVscode = ctx.files.some(f => /\.vscode\//i.test(f));
  const hasNvim = ctx.fileContent('.nvimrc') || ctx.fileContent('init.lua');

  if (hasVscode) {
    recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'editor-bridge-vscode'));
  }

  if (hasNvim) {
    recommendations.push(AIDER_MCP_PACKS.find(p => p.key === 'editor-bridge-neovim'));
  }

  return recommendations.filter(Boolean);
}

/**
 * Get preflight warnings for Aider MCP integration (minimal).
 */
function getAiderMcpPreflight() {
  return {
    warnings: [
      'Aider has no native MCP support. Use /web command and editor extensions instead.',
    ],
    ready: true,
  };
}

module.exports = {
  AIDER_MCP_PACKS,
  recommendAiderMcpPacks,
  getAiderMcpPreflight,
};
