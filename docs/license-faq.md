# Nerviq License FAQ

Nerviq is licensed under **AGPL-3.0** (GNU Affero General Public License v3.0).

This FAQ answers common questions about what you can and can't do.

---

## What can I do freely?

**Use the CLI locally** — Run `nerviq audit`, `setup`, `fix`, `benchmark`, etc. on your own machine or CI pipeline. No restrictions.

**Use it in CI/CD** — Add the GitHub Action or run `npx @nerviq/cli` in your pipeline. The output (scores, reports) is yours.

**Fork and modify** — You can fork the repo, modify it, and use your fork internally.

**Use the npm package** — Install `@nerviq/cli` globally or as a dev dependency. Normal usage is fine.

## What triggers AGPL obligations?

**Running Nerviq as a network service for others.** If you modify Nerviq and offer it as a hosted service (e.g., a SaaS dashboard that runs Nerviq audits for external users over a network), you must make your modified source code available to those users under AGPL-3.0.

This is the key difference from regular GPL: AGPL extends the source-sharing requirement to users who interact with the software over a network, not just those who receive a copy.

## Common scenarios

| Scenario | AGPL obligation? |
|----------|-----------------|
| Developer runs `nerviq audit` locally | **No** |
| CI pipeline runs `nerviq audit --threshold 60` | **No** |
| Team uses nerviq internally on their repos | **No** |
| Company wraps nerviq in an internal tool for their own devs | **No** |
| Company offers "nerviq-as-a-service" to external customers | **Yes** — must share modified source |
| Embedding nerviq checks in a paid SaaS product | **Yes** — must share modified source |
| Using nerviq output (scores, reports) in your own product | **No** — output is data, not software |

## What about the SDK (`@nerviq/sdk`)?

The SDK is also AGPL-3.0. If you import it into your application and serve that application to users over a network, the AGPL obligation applies to the combined work.

## What if I need a commercial license?

Contact us at **hello@nerviq.net** to discuss commercial licensing options. We offer:
- **Enterprise license** — use Nerviq without AGPL obligations
- **OEM license** — embed Nerviq in your own product

## Key points

- **Local CLI usage is always fine** — no obligations
- **CI usage is always fine** — no obligations
- **Internal tools are fine** — no obligations
- **Hosting for others triggers AGPL** — share your source
- **Output data is yours** — scores, reports, JSON are not covered by AGPL
