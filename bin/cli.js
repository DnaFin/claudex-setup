#!/usr/bin/env node

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { version } = require('../package.json');

const args = process.argv.slice(2);
const command = args[0] || 'audit';
const flags = args.filter(a => a.startsWith('--'));

const HELP = `
  claudex-setup v${version}
  Audit and optimize any project for Claude Code.
  Powered by 1,107 verified techniques.

  Usage:
    npx claudex-setup              Run audit on current directory
    npx claudex-setup audit        Same as above
    npx claudex-setup setup        Apply recommended configuration
    npx claudex-setup setup --auto Apply all recommendations without prompts
    npx claudex-setup badge        Generate shields.io badge markdown

  Options:
    --verbose    Show detailed analysis
    --json       Output as JSON
    --help       Show this help
    --version    Show version
`;

async function main() {
  if (flags.includes('--help') || command === 'help') {
    console.log(HELP);
    process.exit(0);
  }

  if (flags.includes('--version') || command === 'version') {
    console.log(version);
    process.exit(0);
  }

  const options = {
    verbose: flags.includes('--verbose'),
    json: flags.includes('--json'),
    auto: flags.includes('--auto'),
    dir: process.cwd()
  };

  try {
    if (command === 'badge') {
      const { getBadgeMarkdown } = require('../src/badge');
      const result = await audit({ ...options, silent: true });
      console.log(getBadgeMarkdown(result.score));
      console.log('');
      console.log('Add this to your README.md');
      process.exit(0);
    } else if (command === 'setup') {
      await setup(options);
    } else {
      await audit(options);
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
