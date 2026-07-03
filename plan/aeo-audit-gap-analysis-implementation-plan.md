# AEO Audit — Gap Analysis & Implementation Plan

**Site:** https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app/
**Audited:** 2026-07-03 · repo working tree + live production responses
**Scope:** Answer Engine Optimization — everything an AI crawler / answer engine consumes: server-baked HTML, JSON-LD (`@graph`), `llms.txt`, `robots.txt`, `sitemap.xml`, and the admin-published content overlay.

---

## 1. How the AEO pipeline works (verified)

- `js/config.js` = single source of truth for business facts → `js/seo.js` (`SEO_CONFIG` + browser JSON-LD injector) → `js/render-core.js` (`buildJsonLd`, `collectFaq`, isomorphic markup) → consumed by both:
  - **Build time:** `scripts/prebake.mjs` bakes menu/reviews/JSON-LD into `index.html` and regenerates `robots.txt` / `sitemap.xml` / `llms.txt` via `netlify/edge-functions/lib/bake-core.mjs`, gated by `scripts/verify-crawlable.js` (see `netlify.toml [build].command`).
  - **Request time:** edge function `netlify/edge-functions/render.js` re-bakes `/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, overlaying admin-published content from `/.netlify/functions/get-content`.
- **Live overlay state (fetched 2026-07-03):** published blob contains `config` (hours: null), `seo` (only `amenities` — 11 keys — and `customAmenities`), 6 reviews, full menu. So for hours the **seed `js/config.js` governs production**, and for reviews the **published blob governs production**. This distinction drives the fix procedure below.

What is already strong: full menu + FAQ + reviews server-baked into no-JS HTML; `FAQPage` JSON-LD mirrors the visible `<details>` FAQ; absolute canonical/og:url; `llms.txt` exists and is served; robots allows all agents (incl. AI bots) and links the sitemap; build gate fails deploys with missing menu/JSON-LD.

---

## 2. Gap analysis

| # | Severity | Gap | Where |
|---|----------|-----|-------|
| G1 | **Critical** | Opening hours emitted as `undefined` / empty across ALL structured surfaces | `js/config.js` ↔ `js/seo.js:49–51`, `bake-core.mjs:277` |
| G2 | **Critical** | Review saying the restaurant "closed the business" is baked into JSON-LD + HTML | `js/data.js` `REVIEWS[0]` + published blob `reviews[0]` |
| G3 | High | `llms.txt` defects: broken hours line, hardcoded "Reservations: Yes", no FAQ/contact/updated-at | `bake-core.mjs buildLlms()` (262–310) |
| G4 | Medium | `PostalAddress` is one unstructured string — no locality/region/country | `render-core.js:334`, `js/config.js address` |
| G5 | Medium | Zero diet signals on menu items (100% vegan venue, `suitableForDiet` never emitted) | `render-core.js:311–313`, `js/data.js` (0 items tagged `veg`) |
| G6 | Medium | Self-published Google-copied reviews + `aggregateRating` — rich-result policy risk | `render-core.js:279–298` |
| G7 | Low–Med | Entity reconciliation: no `alternateName`, no Google Maps place URL in `sameAs`, an Instagram *post* used as a profile, `og:type` non-canonical | `js/seo.js:55`, `render-core.js:322`, `index.html:13` |
| G8 | Low | `WebSite` node minimal (no `inLanguage`, no `publisher`) | `render-core.js:360` |
| G9 | Low | Sitemap has no `<lastmod>` | `bake-core.mjs buildSitemap()` |
| G10 | Low | Vietnamese content invisible to crawlers (client-side toggle only, edge bakes `lang:"en"` only) | `render.js:92`, `index.html` |
| G11 | Info | Repo seed amenities (4) drift from published amenities (11, incl. "Air-conditioned", "Showers") — truthfulness unverified | `js/seo.js:62` vs published blob |

### G1 — Opening hours are broken everywhere (Critical)

`js/config.js` stores:

```js
hours: [{"day":"Monday","raw":"8 AM to 9 PM"}, …]   // {day, raw} shape
```

but `js/seo.js:49–51` maps a different shape:

```js
openingHours: (_C.hours || []).map(function (h) {
  return { days: (h.days || []).map(...), opens: h.opens, closes: h.closes };
}),
```

`h.days`, `h.opens`, `h.closes` don't exist on `{day, raw}` → every entry becomes `{days: [], opens: undefined, closes: undefined}`. Confirmed consequences:

- **Baked `index.html` JSON-LD (line 25):** `"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":[]} ×7]` — no `opens`/`closes` at all (`JSON.stringify` drops `undefined`).
- **Live `llms.txt`:** `- Hours: Daily undefined–undefined` (from `bake-core.mjs:277`).
- Only the free-text FAQ answer ("open daily from 08:00 to 21:00", `js/i18n.js:85`) and `visit.hours` carry correct hours — an answer engine parsing structured data gets nothing, or worse, the literal string "undefined".

Grep confirms `SITE_CONFIG.hours` has exactly one consumer (`js/seo.js`), so the fix is safe and localized. Published blob `config.hours` is null → a redeploy fixes production without republishing.

### G2 — "Closed the business" review in structured data (Critical)

`js/data.js` `REVIEWS[0]` (Robert Davis, 5★) and the published blob both carry:

> "NOTE: we went here for food as the reviews are great but it was closed and a neigh our said they had closed the business. Unclear if this was permanently or just until high season begins again."

This is baked into the `Restaurant.review[]` JSON-LD, the visible reviews section, and served to every crawler. An answer engine synthesizing "Is The Fisherman open?" from this page can answer **"it may have permanently closed"** — the single worst possible AEO outcome, directly contradicting the FAQ/hours on the same page. It also inflates `aggregateRating` (5★ rating attached to negative text).

**Both** sources must be fixed: removing it from `js/data.js` alone does nothing in production because `render.js:46` replaces seed reviews wholesale with `published.reviews` (6 entries).

### G3 — `llms.txt` quality (High)

`bake-core.mjs buildLlms()`:

- Line 277: `"- Hours: Daily " + seo.openingHours[0].opens + "–" + …` — emits `undefined` (G1) and assumes uniform daily hours from index 0 with a hardcoded "Daily".
- Line 280: `lines.push("- Reservations: Yes")` — hardcoded, ignores config.
- Missing high-value sections it already has data for: the 8 FAQ Q&As (`RC.collectFaq` is in scope), contact channels (email, WhatsApp/Zalo — the actual ordering path per FAQ a5), and a generation timestamp so agents can judge freshness.

### G4 — Unstructured address (Medium)

`render-core.js:334` emits `{"@type":"PostalAddress","streetAddress":"An Bang Beach, Hội An Tây, Đà Nẵng, Vietnam"}`. Local-intent answer engines match on `addressLocality`/`addressCountry`; everything is crammed into `streetAddress`.

### G5 — No diet signals (Medium)

`render-core.js:311–313` only adds `suitableForDiet: VegetarianDiet` when an item is tagged `veg` — and **zero** items in `js/data.js` carry that tag. Result: an all-vegan restaurant emits no machine-readable diet claim on any of its ~140 menu items. "Vegan" appears only in `servesCuisine` and prose. `VeganDiet` is the correct enum, and since the venue is 100% plant-based it can be asserted on every MenuItem.

### G6 — Review/rating policy risk (Medium)

The `aggregateRating` + `review[]` nodes are Google-review copies self-published on the restaurant's own site. Google treats self-serving review markup as ineligible for rich results and it can be flagged as structured-data spam. AI engines still read it (which is why G2 is critical), but keeping `aggregateRating` is a business decision to make consciously. Options in §3, Phase 2.

### G7 — Entity reconciliation (Low–Medium)

- The venue is named "The Fisherman Vegan Restaurant" on TripAdvisor, "The Fisherman Garden Vegan Restaurant & Cafe" in `config.name`, "The Fisherman Vegan Restaurant & Cafe" in `meta.title`. No `alternateName` ties these together.
- `sameAs` (`js/seo.js:55`) includes an Instagram **post** (`/p/Blr02xBHfzu/`) — not an identity URL — and omits the Google Maps place entry (the review URLs prove the place ID exists: `0x9b489c6dad4a16aa`).
- `index.html:13` `og:type` is `restaurant`; the canonical Open Graph value is `restaurant.restaurant`.

### G10 — Vietnamese invisible to crawlers (Low, real upside)

`render.js:92` hardcodes `bakeHtml(..., { lang: "en" })`. VI translations exist and are complete (`js/i18n.js`), but no crawler can ever see them; there is no `hreflang`, and `og:locale:alternate` is the only hint. Vietnamese-language answer queries will source competitors.

---

## 3. Implementation plan

### Phase 0 — Critical fixes (same day, ~1–2 h)

**P0.1 Fix the hours shape in `js/config.js`** (single consumer verified):

```js
// js/config.js — replace the hours value
hours: [{ "days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
          "opens": "08:00", "closes": "21:00" }],
```

`js/seo.js:49–51` then produces `{days:[…7 full day names], opens:"08:00", closes:"21:00"}` unchanged, and `render-core.js:341–345` emits a valid `OpeningHoursSpecification` (schema.org requires HH:MM — satisfied). No other file reads `cfg.hours`.

**P0.2 Harden `buildLlms()` hours + reservations** (`netlify/edge-functions/lib/bake-core.mjs:277–280`):

```js
// replace line 277
const oh = (seo.openingHours || []).filter((h) => h.opens && h.closes);
if (oh.length === 1 && (oh[0].days || []).length === 7) {
  lines.push("- Hours: Daily " + oh[0].opens + "–" + oh[0].closes);
} else {
  oh.forEach((h) => lines.push("- Hours: " + (h.days || []).join(", ") + " " + h.opens + "–" + h.closes));
}
// replace line 280 — derive from config instead of hardcoding
lines.push("- Reservations: " + (cfg.whatsapp || cfg.email ? "Yes" : "Contact venue"));
```

**P0.3 Remove the "closed the business" review — both sources:**

1. Delete the Robert Davis entry from `window.REVIEWS` in `js/data.js` (~line 2711 block, first entry).
2. **Production requires a republish**, not just a deploy: in `/admin` → Reviews → delete the same entry → Publish (writes via `functions/save-content.js` → `functions/publish.js`). Verify afterwards that `/.netlify/functions/get-content` returns 5 reviews.
3. `aggregateRating` self-heals (`render-core.js:291–297` recomputes: 5 reviews, 5.0).

**P0.4 Extend the build gate** so this class of bug can never ship again (`scripts/verify-crawlable.js`):

- Fail if the baked HTML or generated `llms.txt` contains the literal string `undefined`.
- Fail if any `openingHoursSpecification` entry lacks `opens`/`closes` matching `/^\d{2}:\d{2}$/` or has empty `dayOfWeek`.
- Fail if any `reviewBody` matches `/closed (the )?(business|down|permanently)/i` — a content tripwire for self-sabotaging review text.

**Deploy order:** commit P0.1/P0.2/P0.4 → deploy (prebake regenerates `index.html`, `llms.txt`, `robots.txt`, `sitemap.xml` in the repo/publish dir) → do the admin republish (P0.3.2) → spot-check live `/llms.txt` shows `Hours: Daily 08:00–21:00` and view-source JSON-LD has real hours and 5 reviews.

### Phase 1 — High-value enrichment (this week, ~half day)

**P1.1 Enrich `llms.txt`** (`bake-core.mjs buildLlms()`): after "Profiles", append a `## FAQ` section from `RC.collectFaq(t)` (`**Q** — A` lines); add `- Email:` (`cfg.email_public`), `- WhatsApp: +` (`cfg.whatsapp`), `- Order/booking: WhatsApp, Zalo, email, or on-page form`; end with `_Generated: <ISO date>_` (pass `new Date().toISOString()` from callers; prebake can use `site-meta.json builtAt`).

**P1.2 Structured address.** Add to `js/config.js`:

```js
addressParts: { streetAddress: "An Bang Beach", addressLocality: "Hội An",
                addressRegion: "Đà Nẵng", addressCountry: "VN" },
```

In `render-core.js:333–334`, prefer parts when present:

```js
var parts = (p.config && p.config.addressParts) || seo.addressParts;
if (parts) restaurant.address = Object.assign({ "@type": "PostalAddress" }, parts);
else if (addr) restaurant.address = { "@type": "PostalAddress", streetAddress: addr };
```

(Keep the flat `address` string for display/`llms.txt`.)

**P1.3 Diet signals.** In `render-core.js` MenuItem mapper (311–313), assert the house truth on every item:

```js
item.suitableForDiet = ["https://schema.org/VeganDiet", "https://schema.org/VegetarianDiet"];
```

If a per-item exception ever appears, gate on `m.tags.indexOf("nonvegan") === -1` instead. Also add `"keywords": "vegan restaurant, plant-based, An Bang Beach, Hoi An"` to the Restaurant node (sourced from a new `SEO_CONFIG.keywords`).

**P1.4 Entity fixes.**

- `js/seo.js`: add `alternateNames: ["The Fisherman", "The Fisherman Vegan Restaurant", "The Fisherman Vegan Restaurant & Cafe"]`; in `render-core.js buildJsonLd` emit `restaurant.alternateName` when present.
- `js/seo.js:55 sameAs`: replace the Instagram post URL with the Google Maps place URL (owner: copy the share link for the listing behind place ID `0x9b489c6dad4a16aa`).
- `index.html:13`: `og:type` → `restaurant.restaurant`.
- Because published `seo` overlays the seed (`render.js:48`), if `sameAs` was ever admin-edited, mirror these edits in Admin → SEO and republish.

**P1.5 Sitemap `lastmod`.** `bakeSitemap(base, lastmod)` in `bake-core.mjs` emitting `<lastmod>`; edge passes `published.publishedAt || null`, prebake passes `site-meta.json builtAt`.

### Phase 2 — Backlog / decisions

- **P2.1 Vietnamese crawlability (G10):** add a `/vi` edge route (`netlify.toml` `[[edge_functions]] path = "/vi"`) calling `bakeHtml(indexHtml, shim, { origin, lang: "vi" })` with `<html lang="vi">`, canonical `/vi`, and reciprocal `hreflang` links (`en` ↔ `vi` + `x-default`) on both variants; add `/vi` to the sitemap. Moderate effort; unlocks Vietnamese answer-engine queries.
- **P2.2 Review markup decision (G6):** keep visible review cards (good AEO content) but consider dropping `aggregateRating` + `review[]` from JSON-LD, or move to collecting first-party reviews. Owner call — document either way.
- **P2.3 Amenity truthfulness (G11):** owner to confirm the 11 published amenities (notably "Air-conditioned" and "Showers for swimmers" at a garden venue). Wrong attributes erode entity trust (the codebase's own warning at `js/seo.js:59–61`). Then sync `js/seo.js:62` seed to match published truth.
- **P2.4 robots.txt affordance:** append a comment block pointing agents at `/llms.txt` (non-standard but harmless, increasingly read):

```
# AI agents: structured summary at /llms.txt
```

- **P2.5 `WebSite` node:** add `inLanguage: ["en","vi"]` and `publisher: {"@id": base + "/#restaurant"}` in `render-core.js:360`.

---

## 4. Acceptance checklist (run after each phase)

1. `node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html` passes with the new gates (no `undefined`, valid hours, review tripwire).
2. Live `/llms.txt` → `- Hours: Daily 08:00–21:00`, FAQ section present, no `undefined`.
3. Live `/` view-source JSON-LD: `openingHoursSpecification` valid; 5 reviews; `PostalAddress` has `addressCountry: "VN"`; MenuItems carry `VeganDiet`.
4. Validate the homepage in Google Rich Results Test + Schema.org validator (Restaurant, FAQPage, Menu all error-free).
5. `/.netlify/functions/get-content` returns 5 reviews and no stale `seo.sameAs` overriding the seed.
6. Ask 2–3 answer engines: "Is The Fisherman vegan restaurant in An Bang open? What are its hours?" — answers should state open daily 08:00–21:00, with no "closed" mention (allow days–weeks for recrawl).

## 5. File-by-file change summary

| File | Change | Phase |
|------|--------|-------|
| `js/config.js` | `hours` → `{days[], opens, closes}` shape; add `addressParts` | 0, 1 |
| `js/data.js` | remove Robert Davis review from `REVIEWS` | 0 |
| Admin republish (blob) | delete same review; align `sameAs`/amenities | 0, 1, 2 |
| `netlify/edge-functions/lib/bake-core.mjs` | `buildLlms` hours/reservations/FAQ/contact/timestamp; `buildSitemap` lastmod | 0, 1 |
| `scripts/verify-crawlable.js` | `undefined` gate, hours-shape gate, review tripwire | 0 |
| `js/render-core.js` | structured `PostalAddress`, `suitableForDiet` on all items, `alternateName`, keywords, `WebSite` enrichment | 1, 2 |
| `js/seo.js` | `alternateNames`, `sameAs` cleanup (Maps URL in, IG post out), `keywords` | 1 |
| `index.html` | `og:type` → `restaurant.restaurant` (rest regenerates via prebake) | 1 |
| `netlify.toml` + `render.js` | optional `/vi` route + hreflang | 2 |
| `robots.txt` (generated) | llms.txt pointer comment in `buildRobots` | 2 |
