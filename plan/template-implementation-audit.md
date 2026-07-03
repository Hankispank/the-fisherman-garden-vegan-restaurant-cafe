# Template Implementation Audit — The Fisherman Garden Vegan Restaurant & Cafe

**Audited:** 2026-07-01
**Scope:** How well the shared restaurant-website template was tailored into this specific site — placeholder fill-in, SEO / AI-SEO (AEO) customization, and overall effectiveness.
**Method:** Static review of the shipped source (`js/config.js`, `js/seo.js`, `js/data.js`, `js/i18n.js`, `js/render-core.js`), the baked output (`index.html` `<!--SEO_HEAD-->` JSON-LD, `llms.txt`, `sitemap.xml`, `robots.txt`), the scrub gate (`scripts/verify-no-template-data.js`) and `site-meta.json`, checked against the rules in `TEMPLATE.md` / `AGENTS.md`.

---

## Overall verdict

The template was tailored **well on content, incompletely on machine-readable data, and with two live functional defects.** Business identity, the full real menu, the brand story, FAQ and most SEO surfaces are genuinely this restaurant's own — there are **no leftover `Acme` / `Golden Lotus` placeholders** anywhere in the shipped files. However, three issues undercut effectiveness: (1) opening hours are **broken in every structured-data / AI layer**, (2) the **online-ordering & reservation submit path is dead** because the Web3Forms key is blank, and (3) the **first featured review tells readers the business has closed.** The Vietnamese half of the "bilingual" menu is also largely unfilled.

**Readiness score: ~72/100** — good content base, not launch-clean. Fixing the two Critical and one High item below is required before this is an effective, trustworthy site.

| Area | Rating | Notes |
|---|---|---|
| Placeholder fill-in (identity, menu, story) | ✅ Strong | No template tokens survive; full real menu & story |
| Contact / NAP consistency | ✅ Strong | Address, phone, email identical across Visit, Footer, JSON-LD |
| On-page SEO (title, meta, OG) | 🟡 Good | Customized & bilingual; minor name mismatch |
| Structured data (JSON-LD) | 🟠 Partial | Rich, but **opening hours empty**; review-quality issue |
| AI-SEO (`llms.txt`, amenities, FAQ) | 🟠 Partial | Great FAQ/amenities; **hours print "undefined"** |
| Ordering / reservations (function) | ❌ Broken | `web3formsKey` blank → primary POST fails |
| Bilingual (VI) completeness | 🟠 Partial | Menu names/descriptions ~unlocalized |

---

## What was tailored correctly (verified)

- **Business facts — `js/config.js`.** `name`, `shortName`, `whatsapp`/`zalo` (84905660623), `email`, `telephoneDisplay` (+84 905 660 623), `address` (An Bang Beach, Hội An Tây, Đà Nẵng), `geo` (15.9122433, 108.3416928), `currency` (VND, `₫`, after, 0 decimals), `mapEmbedSrc`, `directionsHref`, `logo` (🎣) all real and specific.
- **Menu — `js/data.js`.** 9 real categories and **149 real dishes** with correct VND prices (e.g. Vegan Pho 70,000; Special of the Fisherman starter 140,000). 36 dishes carry real responsive photos under `assets/menu/`.
- **Brand story — `js/i18n.js` `about.*`.** Fully rewritten to the real narrative (fishing family → over-fishing/plastic → An Bang's first seaside vegan restaurant → kept the name "The Fisherman"), in both EN and VI.
- **FAQ — `faq.q1..q8` / `a1..a8`.** Rewritten to real specifics (100% vegan, hours 08:00–21:00, price band 60k–140k, takeaway via WhatsApp/Zalo, family/dog-friendly, Wi-Fi/parking), EN + VI. Backs a valid `FAQPage` node.
- **SEO extras — `js/seo.js` `SEO_CONFIG`.** `baseUrl` and `ogImage` set to the live Netlify domain; `priceRange` `$`; `servesCuisine` ["Vegan","Asian fusion","Cafe"]; `acceptedPayments`; `sameAs` = real TripAdvisor + Instagram + Facebook profiles; `amenities` = ["garden","freeWifi","familyFriendly","dogsWelcome"] (plausibly true, not over-claimed).
- **Generated crawl files.** `robots.txt`, `sitemap.xml`, `llms.txt` all carry the real domain and the full 149-item menu. `Disallow: /admin` present.
- **Structured data present.** Baked `#restaurant`, `#menu` (all sections/items/prices), `Review` ×6 + `AggregateRating`, `WebSite`, `FAQPage`, `amenityFeature` + `petsAllowed:true`.
- **NAP consistency.** Address / phone / email are byte-identical in the Visit block, the footer, and the JSON-LD `PostalAddress`/`telephone`/`email`.
- **Scrub-clean.** `grep` for `Acme` / `Golden Lotus` / `Placeholder` / `lorem` / `your-access-key` finds nothing in shipped content (only unrelated dish names like "Vegan golden bag" and a locked comment).

---

## Findings (gap analysis)

### 🔴 CRITICAL 1 — Opening hours are empty/broken in all structured data and AI output

**Root cause — data-shape mismatch between the pipeline output and the SEO engine.**

`js/config.js` line 34 stores hours as:
```js
hours: [{"day":"Monday","raw":"8 AM to 9 PM"}, … ]   // keys: day, raw
```
But `js/seo.js` (lines 49–51) maps them expecting different keys:
```js
openingHours: (_C.hours || []).map(h => ({ days: (h.days||[]).map(…), opens: h.opens, closes: h.closes }))
```
`h.days`, `h.opens`, `h.closes` **don't exist** on the config objects, so every entry becomes `{days:[], opens:undefined, closes:undefined}`. `js/render-core.js` (lines 341–345) then emits one spec per entry.

**Observed shipped result:**
- `index.html` baked JSON-LD → `"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":[]}, …×7]` — seven objects, empty `dayOfWeek`, **no `opens`/`closes` at all.**
- `llms.txt` line 9 → `- Hours: Daily undefined–undefined`

**Impact:** Google, Bing and AI assistants get **no valid opening hours** from the machine layer (the visible Visit text and FAQ are correct, but those aren't the authoritative signal for "is it open now?" answers). Directly weakens the AEO goal the template is built around.

**Fix (content-only, allowed):** change `js/config.js` `hours` to the shape the engine consumes, e.g.
```js
hours: [{ days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], opens:"08:00", closes:"21:00" }],
```
(`js/seo.js` already maps `Mon`→`Monday` via `_DAY`.) Re-run prebake and re-verify the JSON-LD shows populated `dayOfWeek`/`opens`/`closes` and `llms.txt` shows `08:00–21:00`. *(If the researcher pipeline is the source of the `{day,raw}` shape, fix it at the template/pipeline level so future sites inherit the correct mapping.)*

---

### 🔴 CRITICAL 2 — Online ordering & reservations can't submit (blank Web3Forms key)

`js/config.js` line 24: `web3formsKey: ""`.
`js/app.js` posts it directly as the access key on both flows:
```js
// line 416 (order) and line 454 (reservation)
access_key: cfg.web3formsKey,
```
With an empty key the Web3Forms API rejects the request, so the **primary "instant confirmation" POST fails on every order and booking** and the flow drops to the manual WhatsApp/Zalo/email fallback. The site explicitly promises *"Free of charge, instant confirmation"* (`reserve.perk1`) and *"We'll confirm shortly"* — currently unmet.

**Secondary red flag:** `site-meta.json` reports `"scrubPassed": true`, yet the documented scrub gate `scripts/verify-no-template-data.js` (lines 54–61) lists `/web3formsKey:\s*""/` as a build-failing condition. A blank key should have **failed the build**. So either the gate did not actually run before "pass" was recorded, or the metadata is stale — worth confirming the CI gate is wired.

**Fix:** create a Web3Forms access key for the restaurant's order inbox and set it in `js/config.js` (`web3formsKey`), then confirm the scrub gate passes for the right reason. If the business intends to run on WhatsApp/Zalo only, that's a product decision — but then the "instant confirmation" copy should be softened and the required-field gate reconsidered.

---

### 🟠 HIGH 3 — The first featured review says the restaurant is closed

`js/data.js` `REVIEWS[0]` (Robert Davis, `stars: 5`):
> "NOTE: we went here for food as the reviews are great but **it was closed and a neigh[bour] said they had closed the business. Unclear if this was permanently** or just until high season begins again."

This is rendered **on-page** in the Reviews block **and** baked into the JSON-LD as a 5-star `Review` feeding `AggregateRating`. A prominent "they may have closed" testimonial actively deters visitors and pollutes structured data. The 5-star rating attached to closure text is also internally contradictory.

**Fix:** remove this entry from `REVIEWS` (or replace with another genuine positive Google review). The other five are strong, on-message testimonials. After removal, re-check `reviewCount`/`aggregateRating` regenerate correctly.

---

### 🟡 MEDIUM 4 — Vietnamese menu is essentially unlocalized (bilingual promise half-met)

Measured across `js/data.js` (149 items):
- **143 / 149 item names** have `name.vi === name.en` (only the 6 "popular" items were translated, e.g. "Phở chay").
- **149 / 149 descriptions** have `desc.vi === desc.en` — **every** dish description is English.

Because `render-core.pick()` falls back to EN when VI is absent-but-equal, a Vietnamese user (and the VI JSON-LD) sees an English menu. The UI, nav, hero, about, FAQ and category names are properly bilingual, which makes the untranslated dish text stand out. Note the scrub gate only checks for a literal `[VI — review]` sentinel, so this silent gap passes CI.

**Fix:** populate `name.vi` / `desc.vi` for the menu (highest-value: the categories already shown + top sellers). Not blocking, but needed to deliver the advertised VI experience.

---

### 🟡 MEDIUM 5 — Gallery alt text is generic (image-SEO & accessibility gap)

All **12** `GALLERY` entries share the identical alt text `"All (Google Maps)"` in both EN and VI (`js/data.js` `GALLERY[*].alt`). This is the raw scraper label, not a description. It wastes image-search ranking signals and gives screen-reader users nothing.

**Fix:** write descriptive, keyword-relevant alts per photo (e.g. "Garden seating at The Fisherman, An Bang Beach", "Vegan Buddha bowl", "Beachfront terrace"). Editable in `js/data.js` or Admin → gallery tiles (`alt.en`/`alt.vi`).

---

### 🟡 MEDIUM 6 — Star-rating figures disagree

`index.html` hero badge hardcodes **`⭐ 4.9`** (line 80), while the baked `AggregateRating` computes **`5.0`** (mean of the six hand-picked 5-star reviews). Pick one accurate figure and make the visible badge match reality; a 5.0 average drawn from six cherry-picked reviews can also read as artificial to users and to Google's review-spam heuristics.

---

### ⚪ LOW 7 — Brand name differs between title and everything else

`meta.title` / `og:title` / `twitter:title` say **"The Fisherman Vegan Restaurant & Cafe"** (drops "Garden"), while `config.name`, the JSON-LD `name`, the logo, footer and `llms.txt` H1 use the full **"The Fisherman Garden Vegan Restaurant & Cafe"**. Harmless but slightly dilutes entity consistency for search. Align on one canonical name in `i18n.meta.title` (EN + VI).

### ⚪ LOW 8 — One review left in German

`REVIEWS[4]` (Christian Otto) is in German on an EN/VI site. Optional: translate or caption for consistency.

### ⚪ LOW 9 — Most dishes have no photo (informational)

113 / 149 items have no `base`/`image`. Prices and descriptions are present so this is not a defect, but adding photos for high-margin/signature dishes would lift conversion.

---

## Priority action list

| # | Severity | Action | File(s) |
|---|---|---|---|
| 1 | 🔴 Critical | Fix `hours` to `{days,opens,closes}` shape → restore JSON-LD `openingHoursSpecification` & `llms.txt` hours | `js/config.js` (+ verify pipeline) |
| 2 | 🔴 Critical | Set a real `web3formsKey`; confirm scrub/CI gate actually runs | `js/config.js`, CI |
| 3 | 🟠 High | Remove/replace the "business closed" review #1 | `js/data.js` `REVIEWS` |
| 4 | 🟡 Medium | Translate menu `name.vi` / `desc.vi` | `js/data.js` |
| 5 | 🟡 Medium | Write descriptive gallery alt text | `js/data.js` `GALLERY` |
| 6 | 🟡 Medium | Reconcile hero "4.9" vs aggregate "5.0" | `js/i18n.js` / reviews |
| 7 | ⚪ Low | Align `meta.title` to full brand name | `js/i18n.js` |
| 8 | ⚪ Low | Handle the German review | `js/data.js` |

**Verification after fixes:** re-run the prebake, then `node scripts/verify-crawlable.js https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app/` and re-inspect the baked `<!--SEO_HEAD-->` JSON-LD (hours populated) and `llms.txt` line 9 (real hours); submit a test order and reservation to confirm the Web3Forms POST returns success rather than the fallback.

*All recommended changes are confined to the template's EDITABLE surfaces (`js/config.js`, `js/data.js`, `js/i18n.js`) — no locked functionality, block structure, IDs or `data-i18n` attributes need to change.*
