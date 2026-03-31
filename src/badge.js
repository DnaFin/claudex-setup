function getBadgeUrl(score) {
  const color = score >= 80 ? 'brightgreen' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'red';
  const label = encodeURIComponent('Claude Code Ready');
  const message = encodeURIComponent(`${score}/100`);
  return `https://img.shields.io/badge/${label}-${message}-${color}`;
}

function getBadgeMarkdown(score) {
  const url = getBadgeUrl(score);
  return `[![Claude Code Ready](${url})](https://github.com/DnaFin/claudex-setup)`;
}

module.exports = { getBadgeUrl, getBadgeMarkdown };
