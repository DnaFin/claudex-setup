# @nerviq/sdk

Programmatic SDK for Nerviq audit, harmony, and synergy workflows.

## Install

```bash
npm install @nerviq/sdk
```

## Usage

```js
const { audit, harmonyAudit } = require('@nerviq/sdk');

async function main() {
  const result = await audit('.', 'claude');
  console.log(result.score); // 78

  const harmony = await harmonyAudit('.');
  console.log(harmony.harmonyScore);
}

main().catch(console.error);
```

## API

```js
const {
  audit,
  harmonyAudit,
  synergyReport,
  detectPlatforms,
  getCatalog,
  routeTask,
} = require('@nerviq/sdk');
```
