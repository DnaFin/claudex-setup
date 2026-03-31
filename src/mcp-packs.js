const MCP_PACKS = [
  {
    key: 'context7-docs',
    label: 'Context7 Docs',
    useWhen: 'Repos that benefit from live, current framework and library documentation during Claude sessions.',
    adoption: 'Safe default docs pack for most application repos.',
    servers: {
      context7: {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp@latest'],
      },
    },
  },
  {
    key: 'next-devtools',
    label: 'Next.js Devtools',
    useWhen: 'Next.js repos that need runtime-aware debugging and framework-specific tooling.',
    adoption: 'Useful companion pack for frontend-ui repos running Next.js.',
    servers: {
      'next-devtools': {
        command: 'npx',
        args: ['-y', 'next-devtools-mcp@latest'],
      },
    },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getMcpPack(key) {
  return MCP_PACKS.find(pack => pack.key === key) || null;
}

function normalizeMcpPackKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map(key => `${key}`.trim())
    .filter(Boolean))]
    .filter(key => !!getMcpPack(key));
}

function mergeMcpServers(existing = {}, packKeys = []) {
  const merged = clone(existing || {});
  for (const key of normalizeMcpPackKeys(packKeys)) {
    const pack = getMcpPack(key);
    if (!pack) continue;
    for (const [serverName, serverConfig] of Object.entries(pack.servers || {})) {
      if (!merged[serverName]) {
        merged[serverName] = clone(serverConfig);
      }
    }
  }
  return merged;
}

function recommendMcpPacks(stacks = [], domainPacks = []) {
  const recommended = new Set();
  const stackKeys = new Set(stacks.map(stack => stack.key));

  for (const pack of domainPacks) {
    for (const key of pack.recommendedMcpPacks || []) {
      recommended.add(key);
    }
  }

  if (stackKeys.has('nextjs')) {
    recommended.add('next-devtools');
  }
  if (stackKeys.size > 0) {
    recommended.add('context7-docs');
  }

  return MCP_PACKS
    .filter(pack => recommended.has(pack.key))
    .map(pack => clone(pack));
}

module.exports = {
  MCP_PACKS,
  getMcpPack,
  normalizeMcpPackKeys,
  mergeMcpServers,
  recommendMcpPacks,
};
