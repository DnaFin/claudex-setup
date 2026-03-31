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
  {
    key: 'github-mcp',
    label: 'GitHub',
    useWhen: 'Repos hosted on GitHub that benefit from issue, PR, and repository context during Claude sessions.',
    adoption: 'Recommended for any GitHub-hosted project. Requires GITHUB_PERSONAL_ACCESS_TOKEN env var.',
    servers: {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' },
      },
    },
  },
  {
    key: 'postgres-mcp',
    label: 'PostgreSQL',
    useWhen: 'Repos with PostgreSQL databases that benefit from schema inspection and query assistance.',
    adoption: 'Useful for backend-api and data-pipeline repos. Requires DATABASE_URL env var.',
    servers: {
      postgres: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: '${DATABASE_URL}' },
      },
    },
  },
  {
    key: 'memory-mcp',
    label: 'Memory / Knowledge Graph',
    useWhen: 'Long-running projects that benefit from persistent entity and relationship tracking across sessions.',
    adoption: 'Useful for complex projects with many interconnected concepts. Stores data locally.',
    servers: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
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

  // GitHub MCP for repos with .github directory
  const domainKeys = new Set(domainPacks.map(p => p.key));
  if (domainKeys.has('oss-library') || domainKeys.has('enterprise-governed')) {
    recommended.add('github-mcp');
  }

  // Postgres MCP for data-heavy repos
  if (domainKeys.has('data-pipeline') || domainKeys.has('backend-api')) {
    recommended.add('postgres-mcp');
  }

  // Memory MCP for complex/monorepo projects
  if (domainKeys.has('monorepo') || domainKeys.has('enterprise-governed')) {
    recommended.add('memory-mcp');
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
