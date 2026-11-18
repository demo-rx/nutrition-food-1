# Changelog

Newest entries first.

## 2026-11-17

- Replaced the exposed browser OpenRouter credential with a Cloudflare Worker secret
- Restricted the Worker to the GitHub Pages origin, approved models, a 9MB request, and six scans per IP per minute
- Added Worker deployment instructions and a public `workerUrl` frontend setting
- Changed the scan flow to call OpenRouter Vision through the Worker from static browser files
- Removed the OpenRouter key form; scan now reads only the public Worker URL from configuration
- Kept the existing app login and subscription gate unchanged
- Removed the static scan flow's dependency on `/api/estimate-plate` and `/api/analyze-food`
- Added model fallback and client-side response validation; no shared API key is committed or persisted

## 2026-10-26

- Athlete snacks: morning, afternoon, night/post-workout
- BMI calculator only on the landing page
- Reports page: week / month / 6 months / year with calorie, sugar & fat charts, expected weight change, coach share
- Upload a photo of a written meal program to auto-fill a default week/month; edit any slot; tap “this was it” to confirm you followed that meal
- Coach can fill a meal program into weekly/monthly planner; athlete sees follow / allowed-swap / substitute / missed alerts; coach report shows weekly then monthly compliance
- Scan results: pick breakfast/lunch/dinner (or eating now) and save to the weekly meal planner
- Planner stores meals on this device (no login required) and shows a 7-day week strip


- Split BMI and planner into separate buttons; BMI is its own free page (`bmi.html`)
- Removed BMI calculator from the scan results screen
- App is trilingual: Persian, English, Arabic (`js/i18n.js`)
- Language switcher on home, scan, and planner; RTL for FA/AR, LTR for EN
- Food names from analysis include Arabic when available

## 2026-08-23

- Results: per-item sugar in the plate breakdown
- Added Nutrition Facts table (calories, fat, saturated fat, carbs, fiber, sugar, protein, salt, sodium)
- Added BMI form (height/weight) with WHO-style category and advice; saved in localStorage
- Gemini/mock analyze now returns fat, carbs, fiber, and per-item sugar

## 2026-08-12

- Redesigned logo (bowl + scan frame + leaf); fixed broken SVG characters
- Auto mode unchanged
- Added portion mode choice: AI estimate vs manual weight/portion size entry
- Fixed Gemini model: `gemini-2.0-flash` → `gemini-3.6-flash` (old model retired)
- Added food scan feature: `scan.html`, `js/scan.js`, `css/scan.css`
- Added Node.js server: `server/` with `/api/analyze-food` endpoint
- Gemini Vision integration + mock mode for demo without API key
- Updated landing page CTA to link to scan
- Added `.cursor/rules/project-conventions.mdc` — core project rules
- Added `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`
- Created SVG logos (`assets/logo.svg`, `assets/logo-icon.svg`)
- Created mobile landing page (`index.html`)
