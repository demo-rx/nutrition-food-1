# Architecture

## Overview

Mobile-only nutrition app with a static frontend. Food scanning uses a Cloudflare Worker proxy so the OpenRouter key is never shipped to browsers; the Node.js server remains optional for legacy/local APIs.

## User Flow — Food Scan

```
Auto mode:
  app login → mode → photo → Cloudflare Worker → OpenRouter → results

Manual mode:
  mode → photo → AI estimates ALL plate items
  → user edits names/grams → Confirm
  → calculate nutrition → results (item sugar + facts table + BMI)
```

## Page Structure

```
index.html          → landing, links to scan.html
scan.html           → camera → preview → analyze → results
```

## Static food analysis

`js/openrouter-scan.js` reads the public Worker URL from `window.HNP_OPENROUTER.workerUrl`. The Worker adds the secret credential, restricts the GitHub Pages origin and supported models, caps request size, and rate-limits scans. There is no key-entry form or OAuth flow.

Production Worker: `https://healthy-nutrition-openrouter.nasrmohammad4804.workers.dev`

The existing app login/subscription gate is unchanged and runs before scan logic.

## Optional legacy server

```
server/index.js
  ├── GET  /api/health
  ├── POST /api/analyze-food
  └── static files from project root
```

### Analyze modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| `mock` | Default when no `GEMINI_API_KEY` | Returns random sample nutrition data |
| `gemini` | `GEMINI_API_KEY` set or `ANALYZE_MODE=gemini` | Gemini Vision analyzes image |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-12 | Mobile-only, no desktop layout | Owner requirement |
| 2026-08-12 | Node.js local server for API | Owner choice; keeps API keys off frontend |
| 2026-08-12 | Gemini Vision for food analysis | User asked agent to choose; free tier available |
| 2026-08-12 | Mock mode default | Works immediately without API key |
| 2026-08-12 | Bilingual UI (FA + EN) on scan page | Owner preference |
| 2026-08-23 | Nutrition Facts table + per-item sugar + BMI on results | Owner request; BMI is client-only, not medical diagnosis |
| 2026-10-26 | Trilingual UI (FA / EN / AR) with one language at a time | Owner request; preference stored in localStorage |
| 2026-11-17 | GitHub Pages scan through a Cloudflare Worker | Removes Node.js/user-login requirements while keeping the shared key out of frontend source |

## Security Notes

- No shared API key is shipped in frontend files
- The frontend stores only the public Worker URL in `window.HNP_OPENROUTER.workerUrl`
- The production Worker accepts browser requests from `https://demo-rx.github.io`
- Hosted scanning requires HTTPS; localhost remains supported for development
- Camera requires HTTPS or localhost
- Max upload 8MB

## Future (not built yet)

- User accounts / meal history
- Framework migration (React Native / PWA)
- Persian-only mode toggle
