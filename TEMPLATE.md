# Restaurant Website Template — Blueprint

This project is the **master blueprint** for all future restaurant websites. Every site
built from it shares the exact same functionality. When you create a new restaurant site,
you change **only three things**:

1. **Content** — business details, menu, gallery, reviews, text.
2. **Images** — photos and visual assets.
3. **Style** — the theme tokens (colors, fonts, radii).

**Functionality must never change.** The cart, online ordering (POST-first to Web3Forms),
reservations, language switching, rendering logic, element IDs, and `data-i18n` hooks are
identical across every site. This guarantees every restaurant site behaves the same, stays
maintainable, and can receive shared fixes.

> If you find yourself editing `js/app.js`, the i18n engine, element IDs, `data-i18n`
> attributes, or block structure — stop. That is a functionality change and is not allowed
> in a derived site. See ["What you must never change"](#what-you-must-never-change).

---

## The fixed-block principle

The page is a sequence of **fixed blocks**. Each block is a self-contained area marked in
[`index.html`](index.html) with explicit boundaries:

```html
<!-- ===== BLOCK: HERO | START ===== -->
<!-- EDIT: text + hero image. LOCK: structure, IDs, data-i18n attributes. -->
... block markup ...
<!-- ===== BLOCK: HERO | END ===== -->
```

You may change the **content/images/style inside** a block. You may **not** add, remove,
reorder, or restructure blocks, nor change their IDs, classes, or `data-i18n` attributes.

---

## Editable vs Locked

| File | Editable | Locked |
| --- | --- | --- |
| [`js/config.js`](js/config.js) | All values (name, numbers, email, key, currency) | — |
| [`js/data.js`](js/data.js) | All menu / gallery / review content | The field names / object shape |
| [`js/i18n.js`](js/i18n.js) | Translation **values** (the right-hand strings) | Translation **keys** + the `window.I18N` engine |
| [`css/styles.css`](css/styles.css) | The `:root` theme tokens only | All structural & component styles |
| [`index.html`](index.html) | Visible text, image `src`, map/link `href` | Block structure, element IDs, classes, `data-i18n` / `data-i18n-ph` attributes |
| [`js/app.js`](js/app.js) | — | **Entire file** |
| Image / asset files | Replace freely | — |

Rule of thumb: **content lives in `config.js`, `data.js`, and i18n values; style lives in
`:root` tokens; everything else is machinery.**

---

## Block catalog

The fixed blocks, in **canonical page order** (must match [`index.html`](index.html)):

1. **NAV** (header)
2. **HERO**
3. **HIGHLIGHTS**
4. **MENU**
5. **GALLERY**
6. **REVIEWS**
7. **ABOUT**
8. **AMENITIES**
9. **FAQ**
10. **RESERVE**
11. **VISIT**
12. **FOOTER**
13. **CART DRAWER + TOAST**

### Block order policy

- The order above is **fixed** in the template and in every derived site unless an exception is documented.
- Derived sites **may not** reorder blocks without adding `BLOCK_ORDER_EXCEPTION.md` at the repo root explaining why (e.g. explicit owner request).
- The **template repo itself never carries exceptions** — only derived forks may.

---

## Block details

### 1. NAV (header)
- **Purpose:** logo, section links, language toggle, cart button.
- **Editable:** logo text, link labels (via i18n values).
- **Locked:** language/cart logic, structure, IDs.

### 2. HERO
- **Purpose:** headline, subtitle, primary calls-to-action, trust badges.
- **Editable:** eyebrow/title/subtitle/CTA labels (i18n values), hero background image/gradient (theme).
- **Locked:** layout, anchor targets, IDs.

### 3. HIGHLIGHTS
- **Purpose:** three short value props with icons.
- **Editable:** icon emoji + text (i18n values).
- **Locked:** structure, card count behavior.

### 4. MENU
- **Purpose:** category tabs + dish cards with add-to-cart.
- **Editable:** categories & dishes in [`js/data.js`](js/data.js).
- **Locked:** rendering, tab logic, add-to-cart.

### 5. GALLERY
- **Purpose:** image grid.
- **Editable:** images / emojis / gradients in [`js/data.js`](js/data.js) (`GALLERY`).
- **Locked:** render logic.

### 6. REVIEWS
- **Purpose:** guest testimonials.
- **Editable:** review content in [`js/data.js`](js/data.js) (`REVIEWS`).
- **Locked:** render logic.

### 7. ABOUT
- **Purpose:** "Our story" narrative — high-value entity content for humans and AI.
- **Editable:** story text (i18n values: `about.*`).
- **Locked:** structure, ID (`#about`), `data-i18n` attributes.

### 8. AMENITIES
- **Purpose:** grouped "good to know" facts (family, Wi-Fi, parking, accessibility, pets…) an AI assistant matches on. One source of truth (`SEO_CONFIG.amenities`) drives the visible section **and** the `amenityFeature` JSON-LD **and** the `llms.txt` "Good to know" list.
- **Editable:** which amenities are true → `SEO_CONFIG.amenities` in [`js/seo.js`](js/seo.js) (keys from `AMENITIES_CATALOG`), or **Admin → ⚙ Settings → SEO & Social → Amenities**. Section title/eyebrow via i18n (`amenities.*`).
- **Locked:** structure, ID (`#amenities`), bake marker, the catalog/group taxonomy and render engine in [`js/render-core.js`](js/render-core.js).

### 9. FAQ
- **Purpose:** common questions that map directly to AI assistant sub-queries (dietary, reservations, hours, price, takeaway, location). Backs the `FAQPage` JSON-LD.
- **Editable:** question/answer text (i18n values: `faq.*`).
- **Locked:** structure, ID (`#faq`), classes (`faq__q` / `faq__a`), `data-i18n` attributes.

### 10. RESERVE
- **Purpose:** table booking form with Phone/Email contact toggle, WhatsApp/Zalo channel picker, and confirmation panel.
- **Editable:** lead text and perks (i18n values).
- **Locked:** form fields, element IDs, channel picker, POST-first submit logic, confirmation states.

### 11. VISIT
- **Purpose:** address, hours, phone, email, embedded map, directions.
- **Editable:** address/hours/contact text, map `src`, directions `href`.
- **Locked:** structure, IDs.

### 12. FOOTER
- **Purpose:** brand line, explore links, contact column.
- **Editable:** text (i18n values + contact).
- **Locked:** structure.

### 13. CART DRAWER + TOAST
- **Purpose:** order summary, order-type/guests/date/time, contact, channel picker, POST-first ordering, confirmation, toast notifications.
- **Editable:** labels (i18n values) only.
- **Locked:** the entire ordering mechanism, IDs, and DOM structure.

---

## Theme guide (style)

All visual styling flows from the `:root` tokens at the top of
[`css/styles.css`](css/styles.css). Change these — not the component CSS below them.

| Token | Controls |
| --- | --- |
| `--c-bg` | Page background |
| `--c-surface` | Card / panel background |
| `--c-surface-alt` | Alternating section background |
| `--c-ink` | Primary text color |
| `--c-muted` | Secondary text color |
| `--c-line` | Borders / dividers |
| `--c-primary` / `--c-primary-dark` | Brand color + hover (buttons, accents) |
| `--c-accent` | Success / secondary accent |
| `--c-gold` | Stars / highlights |
| `--c-whatsapp` / `--c-zalo` | Channel button colors (do not change brand-true values) |
| `--radius` / `--radius-sm` | Corner rounding |
| `--shadow` / `--shadow-sm` | Elevation |
| `--container` | Max content width |
| `--font-head` | Headings font |
| `--font-body` | Body font |

To restyle a site: edit these values (and the matching Google Fonts `<link>` in
`index.html` if you change fonts). Do not rewrite the component rules below `:root`.

---

## Content guide

### `js/config.js` — business details
Set `name`, `whatsapp`, `zalo`, `email`, `web3formsKey`, and `currency`. See
[`docs/NEW_SITE_CHECKLIST.md`](docs/NEW_SITE_CHECKLIST.md) for the ordering/email setup.

### `js/data.js` — menu, gallery, reviews
Copy an existing entry and change its values. Keep the field names (`id`, `cat`, `price`,
`tags`, `emoji`, `name`, `desc`) exactly. `cat` must match a category `id`.

### `js/i18n.js` — text
Edit the **right-hand string values** for `en` and `vi`. **Never rename a key** — keys are
wired into the HTML via `data-i18n` and into `app.js`. To add a language, follow the pattern
documented at the top of the file and add a matching `lang__btn` in `index.html`.

### Images / assets
Replace image files and update the `src`/`href` in `index.html` (hero, gallery, map). Keep
the surrounding markup and IDs unchanged.

### Crawlable rendering model (important)
The menu, reviews, and gallery are data-driven. To make them readable by AI crawlers that
**do not run JavaScript**, the home page is **baked server-side** by a Netlify Edge Function
([`netlify/edge-functions/render.js`](netlify/edge-functions/render.js)): it loads the live
content, runs the shared [`js/render-core.js`](js/render-core.js) module, and returns HTML
that already contains every dish (name, price, description, tags), the reviews, and one inline
`application/ld+json` graph — before any JS. In the browser, `js/app.js` then hydrates the
same markup for interactivity (tabs, cart, language). Server and browser use the **same**
render module, so they never drift.

`robots.txt`, `sitemap.xml`, and `llms.txt` are **generated** by the same edge function from
live data (so `llms.txt` always lists the full menu) — they are no longer static files.

### Single source of truth + re-skin safety
`js/config.js` (`SITE_CONFIG`) owns **every business fact** (name, phones, address, geo, hours,
map links, logo, currency). Nothing else re-declares them:

- `js/seo.js` **reads** geo/address/telephone/hours from config (only SEO-specific extras live in `SEO_CONFIG`).
- Non-translated facts in `index.html` / `admin/admin.html` carry a `data-fact` attribute and are
  **filled from config** at build/serve time by `applyFacts` (and `data-i18n` text by `applyI18n`)
  in [`bake-core.mjs`](netlify/edge-functions/lib/bake-core.mjs) — used by both the edge bake and
  `scripts/prebake.mjs`, so an agent edits facts in **one** place.
- The order-ID prefix is derived from `SITE_CONFIG.shortName` (first two letters). This is a
  **sanctioned template-level edit to the locked `js/app.js`** — every derived site self-brands;
  do not hand-edit it per site. (The de-branded banner comments in `app.js`/`admin.js`/`styles.css`
  are likewise template-level — the lock still applies to functionality, not these comments.)
- Admin runtime fallbacks (logo emoji/text) derive from `SITE_CONFIG.logo`/`name`, not literals,
  so a tailored site carries no template branding in the functionality files.
- **Scrub gate:** `scripts/verify-no-template-data.js` (`npm run verify:scrub`) fails the build if
  any template token survives the **baked** output, or if `email`/`web3formsKey`/`SEO_CONFIG.baseUrl`
  are still blank. It runs in the Netlify build (after prebake), so an un-tailored copy cannot
  deploy. The gate is **fail-closed**: every read uses `scripts/lib/safe-read.cjs` (throws on a
  truncated/NUL-padded read), the seed is integrity-checked after eval, and each output is
  re-read and asserted — a bad read/write can never cause a false pass or a half-baked page.
  (Consequence: the unmodified Golden-Lotus demo does not pass the gate — that is by design; a
  correctly tailored copy does, proven by the Part C run.)

### SEO content map
Everything an agent must change to make the SEO content this restaurant's own. Edit **only the
source columns** — the page `<title>`, `og:*`/`twitter:*` tags, JSON-LD, `robots.txt`,
`sitemap.xml`, and `llms.txt` are all **generated** from these and must not be hand-edited.

| SEO surface | Source to edit | What to set |
|---|---|---|
| Page title + social title/description | `js/i18n.js` → `meta.title`, `meta.description` (en + vi) | The restaurant's name + one-line pitch. Drives `<title>`, `og:title/description`, `twitter:*`. |
| Business facts (NAP, hours, cuisine, price) | `js/seo.js` → `SEO_CONFIG` | `baseUrl` (live domain), `address`, `telephone`, `geo`, `openingHours`, `priceRange`, `servesCuisine`, `acceptedPayments`. |
| Off-page authority + share image | `js/seo.js` → `SEO_CONFIG.sameAs`, `ogImage` (or **Admin → ⚙ Settings → SEO & Social**) | Google Business / TripAdvisor / Yelp / social URLs; a share image (`og:image`). |
| Amenities ("good to know") | `js/seo.js` → `SEO_CONFIG.amenities` (or **Admin → ⚙ Settings → SEO & Social → Amenities**) | A subset of the 14 `AMENITIES_CATALOG` keys: `familyFriendly`, `kidsPlayground`, `highChairs`, `kidsMenu`, `freeWifi`, `digitalNomads`, `powerOutlets`, `garden`, `airConditioned`, `showers`, `wheelchairAccessible`, `carParking`, `scooterParking`, `dogsWelcome`. **Only list what is genuinely true** — drives the Amenities section, `amenityFeature` JSON-LD, and `llms.txt`. |
| Entity story | `js/i18n.js` → `about.*` (en + vi) | Founding year, founder, neighborhood, signature dishes — concrete specifics. |
| Q&A for AI sub-queries | `js/i18n.js` → `faq.*` (en + vi) | Real answers (dietary, reservations, hours, price, location) — the seed answers are Golden-Lotus-specific, **rewrite them**. |
| Visible address/phone (must match NAP) | `index.html` Visit block + footer | Keep identical to `SEO_CONFIG.address`/`telephone`. |

### `js/seo.js` — AI/search business facts
Holds `window.SEO_CONFIG`. Edit the values only; the engine is locked. The JSON-LD itself is
built by `render-core` and emitted both server-side (baked) and in-browser.

**Per-site SEO checklist (do this for every restaurant):**
1. `js/seo.js` → set `baseUrl` (live domain — used for canonical/og:url/sitemap; falls back to
   the request origin if blank), `ogImage` (absolute share-image URL), `geo`, `address`,
   `telephone`, `priceRange`, `servesCuisine`, `acceptedPayments`, `openingHours`, and `sameAs`
   (Google Business / social / TripAdvisor URLs).
2. Fill the `about.*` story and `faq.*` answers with concrete, specific details (real founding
   year, signature dishes, exact location) — specifics are what AI assistants quote.
3. After deploy, run `node scripts/verify-crawlable.js https://yourdomain/` — it asserts every
   dish + price + description and a valid JSON-LD graph are present in the no-JS HTML.
4. Off-site (not code, but decisive): claim the Google Business Profile and keep NAP (name,
   address, phone) **identical** to the site across all directories.

> Deferred by design: per-language (`/vi/`) URLs + `hreflang`. The default-language page is
> fully baked and crawlable; the instant in-page language toggle is kept for humans.

---

## What you must never change

- `js/app.js` — any line.
- The `window.I18N` engine block in `js/i18n.js`, and any translation **key**.
- Any element `id` (e.g. `#orderNow`, `#cartFoot`, `#reserveForm`, `#orderContact`).
- Any `data-i18n` / `data-i18n-ph` attribute name.
- Block structure: do not add, remove, reorder, or restructure blocks.
- Component / structural CSS below `:root`.
- The cart drawer and form markup (fields, channel picker, confirmation panel, honeypot).

Changing any of the above breaks the shared-functionality guarantee. If a genuinely new
feature is needed, it belongs in **this template**, after which all sites inherit it.

---

## Related docs

- [`docs/NEW_SITE_CHECKLIST.md`](docs/NEW_SITE_CHECKLIST.md) — step-by-step to launch a new site.
- [`docs/GITHUB_NETLIFY_DEPLOY.md`](docs/GITHUB_NETLIFY_DEPLOY.md) — GitHub push → Netlify CI deploy (incl. AI agent instructions).
- [`Researcher/README.md`](Researcher/README.md) + [`Researcher/SKILL.md`](Researcher/SKILL.md) — Google Maps → research bundle → template apply.
- [`AGENTS.md`](AGENTS.md) — rules for humans and AI assistants editing a derived repo.
- [`README.md`](README.md) — general project overview and setup.
