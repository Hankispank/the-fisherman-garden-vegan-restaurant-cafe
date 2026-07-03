# Restaurant Website Template — Maps Link to Tailored Site

A **bilingual (English + Vietnamese)** restaurant website **template** with a prebake + Netlify edge SSR pipeline, admin panel, and Researcher automation that turns a Google Maps link into a tailored site.

## Template / Blueprint

This repo is the **canonical template seed** (Acme Bistro placeholder). Each real restaurant is a **fork** — change only content, images, and theme tokens. Read:

- **[TEMPLATE.md](TEMPLATE.md)** — fixed-block principle, editable vs locked matrix, block catalog.
- **[docs/TEMPLATE_FACTORY_RUNBOOK.md](docs/TEMPLATE_FACTORY_RUNBOOK.md)** — end-to-end new-site workflow.
- **[docs/NEW_SITE_CHECKLIST.md](docs/NEW_SITE_CHECKLIST.md)** — per-file verification after apply.
- **[AGENTS.md](AGENTS.md)** — guardrails for humans and AI assistants.
- **[Researcher/SKILL.md](Researcher/SKILL.md)** — Maps → research bundle → apply workflow.

## Features

- Two languages (EN / VI) with remembered toggle.
- Menu, cart, POST-first ordering (site order log) + WhatsApp / Zalo fallbacks.
- Table reservations with the same capture flow.
- SEO/AEO bake pipeline — crawlable menu + JSON-LD without JavaScript.
- Password-protected admin panel for content and SEO settings.
- Researcher module — harvest place facts, photos, and reviews from Google Maps.

## Quick start

### (A) Preview the template seed

```bash
npm install
npm run build
python -m http.server 8000
# open http://localhost:8000
```

For edge SSR, admin, and live SEO baking:

```bash
netlify dev
# open http://localhost:8888
node scripts/verify-crawlable.js
```

### (B) Create a new restaurant site

```bash
node scripts/new-site.mjs "https://www.google.com/maps/place/..." \
  --name "My Restaurant" --slug my-restaurant
```

Then follow **[docs/NEW_SITE_CHECKLIST.md](docs/NEW_SITE_CHECKLIST.md)** and **[docs/TEMPLATE_FACTORY_RUNBOOK.md](docs/TEMPLATE_FACTORY_RUNBOOK.md)**.

## Build & verify

```bash
npm run build          # prebake + verify-crawlable + scrub (skipped on Acme seed)
npm test               # unit + integration tests
npm run verify:seed    # CI guard — Acme seed intact, scrub would catch leaks
npm run verify:scrub   # run scrub gate on a derived site
```

## Deploy

Each derived site has its **own** GitHub repo and Netlify site. Push to `main` triggers CI deploy — see **[docs/GITHUB_NETLIFY_DEPLOY.md](docs/GITHUB_NETLIFY_DEPLOY.md)**.

## License

Use freely for restaurant or hospitality sites built from this template.
