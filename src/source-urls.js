/**
 * Official source URL registry for platform technique catalogs.
 *
 * These URLs intentionally point to the nearest authoritative official page for
 * a given category or check. Some advisory/internal heuristics do not have a
 * single line-item normative doc, so they fall back to the closest official
 * platform page that governs the surrounding feature area.
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
      automation: 'https://developers.openai.com/codex/cli',
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
      automation: 'https://google-gemini.github.io/gemini-cli/docs/cli/headless.html',
      extensions: 'https://geminicli.com/docs/extensions/',
      review: 'https://ai.google.dev/gemini-api/docs/coding-agents',
      'quality-deep': 'https://geminicli.com/docs/get-started/',
      commands: 'https://geminicli.com/docs/cli/custom-commands/',
      advisory: 'https://geminicli.com/docs/get-started/',
      'pack-posture': 'https://geminicli.com/docs/tools/mcp-server/',
      'repeat-usage': 'https://geminicli.com/docs/cli/session-management/',
      'release-freshness': 'https://geminicli.com/docs/changelogs/latest/',
    },
  },
  copilot: {
    defaultUrl: 'https://docs.github.com/copilot',
    byCategory: {
      instructions: 'https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
      config: 'https://code.visualstudio.com/docs/copilot/customization/custom-instructions',
      trust: 'https://code.visualstudio.com/docs/copilot/security',
      mcp: 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
      'cloud-agent': 'https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent',
      organization: 'https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-organization/manage-policies',
      'prompt-files': 'https://code.visualstudio.com/docs/copilot/customization/prompt-files',
      'skills-agents': 'https://code.visualstudio.com/docs/copilot/agents/overview',
      'ci-automation': 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment',
      enterprise: 'https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise',
      extensions: 'https://docs.github.com/en/copilot/building-copilot-extensions/about-building-copilot-extensions',
      'quality-deep': 'https://docs.github.com/copilot',
      advisory: 'https://docs.github.com/copilot',
      freshness: 'https://github.blog/changelog/',
    },
  },
  cursor: {
    defaultUrl: 'https://cursor.com/docs',
    byCategory: {
      rules: 'https://cursor.com/docs/context/rules',
      config: 'https://cursor.com/docs',
      trust: 'https://cursor.com/docs/enterprise/privacy-and-data-governance',
      'agent-mode': 'https://docs.cursor.com/en/chat/agent',
      mcp: 'https://cursor.com/docs/cli/mcp',
      'instructions-quality': 'https://docs.cursor.com/guides/working-with-context',
      'background-agents': 'https://docs.cursor.com/en/background-agents',
      automations: 'https://cursor.com/docs/cloud-agent/automations',
      enterprise: 'https://cursor.com/docs/enterprise',
      bugbot: 'https://cursor.com/docs/bugbot',
      'cross-surface': 'https://cursor.com/docs',
      'quality-deep': 'https://docs.cursor.com/guides/working-with-context',
      advisory: 'https://cursor.com/docs',
      freshness: 'https://cursor.com/changelog',
    },
  },
  windsurf: {
    defaultUrl: 'https://docs.windsurf.com/windsurf/cascade',
    byCategory: {
      rules: 'https://windsurf.com/university/general-education/intro-rules-memories',
      config: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      trust: 'https://windsurf.com/security',
      'cascade-agent': 'https://docs.windsurf.com/windsurf/cascade/agents-md',
      mcp: 'https://docs.windsurf.com/windsurf/cascade/mcp',
      'instructions-quality': 'https://docs.windsurf.com/windsurf/cascade/agents-md',
      workflows: 'https://docs.windsurf.com/windsurf/cascade/workflows',
      memories: 'https://docs.windsurf.com/windsurf/cascade/memories',
      enterprise: 'https://windsurf.com/security',
      cascadeignore: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      'cross-surface': 'https://docs.windsurf.com/windsurf/cascade/cascade',
      'quality-deep': 'https://docs.windsurf.com/windsurf/cascade/cascade',
      advisory: 'https://docs.windsurf.com/windsurf/cascade/cascade',
      freshness: 'https://windsurf.com/changelog',
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
      ci: 'https://aider.chat/docs/scripting.html',
      quality: 'https://aider.chat/docs/usage/lint-test.html',
      'workflow-patterns': 'https://aider.chat/docs/usage/modes.html',
      'editor-integration': 'https://aider.chat/docs/config/editor.html',
      'release-readiness': 'https://aider.chat/docs/',
    },
  },
  opencode: {
    defaultUrl: 'https://opencode.ai/docs/',
    byCategory: {
      instructions: 'https://opencode.ai/docs/rules/',
      config: 'https://opencode.ai/docs/config/',
      permissions: 'https://opencode.ai/docs/permissions',
      plugins: 'https://opencode.ai/docs/plugins/',
      security: 'https://opencode.ai/docs/tools/',
      mcp: 'https://opencode.ai/docs/mcp-servers/',
      ci: 'https://opencode.ai/docs/github/',
      'quality-deep': 'https://opencode.ai/docs/',
      skills: 'https://opencode.ai/docs/skills/',
      agents: 'https://opencode.ai/docs/agents/',
      commands: 'https://opencode.ai/docs/commands/',
      tui: 'https://opencode.ai/docs/themes/',
      governance: 'https://opencode.ai/docs/github/',
      'release-freshness': 'https://opencode.ai/docs/',
      'mixed-agent': 'https://opencode.ai/docs/modes/',
      propagation: 'https://opencode.ai/docs/config/',
    },
  },
};

function attachSourceUrls(platform, techniques) {
  const mapping = SOURCE_URLS[platform];
  if (!mapping) {
    throw new Error(`Unknown source-url platform '${platform}'`);
  }

  for (const [key, technique] of Object.entries(techniques)) {
    if (technique.sourceUrl) continue;
    const resolved =
      mapping.byKey?.[key] ||
      mapping.byCategory?.[technique.category] ||
      mapping.defaultUrl;
    if (!resolved) {
      throw new Error(`No sourceUrl mapping found for ${platform}:${key}`);
    }
    technique.sourceUrl = resolved;
  }

  return techniques;
}

module.exports = {
  SOURCE_URLS,
  attachSourceUrls,
};
