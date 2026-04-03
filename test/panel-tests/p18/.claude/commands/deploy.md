Pre-deployment checklist for Next.js.

## Pre-deploy:
1. Run `git status` — working tree must be clean
2. Run `npm run build` — must succeed with no errors
3. Run `npm test` — all tests pass
4. Run `npm run lint` — no lint errors
5. Check for `console.log` in production code
6. Verify environment variables are set in deployment platform

## Deploy:
1. If Vercel: `git push` triggers auto-deploy
2. If self-hosted: `npm run build && npm start`
3. Verify: check /api/health or main page loads
4. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
