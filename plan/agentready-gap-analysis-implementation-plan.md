# AgentReady Score (55/100) — Accuracy Analysis, Gap Analysis & Implementation Plan

**Date:** 2026-07-03 · report provided by owner from agentready-eosin.vercel.app · every claim re-verified against the live site (fetched today) and the repo.

---

## 1. Is the AgentReady output correct?

Mostly, but not entirely. Of the 14 failed checks, **10 are factually correct gaps, 2 are demonstrably false negatives, and 2 are SaaS-biased checks of limited relevance to a restaurant.** The 14 passing checks are all genuinely earned (llms.txt, robots, server-rendered content, FAQ, structured data — all shipped in the earlier AEO work).

| Failed check | Verdict | Evidence |
|---|---|---|
| llms-full.txt missing (−5) | ✅ correct | No such route in `netlify.toml`/`render.js`; 404 live |
| .well-known/llms.txt missing (−3) | ✅ correct | Not routed; 404 live |
| Sitemap lists too few URLs (−3) | ✅ correct | Live sitemap has exactly 1 URL (single-page site) |
| **Homepage missing title/meta description (−4)** | ❌ **false negative** | Live HTML serves both: `<title data-i18n="meta.title">The Fisherman Vegan Restaurant &amp; Cafe — …</title>` + full meta description (verified today). The scanner's parser most likely trips on the `data-i18n` attribute inside `<title …>` and/or the `&amp;` entity. Fix anyway — other naive agents will trip the same way |
| No about **page** (−3) | ⚠️ half-correct | A rich "Our story / About The Fisherman" section exists on the homepage (`#about`), but there is no `/about` URL — the scanner (and many agents) probe URL paths |
| No contact/company/legal pages (−3) | ⚠️ half-correct | Address + phone are visible on the page and in JSON-LD, but no `/contact` or legal page URL exists (and email is now hidden by default per the contact-visibility feature) |
| No privacy/terms pages (−3) | ✅ correct | Only a one-line privacy note near forms; no `/privacy` or `/terms`. Genuinely appropriate to add — the forms collect names + phone numbers |
| **No official links/socials (−2)** | ❌ **false negative or stale scan** | Live footer visibly links Facebook, Instagram, TripAdvisor (social icons shipped in `cb751ea`); JSON-LD `sameAs` lists them too. Possibly scanned pre-deploy — re-scan; the links may also need clearer anchor text |
| No docs page (−4), no developer/API page (−4), no OpenAPI (−4) | ⚠️ SaaS-biased | A restaurant has no API to document — today. But the planned `submit-order`/reservation function (see order-log plan) can be legitimately exposed as a bookable API with an OpenAPI spec: real value for booking agents, not score-chasing |
| No risk/disclaimer language (−3) | ✅ correct | No allergen or alcohol notes anywhere — worth adding for real-world reasons, not just the score |
| Pricing/limitations unclear (−2) | ⚠️ mostly false | Every dish has a visible price, the menu says "Prices include tax", FAQ states the price range. Scanner likely probes for a `/pricing` page. A one-line pricing policy in llms.txt may satisfy it |
| No deprecation/versioning signals (−2) | ⚠️ N/A-ish | Meaningless for a restaurant, but a "Menu last updated <date>" freshness stamp is legitimately useful to agents and may satisfy the check |

**Bottom line:** the honest recoverable range is **+25–33 points → ~80–88** without building anything fake; up to **~95** if the OpenAPI/booking-API phase ships. The 55 is a fair score *for the tool's rubric*, but treat the two false negatives and the SaaS-biased category as known measurement noise.

---

## 2. Implementation plan

Grouped in three phases: P0 = pure crawl-file work (edge + prebake, no new pages), P1 = real subpages, P2 = optional booking API. All generation goes through the existing shared module (`netlify/edge-functions/lib/bake-core.mjs`) so edge and prebake can never drift — same architecture as everything else on this site.

### Phase 0 — crawl files & parser hardening (~2 h, +12–14 pts)

**P0.1 `llms-full.txt` (+5).** New builder in `bake-core.mjs`:

```js
export function buildLlmsFull(shim, base, publishedAt) {
  const t = makeT(shim, "en");
  const cfg = shim.SITE_CONFIG || {}, seo = shim.SEO_CONFIG || {};
  const RC = shim.RenderCore, cur = cfg.currency || {};
  const L = [];
  L.push("# " + cfg.name, "", "> " + t("meta.description"), "");
  L.push("## About", "", t("about.p1"), "", t("about.p2"), "", t("about.p3"), "");
  L.push("## Key facts", "");
  // reuse the exact Key-facts block from buildLlms (hours, address, phone,
  // price range, cuisine) — extract it into a shared helper `llmsKeyFacts(shim)`
  L.push(...llmsKeyFacts(shim, base));
  L.push("", "## Frequently asked questions", "");
  for (const qa of RC.collectFaq(t)) L.push("### " + qa.q, "", qa.a, "");
  L.push("## Full menu (prices in " + (cur.code || "VND") + ", tax included)", "");
  for (const c of shim.MENU_CATEGORIES || []) {
    L.push("### " + ((c.name && c.name.en) || ""), "");
    for (const m of (shim.MENU_ITEMS || []).filter((x) => x.cat === c.id)) {
      L.push("- " + ((m.name && m.name.en) || "") + " — " + RC.money(m.price, cur, "en") +
             (m.desc && m.desc.en ? " — " + m.desc.en : ""));
    }
    L.push("");
  }
  L.push("## Guest reviews", "");
  for (const r of shim.REVIEWS || []) {
    L.push("- " + "★".repeat(r.stars || 5) + " " + ((r.text && r.text.en) || "") + " — " + (r.name || ""));
  }
  L.push("", "_Last updated: " + (publishedAt || new Date().toISOString().slice(0, 10)) + "_", "");
  return L.join("\n");
}
```

Also refactor `buildLlms()`'s Key-facts lines into `llmsKeyFacts()` and reuse in both (single source).

**P0.2 Routes** — `netlify.toml` add:

```toml
[[edge_functions]]
  path = "/llms-full.txt"
  function = "render"

[[edge_functions]]
  path = "/.well-known/llms.txt"
  function = "render"
```

`render.js` — extend the crawl-file branch (line ~73):

```js
if (path === "/robots.txt" || path === "/sitemap.xml" || path === "/llms.txt"
    || path === "/llms-full.txt" || path === "/.well-known/llms.txt") {
  …
  if (path === "/llms-full.txt")
    return textResponse(buildLlmsFull(shim, base, shim._published && shim._published.publishedAt), "text/plain");
  if (path === "/.well-known/llms.txt")
    return textResponse(buildLlms(shim, base), "text/plain");   // alias of llms.txt
  …
}
```

`scripts/prebake.mjs` (~line 80): also write `llms-full.txt` and `.well-known/llms.txt` (create the directory) so the static fallback matches.

**P0.3 Title/meta parser hardening (+0–4, fixes the false negative).**

- `bake-core.mjs` (line ~230): bake `<title>` **without attributes**: `'<title>' + escAttr(title) + '</title>'`.
- Language toggle still works by adding one line to `js/seo.js applyMeta()` (runs on `languagechange`): `document.title = t("meta.title");`
- Meta description (line ~231): reorder so standard attributes come first: `<meta name="description" content="…" data-i18n="meta.description" />`.
- `robots.txt` (in `buildRobots`): append `# llms: <base>/llms.txt · llms-full: <base>/llms-full.txt` — harmless breadcrumb some scanners credit.

**P0.4 Freshness + pricing lines in both llms files (+2–4):** `- Pricing: all menu prices in VND, tax included; most mains 60,000–140,000 ₫` and `- Menu last updated: <publishedAt>`.

### Phase 1 — real subpages: about, contact, legal (~3–4 h, +9–12 pts)

**P1.1 Page shell approach.** Four small static pages — `about.html`, `contact.html`, `privacy.html`, `terms.html` — in the repo, sharing `css/styles.css`, a slim header (logo + back-to-home), and `data-fact`/`data-i18n` attributes. Extend `scripts/prebake.mjs` to run the *existing* `applyI18n` + `applyFacts` over each (they're pure string transforms — one loop). Content sources:

- **about.html** — reuse the `about.p1–p3` i18n story + the amenities block; canonical `/about`.
- **contact.html** — address, phone, hours, map link, WhatsApp/Zalo/social links (all `data-fact`-driven); canonical `/contact`.
- **privacy.html** — plain-language policy matching reality: what the reservation/order forms collect (name, contact, order details), where it goes (order log + WhatsApp/Zalo/Web3Forms-or-blobs per current backend), retention, contact for deletion. Canonical `/privacy`.
- **terms.html** — short house terms: reservation no-show policy, alcohol served to 18+, allergen disclaimer ("dishes are prepared in a kitchen handling nuts, gluten, soy — tell us about allergies"), prices include tax. Canonical `/terms`. *(This page also supplies the risk/disclaimer language: +3.)*

Clean URLs via `netlify.toml`:

```toml
[[redirects]]
  from = "/about"
  to   = "/about.html"
  status = 200
# …same for /contact, /privacy, /terms
```

Note: these pages bake at **deploy time only** (no edge overlay) — acceptable because their content is near-static; documented limitation.

**P1.2 Link them (discoverability — scanners follow links):**

- `index.html` footer: add a nav column or bottom-bar links: About · Contact · Privacy · Terms.
- Add `on each page: <link rel="canonical">`, title, meta description (unique per page).
- Homepage footer also gets the allergen one-liner (visible disclaimer on the main page, `data-i18n="footer.allergens"`).

**P1.3 Sitemap coverage (+3).** `buildSitemap(base)` → emit `/`, `/about`, `/contact`, `/privacy`, `/terms` each with `<lastmod>` (publishedAt for `/`, deploy date for the rest). When the `/vi` variant from the AEO plan ships, add it here too.

**P1.4 Socials re-check (+2).** Footer icons are live; give each anchor visible-to-parsers text (`aria-label` already present — also add `title` attributes). Then re-scan; if still 0/2, the scanner wants plain-text links — the new contact.html lists them as text links, which should satisfy it.

### Phase 2 — optional: genuine booking API (+8–12 pts, do only after the order-log ships)

Once `functions/submit-order.js` (order-log plan) is live, the site has a real programmatic surface worth documenting — this is the only honest way to score the Docs/API category:

1. `/openapi.json` — static OpenAPI 3.1 spec describing `POST /.netlify/functions/submit-order` (order + reservation schemas, rate limits, honeypot field marked internal).
2. `/api.html` (`/api`) — one page: "Book a table or order programmatically", the endpoint, a curl example, limits (30 req/15 min), and a link to the spec. Also linked from llms-full.txt.
3. Add both to the sitemap; mention rate limits (**satisfies "pricing/limitations" and "docs/developer page" checks with real substance**).

### Explicitly not doing

Fake `/docs` trees, keyword-stuffed disclaimer boilerplate, or a `/pricing` page for a restaurant menu. The score is a means; the goal is agents correctly understanding and citing the restaurant.

## 3. Acceptance checklist

1. `curl` live: `/llms-full.txt` (full markdown incl. menu + FAQ + about), `/.well-known/llms.txt` (mirror), both also in the deploy artifacts from prebake.
2. View-source `/`: `<title>` has no attributes; language toggle still swaps the tab title (via `seo.js`); meta description attribute order `name → content`.
3. `/about`, `/contact`, `/privacy`, `/terms` return 200 with unique titles/descriptions/canonicals; footer links to all four; allergen line visible in footer.
4. `/sitemap.xml` lists ≥5 URLs with `lastmod`.
5. `verify-crawlable.js` extended: fail if llms-full.txt output lacks "## Full menu" or contains `undefined`; fail if sitemap has <5 URLs.
6. Re-scan on AgentReady: expect **~80–88** (Phase 0+1) — record the new report next to this plan. Confirm the title/meta and socials checks flipped; if title still fails, the scanner is buggy beyond our control — note and move on.
7. Post-Phase 2 re-scan: expect further Docs/API gains.

## 4. File-by-file summary

| File | Change | Phase |
|------|--------|-------|
| `netlify/edge-functions/lib/bake-core.mjs` | `buildLlmsFull`, `llmsKeyFacts` refactor, title/meta bake hardening, robots breadcrumb, sitemap URLs+lastmod | 0, 1 |
| `netlify.toml` | 2 edge routes, 4 redirects | 0, 1 |
| `netlify/edge-functions/render.js` | 2 path branches | 0 |
| `scripts/prebake.mjs` | write llms-full + .well-known; bake the 4 static pages | 0, 1 |
| `js/seo.js` | `document.title` on language change | 0 |
| `about.html`, `contact.html`, `privacy.html`, `terms.html` | new pages | 1 |
| `index.html` | footer links + allergen line | 1 |
| `js/i18n.js` | `footer.allergens`, page meta keys (EN+VI) | 1 |
| `scripts/verify-crawlable.js` | llms-full + sitemap gates | 1 |
| `openapi.json`, `api.html` | booking API docs | 2 |

**Effort:** Phase 0 ~2 h · Phase 1 ~3–4 h · Phase 2 ~2 h (after order-log). Expected score: 55 → ~80–88 → ~95.
