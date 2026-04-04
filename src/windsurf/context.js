/**
 * Windsurf project context.
 *
 * Extends the shared ProjectContext with Windsurf-specific file lookups:
 * - .windsurf/rules/*.md (Markdown + YAML frontmatter, NOT MDC)
 * - .windsurfrules (legacy, flat file)
 * - .windsurf/mcp.json (MCP server config with team whitelist)
 * - .windsurf/workflows/*.md (slash commands / workflows)
 * - .windsurf/memories/ (team-syncable memories)
 * - .cascadeignore (gitignore-like for Cascade agent)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProjectContext } = require('../context');
const { tryParseJson, parseWindsurfRule, detectRuleType, getValueByPath } = require('./config-parser');

function listFiles(fullPath, filter) {
  try {
    const entries = fs.readdirSync(fullPath).filter(f => !f.startsWith('.'));
    return filter ? entries.filter(filter) : entries;
  } catch {
    return [];
  }
}

class WindsurfProjectContext extends ProjectContext {

  // ─── Rules (.windsurf/rules/*.md) ──────────────────────────────────────

  /**
   * List all .md rule files in .windsurf/rules/.
   * Returns array of { name, path, frontmatter, body, ruleType }.
   *
   * Windsurf uses Markdown + YAML frontmatter (NOT MDC like Cursor).
   * 4 activation modes: Always, Auto, Agent-Requested, Manual.
   * 10K char limit per rule file.
   */
  windsurfRules() {
    const dir = path.join(this.dir, '.windsurf', 'rules');
    const files = listFiles(dir, f => f.endsWith('.md'));
    return files.map(f => {
      const relPath = `.windsurf/rules/${f}`;
      const content = this.fileContent(relPath);
      if (!content) return null;
      const parsed = parseWindsurfRule(content);
      const ruleType = detectRuleType(parsed.frontmatter);
      return {
        name: f.replace('.md', ''),
        path: relPath,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        ruleType,
        charCount: (content || '').length,
        overLimit: (content || '').length > 10000,
      };
    }).filter(Boolean);
  }

  /**
   * Get rules filtered by type.
   */
  alwaysRules() {
    return this.windsurfRules().filter(r => r.ruleType === 'always');
  }

  autoRules() {
    return this.windsurfRules().filter(r => r.ruleType === 'auto');
  }

  agentRequestedRules() {
    return this.windsurfRules().filter(r => r.ruleType === 'agent-requested');
  }

  manualRules() {
    return this.windsurfRules().filter(r => r.ruleType === 'manual');
  }

  // ─── Legacy .windsurfrules ────────────────────────────────────────────

  /**
   * .windsurfrules content (deprecated).
   */
  legacyWindsurfrules() {
    return this.fileContent('.windsurfrules');
  }

  hasLegacyRules() {
    return Boolean(this.legacyWindsurfrules());
  }

  // ─── MCP config (.windsurf/mcp.json) ──────────────────────────────────

  /**
   * .windsurf/mcp.json parsed.
   * Windsurf MCP format: { mcpServers: { name: { command, args, env } } }
   * Supports team-level whitelist.
   */
  mcpConfig() {
    const content = this.fileContent('.windsurf/mcp.json');
    if (!content) {
      return { ok: false, data: null, error: 'missing .windsurf/mcp.json', source: '.windsurf/mcp.json' };
    }
    const parsed = tryParseJson(content);
    return { ...parsed, source: '.windsurf/mcp.json' };
  }

  /**
   * Global MCP config (~/.windsurf/mcp.json).
   */
  globalMcpConfig() {
    const homeDir = os.homedir();
    const globalPath = path.join(homeDir, '.windsurf', 'mcp.json');
    try {
      const content = fs.readFileSync(globalPath, 'utf8');
      const parsed = tryParseJson(content);
      return { ...parsed, source: globalPath };
    } catch {
      return { ok: false, data: null, error: 'missing global mcp.json', source: globalPath };
    }
  }

  /**
   * MCP servers from .windsurf/mcp.json.
   */
  mcpServers() {
    const result = this.mcpConfig();
    if (!result.ok || !result.data) return {};
    return result.data.mcpServers || {};
  }

  /**
   * Count total MCP tools across all servers.
   */
  totalMcpTools() {
    const servers = this.mcpServers();
    let total = 0;
    for (const server of Object.values(servers)) {
      const toolCount = server.tools ? Object.keys(server.tools).length : 5;
      total += toolCount;
    }
    return total;
  }

  // ─── Workflows (.windsurf/workflows/*.md) ─────────────────────────────

  /**
   * Workflow files (slash commands).
   * Windsurf workflows are Markdown files that define slash commands.
   */
  workflowFiles() {
    const dir = path.join(this.dir, '.windsurf', 'workflows');
    return listFiles(dir, f => f.endsWith('.md'))
      .map(f => `.windsurf/workflows/${f}`);
  }

  // ─── Memories (.windsurf/memories/) ───────────────────────────────────

  /**
   * Memory files (team-syncable persistent context).
   */
  memoryFiles() {
    const dir = path.join(this.dir, '.windsurf', 'memories');
    return listFiles(dir, f => f.endsWith('.md') || f.endsWith('.json'));
  }

  memoryContents() {
    const dir = path.join(this.dir, '.windsurf', 'memories');
    const files = this.memoryFiles();
    return files.map(f => {
      const relPath = `.windsurf/memories/${f}`;
      const content = this.fileContent(relPath);
      return { name: f, path: relPath, content };
    }).filter(item => item.content);
  }

  // ─── Cascadeignore (.cascadeignore) ───────────────────────────────────

  /**
   * .cascadeignore content (gitignore-like for Cascade agent).
   */
  cascadeignoreContent() {
    return this.fileContent('.cascadeignore');
  }

  hasCascadeignore() {
    return Boolean(this.cascadeignoreContent());
  }

  // ─── VS Code compat (.vscode/settings.json) ──────────────────────────

  vscodeSettings() {
    const content = this.fileContent('.vscode/settings.json');
    if (!content) {
      return { ok: false, data: null, error: 'missing .vscode/settings.json', source: '.vscode/settings.json' };
    }
    const parsed = tryParseJson(content);
    return { ...parsed, source: '.vscode/settings.json' };
  }

  // ─── CI Workflow files ────────────────────────────────────────────────

  ciWorkflowFiles() {
    const dir = path.join(this.dir, '.github', 'workflows');
    return listFiles(dir, f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => `.github/workflows/${f}`);
  }

  // ─── Surface detection ────────────────────────────────────────────────

  /**
   * Detect which Windsurf surfaces are configured.
   * Windsurf has NO background agents (unlike Cursor).
   */
  detectSurfaces() {
    const foreground = Boolean(
      this.windsurfRules().length > 0 ||
      this.legacyWindsurfrules() ||
      this.mcpConfig().ok
    );
    const workflows = this.workflowFiles().length > 0;
    const memories = this.memoryFiles().length > 0;
    const cascadeignore = this.hasCascadeignore();

    return { foreground, workflows, memories, cascadeignore };
  }

  // ─── Static detection ─────────────────────────────────────────────────

  static isWindsurfRepo(dir) {
    try {
      return fs.existsSync(path.join(dir, '.windsurf')) ||
        fs.existsSync(path.join(dir, '.windsurfrules'));
    } catch {
      return false;
    }
  }

  // ─── Stack detection (reuse shared) ───────────────────────────────────

  detectStacks(STACKS) {
    return super.detectStacks(STACKS);
  }
}

module.exports = {
  WindsurfProjectContext,
};
