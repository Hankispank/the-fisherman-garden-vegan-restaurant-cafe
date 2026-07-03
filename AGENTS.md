# AGENTS.md — Rules for editing this restaurant site

This repository is built from a shared **restaurant website template**. Its functionality
is identical across all sites and must stay that way. These rules apply to every human and
AI assistant working in this repo. Read [`TEMPLATE.md`](TEMPLATE.md) before making changes.

## Golden rule

**Change only content, images, and theme tokens. Never change functionality.**

## You MAY edit

- `js/config.js` — business values (name, whatsapp, zalo, email, currency).
- `js/data.js` — menu, gallery, reviews content (keep the field names/shape).
- `js/i18n.js` — translation **values** only (the right-hand strings). This includes the
  `meta.title` / `meta.description` (these drive the page title + all social tags), the
  `about.*` story, and the `faq.*` questions/answers.
- `js/seo.js` — the `window.SEO_CONFIG` **values** only (baseUrl, geo, address, telephone,
  priceRange, servesCuisine, openingHours, sameAs, ogImage, `amenities` — a subset of the
  `AMENITIES_CATALOG` keys, only those genuinely true). The engine below them is locked.
- `css/styles.css` — the `:root` theme tokens only (colors, radii, fonts).
- `index.html` — visible text, image `src`, and map/link `href` only.
- Image / asset files.

> **Updating SEO for a new restaurant:** the items above marked SEO are mandatory per site.
> Follow the **[SEO content map](TEMPLATE.md#seo-content-map)** for exactly what to change and
> where, and **[`docs/NEW_SITE_CHECKLIST.md`](docs/NEW_SITE_CHECKLIST.md) §7** for the workflow.
> Do not hand-edit `og:`/`twitter:`/JSON-LD tags — they are generated from the values above.

## You MUST NOT edit

- `js/app.js` — any line (cart, ordering, reservations, rendering).
- The `window.I18N` engine in `js/i18n.js`, or any translation **key**.
- Any element `id` (e.g. `#orderNow`, `#cartFoot`, `#reserveForm`, `#orderContact`).
- Any `data-i18n` / `data-i18n-ph` attribute name.
- Block structure in `index.html` — do not add, remove, reorder, or restructure blocks
  (the `<!-- ===== BLOCK: X | START/END ===== -->` markers define them).
- The SEO injection markers in `index.html` (`<!--MENU_START-->`/`<!--MENU_END-->`,
  `TABS_*`, `GALLERY_*`, `REVIEWS_*`, `SEO_HEAD_*`) — the baker fills these; do not remove them.
- Component / structural CSS below `:root` in `css/styles.css`.
- The cart drawer and form markup (fields, channel picker, confirmation panel, honeypot).
- `js/render-core.js`, `js/seo.js` engine, `netlify/edge-functions/`, `scripts/` — the
  render/SEO machinery (edit only the `SEO_CONFIG` **values** in `js/seo.js`).

## Working agreement

- If a task seems to require touching a LOCKED area, stop and flag it. The likely correct
  action is a content/style change instead, or a change to the **template** (so all sites
  inherit it) — not a one-off functionality edit in a derived site.
- Respect the `EDITABLE` / `LOCKED` banners at the top of each file and the per-block
  markers in `index.html`.
- After content/style edits, run the QA checklist in
  [`docs/NEW_SITE_CHECKLIST.md`](docs/NEW_SITE_CHECKLIST.md) to confirm behavior is unchanged.

## Local preview

For content/style work, a plain static server is fine:

```bash
python -m http.server 8000
# open http://localhost:8000  (not the file:// path — ordering requires http)
```

But the **admin panel, edge SSR, and SEO baking do not run** under a plain static server.
To preview or test those (including the crawlable menu + JSON-LD), use the Netlify CLI:

```bash
netlify dev                       # serves the edge-baked site at http://localhost:8888
node scripts/verify-crawlable.js  # asserts the no-JS HTML has the full menu + valid JSON-LD
```

## Deploy — GitHub → Netlify (for AI agents)

**Production is deployed by CI, not by local `netlify deploy`.**

Each **derived restaurant site** has its own GitHub repository and Netlify site. The template repo itself may also deploy to a demo Netlify site for preview.

When the user asks to push or deploy the latest code:

1. **Commit** all intended changes on `main` (never commit `.claude/` or `.env`).
2. **`git push origin main`** — this triggers `.github/workflows/netlify-deploy.yml`.
3. **Wait ~1–2 min**, then verify the newest Netlify deploy title is `CI deploy <sha>` with state `ready`.
4. **Do not** run `netlify deploy --prod` locally unless CI is broken — an unlinked local folder creates stray Netlify sites.

**Per-site setup:** `scripts/new-site.mjs` writes the derived site's Netlify site ID into `.github/workflows/netlify-deploy.yml` (look for the `# SET BY new-site.mjs` marker). Set the `NETLIFY_AUTH_TOKEN` **Repository** secret on each derived GitHub repo.

Full step-by-step: [`docs/GITHUB_NETLIFY_DEPLOY.md`](docs/GITHUB_NETLIFY_DEPLOY.md).

## Research a new restaurant (Google Maps → template)

Use the **Researcher** module to harvest place facts, photos, and reviews from a Maps link,
then apply to the template SSOT after human review. See [`Researcher/SKILL.md`](Researcher/SKILL.md).

```bash
npm run research -- "https://www.google.com/maps/place/..."
```
