# Contributing to claudex-setup

## Adding a New Check

1. Open `src/techniques.js`
2. Add an entry to the `CHECKS` array:
   ```js
   { id: 'my-check', category: 'Quality', weight: 10, label: 'Description',
     test: (ctx) => fs.existsSync(path.join(ctx.root, 'some-file')),
     fix: 'Add some-file to your project root.' }
   ```
3. The `test` function receives a context object with `root`, `stack`, and `files`
4. Run `npm test` to verify

## Adding a New Template

1. Open `src/setup.js`
2. Add a template function to `TEMPLATES`:
   ```js
   TEMPLATES['my-template'] = (ctx) => `file content for ${ctx.stack}`;
   ```
3. Register it in the `generateFiles()` function with its output path
4. Templates receive the same context object as checks

## Adding a New Stack

1. Open `src/techniques.js`
2. Add an entry to the `STACKS` object:
   ```js
   STACKS['my-framework'] = {
     detect: (ctx) => ctx.files.includes('my-framework.config.js'),
     label: 'My Framework',
     testCmd: 'my-framework test',
     lintCmd: 'my-framework lint'
   };
   ```
3. Stack detection runs before checks, so checks can reference `ctx.stack`

## Research Backing

Every check should trace back to a technique in the [CLAUDEX catalog](https://github.com/DnaFin/claudex-setup). When adding checks, reference the technique ID in a comment:

```js
// CLAUDEX: T-042 (Mermaid diagrams reduce token usage by 73%)
```

## Running Tests

```bash
npm test
```

Tests run all checks against fixture projects in `test/fixtures/`.
