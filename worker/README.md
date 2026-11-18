# OpenRouter proxy Worker

This Worker keeps the shared OpenRouter key out of the GitHub Pages bundle. It accepts the production GitHub Pages origin, restricts models and request size, and allows six scans per IP per minute.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy
```

The deployed endpoint is `https://healthy-nutrition-openrouter.nasrmohammad4804.workers.dev`; it is configured as `workerUrl` in `js/config.js`.

Never add the OpenRouter key to `js/config.js`, `.dev.vars`, Git history, or this directory.
