/**
 * Nerviq custom configuration — project-specific checks.
 *
 * This plugin adds a custom check that verifies experiment folders
 * contain evidence.md files documenting their results.
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  plugins: [
    {
      name: 'experiments-have-evidence',
      checks: {
        'experiments-have-evidence': {
          id: 'experiments-have-evidence',
          name: 'Experiment folders contain evidence',
          category: 'Quality',
          impact: 'medium',
          fix: 'Add an evidence.md file to each experiment folder documenting results, methodology, and conclusions.',
          check: (ctx) => {
            const researchDir = path.join(ctx.dir || '.', 'research', 'case-studies');
            if (!fs.existsSync(researchDir)) return false;

            try {
              const entries = fs.readdirSync(researchDir, { withFileTypes: true });
              const dirs = entries.filter(e => e.isDirectory());
              if (dirs.length === 0) return true;

              const withEvidence = dirs.filter(d => {
                const evidencePath = path.join(researchDir, d.name, 'evidence.md');
                const readmePath = path.join(researchDir, d.name, 'README.md');
                return fs.existsSync(evidencePath) || fs.existsSync(readmePath);
              });

              return withEvidence.length >= Math.ceil(dirs.length * 0.5);
            } catch {
              return false;
            }
          },
        },
      },
    },
  ],
};
