/**
 * Official source URL + confidence registry for platform technique catalogs.
 *
 * We attach metadata at export time so the catalogs stay maintainable without
 * hand-editing hundreds of technique literals.
 */

const SOURCE_URLS = {
  claude: {
    defaultUrl: 'https://code.claude.com/docs/en/overview',
    byCategory: {
      memory: 'https://code.claude.com/docs/en/memory',
      quality: 'https://code.claude.com/docs/en/common-workflows',
      git: 'https://code.claude.com/docs/en/settings',
      workflow: 'https://code.claude.com/docs/en/common-workflows',
      security: 'https://code.claude.com/docs/en/permissions',
      automation: 'https://code.claude.com/docs/en/hooks',
      design: 'https://code.claude.com/docs/en/best-practices',
      devops: 'https://code.claude.com/docs/en/common-workflows',
      hygiene: 'https://code.claude.com/docs/en/overview',
      performance: 'https://code.claude.com/docs/en/memory',
      tools: 'https://code.claude.com/docs/en/mcp',
      prompting: 'https://code.claude.com/docs/en/best-practices',
      features: 'https://code.claude.com/docs/en/commands',
      'quality-deep': 'https://code.claude.com/docs/en/best-practices',
    },
    byKey: {
      customCommands: 'https://code.claude.com/docs/en/commands',
      multipleCommands: 'https://code.claude.com/docs/en/commands',
      deployCommand: 'https://code.claude.com/docs/en/commands',
      reviewCommand: 'https://code.claude.com/docs/en/commands',
      agents: 'https://code.claude.com/docs/en/sub-agents',
      multipleAgents: 'https://code.claude.com/docs/en/sub-agents',
      agentsHaveMaxTurns: 'https://code.claude.com/docs/en/sub-agents',
      agentHasAllowedTools: 'https://code.claude.com/docs/en/sub-agents',
      skills: 'https://code.claude.com/docs/en/skills',
      multipleSkills: 'https://code.claude.com/docs/en/skills',
      skillUsesPaths: 'https://code.claude.com/docs/en/skills',
      frontendDesignSkill: 'https://code.claude.com/docs/en/skills',
    },
  },
  codex: {
    defaultUrl: 'https://developers.openai.com/codex/cli',
    byCategory: {
      instructions: 'https://developers.openai.com/codex/guides/agents-md',
      config: 'https://developers.openai.com/codex/config-reference',
      trust: 'https://developers.openai.com/codex/agent-approvals-security',
      rules: 'https://developers.openai.com/codex/rules',
      hooks: 'https://developers.openai.com/codex/hooks',
      mcp: 'https://developers.openai.com/codex/mcp',
      skills: 'https://developers.openai.com/codex/skills',
      agents: 'https://developers.openai.com/codex/subagents',
      automation: 'https://developers.openai.com/codex/app/automations',
      review: 'https://developers.openai.com/codex/cli',
      local: 'https://developers.openai.com/codex/app/local-environments',
      'quality-deep': 'https://developers.openai.com/codex/feature-maturity',
      advisory: 'https://developers.openai.com/codex/cli',
      'pack-posture': 'https://developers.openai.com/codex/mcp',
      'repeat-usage': 'https://developers.openai.com/codex/cli',
      'release-freshness': 'https://developers.openai.com/codex/changelog',
    },
    byKey: {
      codexAutomationManuallyTested: 'https://developers.openai.com/codex/app/automations',
      codexAutomationAppPrereqAcknowledged: 'https://developers.openai.com/codex/app/automations',
      codexGitHubActionSafeStrategy: 'https://developers.openai.com/codex/github-action',
      codexGitHubActionPromptSourceExclusive: 'https://developers.openai.com/codex/github-action',
      codexGitHubActionSinglePromptSource: 'https://developers.openai.com/codex/github-action',
      codexGitHubActionTriggerAllowlistsExplicit: 'https://developers.openai.com/codex/github-action',
      codexCiAuthUsesManagedKey: 'https://developers.openai.com/codex/github-action',
      codexPluginConfigValid: 'https://developers.openai.com/codex/skills',
      codexUndoExplicit: 'https://developers.openai.com/codex/config-reference',
      codexWorktreeLifecycleDocumented: 'https://developers.openai.com/codex/app/local-environments',
    },
  },
  gemini: {
    defaultUrl: 'https://geminicli.com/docs/get-started/',
    byCategory: {
      instructions: 'https://geminicli.com/docs/cli/gemini-md/',
      config: 'https://geminicli.com/docs/reference/configuration/',
      trust: 'https://geminicli.com/docs/cli/trusted-folders/',
      hooks: 'https://geminicli.com/docs/hooks/reference/',
      mcp: 'https://geminicli.com/docs/tools/mcp-server/',
      sandbox: 'https://geminicli.com/docs/cli/sandbox/',
      agents: 'https://geminicli.com/docs/core/subagents/',
      skills: 'https://geminicli.com/docs/cli/skills/',
      automation: 'https://geminicli.com/docs/get-started/',
      extensions: 'https://geminicli.com/docs/extensions/',
      review: 'https://geminicli.com/docs/get-started/',
      'quality-deep': 'https://geminicli.com/docs/get-started/',
      commands: 'https://geminicli.com/docs/cli/custom-commands/',
      advisory: 'https://geminicli.com/docs/get-started/',
      'pack-posture': 'https://geminicli.com/docs/tools/mcp-server/',
      'repeat-usage': 'https://geminicli.com/docs/cli/session-management/',
      'release-freshness': 'https://geminicli.com/docs/changelogs/latest/',
    },
  },
  copilot: {
    defaultUrl: 'https://docs.github.com/en/copilot',
    byCategory: {
      instructions: 'https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
      config: 'https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
      trust: 'https://docs.github.com/en/copilot/responsible-use-of-github-copilot-features/github-copilot-data-handling',
      mcp: 'https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp',
      'cloud-agent': 'https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent',
      organization: 'https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-organization/manage-policies',
      'prompt-files': 'https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
      'skills-agents': 'https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent',
      'ci-automation': 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment',
      enterprise: 'https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise',
      extensions: 'https://docs.github.com/en/copilot/building-copilot-extensions/about-building-copilot-extensions',
      'quality-deep': 'https://docs.github.com/en/copilot',
      advisory: 'https://docs.github.com/en/copilot',
      freshness: 'https://docs.github.com/en/copilot',
    },
  },
  cursor: {
    defaultUrl: 'https://docs.cursor.com/',
    byCategory: {
      rules: 'https://docs.cursor.com/context/rules',
      config: 'https://docs.cursor.com/',
      trust: 'https://docs.cursor.com/enterprise/privacy-and-data-governance',
      'agent-mode': 'https://docs.cursor.com/en/chat/agent',
      mcp: 'https://docs.cursor.com/cli/mcp',
      'instructions-quality': 'https://docs.cursor.com/guides/working-with-context',
      'background-agents': 'https://docs.cursor.com/en/background-agents',
      automations: 'https://docs.cursor.com/en/background-agents/automations',
      enterprise: 'https://docs.cursor.com/enterprise',
      bugbot: 'https://docs.cursor.com/bugbot',
      'cross-surface': 'https://docs.cursor.com/',
      'quality-deep': 'https://docs.cursor.com/guides/working-with-context',
      advisory: 'https://docs.cursor.com/',
      freshness: 'https://docs.cursor.com/',
    },
  },
  windsurf: {
    defaultUrl: 'https://docs.windsurf.com/windsurf/cascade/cascade',
    byCategory: {
      rules: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      config: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      trust: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      'cascade-agent': 'https://docs.windsurf.com/windsurf/cascade/agents-md',
      mcp: 'https://docs.windsurf.com/windsurf/cascade/mcp',
      'instructions-quality': 'https://docs.windsurf.com/windsurf/cascade/agents-md',
      workflows: 'https://docs.windsurf.com/windsurf/cascade/workflows',
      memories: 'https://docs.windsurf.com/windsurf/cascade/memories',
      enterprise: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      cascadeignore: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      'cross-surface': 'https://docs.windsurf.com/windsurf/cascade/cascade',
      'quality-deep': 'https://docs.windsurf.com/windsurf/cascade/cascade',
      advisory: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      freshness: 'https://docs.windsurf.com/windsurf/cascade/cascade',
    },
  },
  aider: {
    defaultUrl: 'https://aider.chat/docs/',
    byCategory: {
      config: 'https://aider.chat/docs/config.html',
      'advanced-config': 'https://aider.chat/docs/config/aider_conf.html',
      'git-safety': 'https://aider.chat/docs/git.html',
      'model-config': 'https://aider.chat/docs/config/adv-model-settings.html',
      conventions: 'https://aider.chat/docs/usage/conventions.html',
      architecture: 'https://aider.chat/docs/usage/modes.html',
      security: 'https://aider.chat/docs/config/dotenv.html',
      ci: 'https://aider.chat/docs/usage/modes.html',
      quality: 'https://aider.chat/docs/usage/modes.html',
      'workflow-patterns': 'https://aider.chat/docs/usage/modes.html',
      'editor-integration': 'https://aider.chat/docs/config.html',
      'release-readiness': 'https://aider.chat/docs/',
    },
  },
  opencode: {
    defaultUrl: 'https://github.com/sst/opencode',
    byCategory: {
      instructions: 'https://github.com/sst/opencode/blob/dev/AGENTS.md',
      config: 'https://github.com/sst/opencode/tree/dev/.opencode',
      permissions: 'https://github.com/sst/opencode/tree/dev/.opencode',
      plugins: 'https://github.com/sst/opencode/tree/dev/.opencode',
      security: 'https://github.com/sst/opencode/blob/dev/SECURITY.md',
      mcp: 'https://github.com/sst/opencode/tree/dev/.opencode',
      ci: 'https://github.com/sst/opencode/tree/dev/.github',
      'quality-deep': 'https://github.com/sst/opencode/blob/dev/README.md',
      skills: 'https://github.com/sst/opencode/tree/dev/.opencode',
      agents: 'https://github.com/sst/opencode/blob/dev/AGENTS.md',
      commands: 'https://github.com/sst/opencode/tree/dev/.opencode',
      tui: 'https://github.com/sst/opencode/blob/dev/README.md',
      governance: 'https://github.com/sst/opencode/blob/dev/SECURITY.md',
      'release-freshness': 'https://github.com/sst/opencode/releases',
      'mixed-agent': 'https://github.com/sst/opencode/blob/dev/AGENTS.md',
      propagation: 'https://github.com/sst/opencode/tree/dev/.opencode',
    },
  },
};

const STALE_CONFIDENCE_IDS = new Set([
  'CX-B04',
  'CX-B09',
  'CX-C05',
  'CX-C06',
]);

const LAST_VERIFIED = {
  default: '2026-04-05',
};

const RUNTIME_CONFIDENCE_IDS = {
  codex: new Set([
    'CX-B01',
    'CX-C01',
    'CX-C02',
    'CX-C03',
    'CX-D01',
    'CX-E02',
    'CX-H02',
    'CX-H03',
    'CX-I01',
  ]),
  gemini: new Set(['GM-Q01', 'GM-Q02', 'GM-Q03', 'GM-Q04', 'GM-Q05']),
  copilot: new Set(['CP-Q01', 'CP-Q02', 'CP-Q03', 'CP-Q04', 'CP-Q05']),
};

function hasRuntimeVerificationSignal(technique) {
  const haystack = `${technique.name || ''}\n${technique.fix || ''}`;
  return /experiment(?:ally)? confirmed|confirmed by (?:live )?experiment|current runtime|runtime evidence|runtime-verified|validated in current runtime|observed in current runtime|measured in live experiment|reproduced in runtime|confirmed by experiment/i.test(haystack);
}

function resolveConfidence(platform, technique) {
  if (STALE_CONFIDENCE_IDS.has(technique.id)) {
    return 0.3;
  }

  if (RUNTIME_CONFIDENCE_IDS[platform]?.has(technique.id) || hasRuntimeVerificationSignal(technique)) {
    return 0.9;
  }

  return 0.7;
}

function attachSourceUrls(platform, techniques) {
  const mapping = SOURCE_URLS[platform];
  if (!mapping) {
    throw new Error(`Unknown source-url platform '${platform}'`);
  }

  for (const [key, technique] of Object.entries(techniques)) {
    const resolved =
      mapping.byKey?.[key] ||
      mapping.byCategory?.[technique.category] ||
      mapping.defaultUrl;

    if (!resolved) {
      throw new Error(`No sourceUrl mapping found for ${platform}:${key}`);
    }

    technique.sourceUrl = resolved;
    technique.confidence = resolveConfidence(platform, technique);
    technique.lastVerified = technique.lastVerified || LAST_VERIFIED[platform] || LAST_VERIFIED.default;
  }

  return techniques;
}

module.exports = {
  SOURCE_URLS,
  LAST_VERIFIED,
  attachSourceUrls,
};
