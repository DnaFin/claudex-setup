const fs = require('fs');
const os = require('os');
const path = require('path');
const { readSnapshotIndex, getHistory, compareLatest, formatHistory, exportTrendReport } = require('../src/activity');

function mkFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `claudex-jest-activity-${name}-`));
}

describe('Activity - Snapshots', () => {
  test('readSnapshotIndex returns empty array for no snapshots', () => {
    const dir = mkFixture('no-snapshots');
    try {
      expect(readSnapshotIndex(dir)).toEqual([]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('getHistory returns sorted entries', () => {
    const dir = mkFixture('sorted');
    try {
      const snapshotDir = path.join(dir, '.claude', 'claudex-setup', 'snapshots');
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, 'index.json'), JSON.stringify([
        { snapshotKind: 'audit', createdAt: '2026-01-01T00:00:00Z', summary: { score: 50 } },
        { snapshotKind: 'audit', createdAt: '2026-02-01T00:00:00Z', summary: { score: 70 } },
      ]));
      const history = getHistory(dir);
      expect(history[0].summary.score).toBe(70);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('compareLatest returns null with < 2 snapshots', () => {
    const dir = mkFixture('one-snap');
    try {
      expect(compareLatest(dir)).toBeNull();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('formatHistory returns message for no snapshots', () => {
    const dir = mkFixture('no-history');
    try {
      expect(formatHistory(dir)).toContain('No snapshots');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('exportTrendReport returns null for no snapshots', () => {
    const dir = mkFixture('no-trend');
    try {
      expect(exportTrendReport(dir)).toBeNull();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
