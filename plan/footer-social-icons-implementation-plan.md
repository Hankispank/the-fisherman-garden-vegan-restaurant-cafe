# Footer Social Icons — Implementation Plan

**Goal:** Show round, uniformly styled social icons (Facebook, Instagram, TikTok, Tripadvisor) in the footer, linked to the profiles already saved in admin — rendering only the platforms for which a URL exists.
**Date:** 2026-07-03 · builds on `plan/aeo-audit-gap-analysis-implementation-plan.md` (P1.4)

---

## 1. Current state (verified in code + live)

- Social URLs already have a single source of truth: `SEO_CONFIG.sameAs` — seeded at `js/seo.js:55`, edited in **Admin → ✎ Edit SETTINGS → "Profiles — one URL per line"** (`admin/admin.js:579–590` → `setDraftSeo("sameAs", arr)`), published into the content blob, and overlaid at request time (`render.js:48`) and in-browser (`js/content-loader.js:59`).
- Live published `seo` currently contains only `amenities`/`customAmenities`, so the **seed list governs**: Tripadvisor ✓, Instagram profile ✓, Facebook ✓, one Instagram *post* (not a profile), **no TikTok yet**.
- The footer (`index.html:370–396`) has no social links at all — the URLs exist only in JSON-LD `sameAs` and `llms.txt`. Nothing for customers to click.
- The **amenities feature is the exact architectural template to copy**: shared builder in `js/render-core.js` (`amenitySectionHTML`) → baked marker region in `bake-core.mjs:226` (`AMENITIES_START/END`) → browser hook `renderAmenities()` in `js/seo.js:162–170` (exposed as `window.renderAmenities`) → refreshed by `content-loader.js renderAmenitiesSection()` and by admin preview (`admin/admin.js:280, 648`). Following it keeps server-baked HTML and browser output identical (no drift) and makes the icons crawler-visible without JS.

**Design decision — no new data field.** Platform is detected from the URL hostname in `sameAs`. When the owner pastes a TikTok URL into the existing Profiles textarea and publishes, the icon appears automatically. One list drives JSON-LD `sameAs`, `llms.txt` Profiles, and now the footer — they can never disagree.

---

## 2. Changes by file

### 2.1 `js/render-core.js` — social catalog + isomorphic builder (~60 lines)

Add next to `AMENITIES_CATALOG` (same pattern; note file is LOCKED per its header — this is a deliberate template-level extension, mirrored by the amenities precedent):

```js
/* Social platform catalog — order = display order. Icons are inline 24×24
 * single-colour SVG glyphs (currentColor) so all render in one style and
 * work identically server-baked and in-browser with zero external requests. */
var SOCIAL_CATALOG = [
  { key: "facebook", label: "Facebook", host: /(^|\.)facebook\.com$/i,
    svg: '<path d="M13.4 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.4 1.4-1.4h1.4V5.5c-.6-.1-1.4-.2-2.2-.2-2.2 0-3.6 1.3-3.6 3.7v2.2H8.1V14h2.3v7h3z"/>' },
  { key: "instagram", label: "Instagram", host: /(^|\.)instagram\.com$/i,
    excludePath: /^\/(p|reel|reels|stories)\//i, // posts are not profiles
    svg: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.6" cy="7.4" r="1.2"/>' },
  { key: "tiktok", label: "TikTok", host: /(^|\.)tiktok\.com$/i,
    svg: '<path d="M14.7 3c.4 2 1.6 3.4 3.8 3.6v2.8c-1.4 0-2.7-.4-3.8-1.2v5.5c0 3.1-2.1 5.3-5 5.3-2.7 0-4.7-2-4.7-4.6 0-2.8 2.3-4.9 5.3-4.7v2.8c-1.5-.3-2.6.6-2.6 2 0 1.2.9 2 2 2 1.4 0 2.3-1 2.3-2.6V3h2.7z"/>' },
  { key: "tripadvisor", label: "Tripadvisor", host: /(^|\.)tripadvisor\.[a-z.]+$/i,
    svg: '<path d="M12 6.8c-4.4 0-8 1.2-9.5 2.7h3.1a5.2 5.2 0 0 1 8 .5 5.2 5.2 0 0 1 8-.5h2- ...see note...' }
];
```

*(Tripadvisor path: use the Simple Icons `tripadvisor` glyph — CC0, single path, 24×24 — pasted inline during implementation. All four icons must come from the same set (Simple Icons) so stroke weight/optical size match; the two stroke-based Instagram shapes above are the one exception drawn to matching 1.7px weight.)*

Builder functions (exported via the `api` object like `amenitySectionHTML`):

```js
function socialRows(sameAs) {
  var out = [], seen = {};
  SOCIAL_CATALOG.forEach(function (p) {
    (sameAs || []).some(function (u) {
      var m = String(u || "").match(/^https?:\/\/([^\/]+)(\/[^?#]*)?/i);
      if (!m || !p.host.test(m[1]) || seen[p.key]) return false;
      if (p.excludePath && p.excludePath.test(m[2] || "/")) return false;
      seen[p.key] = true; out.push({ key: p.key, label: p.label, url: u, svg: p.svg });
      return true;
    });
  });
  return out;
}

function socialLinksHTML(sameAs) {
  var rows = socialRows(sameAs);
  if (!rows.length) return "";
  return rows.map(function (p) {
    return '<a class="social-link social-link--' + p.key + '" href="' + attr(p.url) + '"' +
      ' target="_blank" rel="noopener noreferrer"' +
      ' aria-label="' + attr(p.label + " (opens in a new tab)") + '">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' + p.svg + "</svg></a>";
  }).join("");
}
```

Register both in `var api = { … socialRows, socialLinksHTML … }` (~line 376) so the edge, prebake, browser, and `verify-crawlable.js` can all reach them.

### 2.2 `index.html` — footer host + bake markers (1 edit, line ~375)

Inside `.footer__brand`, directly after the tagline `<p>`:

```html
<div class="footer__social" id="footerSocial" aria-label="Follow us">
  <!--SOCIAL_START--><!--SOCIAL_END-->
</div>
```

Same host-plus-markers construction as `amenitiesBody`; prebake fills it at build time so icons are in the no-JS HTML.

### 2.3 `netlify/edge-functions/lib/bake-core.mjs` — bake the region (2 lines)

In `bakeHtml()` next to the amenities bake (~line 171 and ~226):

```js
const socialHTML = RC.socialLinksHTML ? RC.socialLinksHTML(seo.sameAs) : "";
…
out = region(out, "SOCIAL_START", "SOCIAL_END", socialHTML);
```

Because `loadContent()` already deep-merges `published.seo` into `shim.SEO_CONFIG` (`render.js:48`), admin-published profile edits reach the baked footer with no further work.

### 2.4 `js/seo.js` — browser renderer (mirror of `renderAmenities`, ~10 lines)

Below `renderAmenities` (line 168):

```js
function renderSocial() {
  var host = document.getElementById("footerSocial");
  if (!host || !window.RenderCore || !window.RenderCore.socialLinksHTML) return;
  host.innerHTML = window.RenderCore.socialLinksHTML((window.SEO_CONFIG || {}).sameAs || []);
  host.style.display = host.firstChild ? "" : "none"; // hide wrapper when no matches
}
window.renderSocial = renderSocial;
```

Call it in `run()` (line 172) alongside the other three `try` blocks. `run()` already fires on `DOMContentLoaded` and `languagechange`, so no extra wiring (labels are platform names — language-neutral).

### 2.5 `js/content-loader.js` — refresh after published-content merge (1 line)

In `applyContent()` next to `renderAmenitiesSection()` (line ~64): `if (window.renderSocial) window.renderSocial();`

### 2.6 `admin/admin.js` — live preview (2 lines)

- In the `seoSameAs` `input` handler (line 587–590), after `window.SEO_CONFIG.sameAs = arr;` add `if (window.renderSocial) window.renderSocial();` — icons appear/disappear live as URLs are typed.
- In the post-reset/republish refresh path where `window.renderAmenities` is invoked (line 648), add the same guard-call.

### 2.7 `css/styles.css` — round, uniform chips (footer block, after line 366)

```css
/* footer social icons */
.footer__social { display: flex; gap: 0.6rem; margin-top: 0.9rem; }
.social-link {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  color: #d9d2c6; transition: color .2s, border-color .2s, transform .2s;
}
.social-link:hover { color: var(--c-gold); border-color: var(--c-gold); transform: translateY(-2px); }
.social-link svg { width: 19px; height: 19px; }
```

Uniform style is guaranteed structurally: identical 40px outlined circles, identical 19px single-colour glyphs from one icon set, one hover behaviour. (`.footer__col a { display:block }` at line 365 doesn't apply — the icons live in `.footer__brand`.) Tap targets are 40px ≥ WCAG minimum.

### 2.8 `scripts/verify-crawlable.js` — parity gate (optional, recommended)

After the amenity checks (~line 122): for each `RenderCore.socialRows(SEO_CONFIG.sameAs)` row, assert the baked HTML contains `class="social-link social-link--<key>"` and the row's href. Catches marker/regression drift the same way amenities are gated.

---

## 3. Data prerequisites (owner actions in Admin → Profiles)

1. **Add the TikTok profile URL** (none exists in seed or published data — until then, per requirement, no TikTok icon renders).
2. The Instagram **post** URL (`instagram.com/p/Blr02xBHfzu/`) is auto-excluded by the matcher (`excludePath`) — replace it with the Google Maps place URL per AEO plan P1.4 while in the editor.
3. Publish. (Note: current live blob has no `seo.sameAs`, so until a publish happens the seed at `js/seo.js:55` governs — the plan works either way.)

## 4. Rollout & acceptance

1. Implement 2.1–2.7, run `node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html` — baked `index.html` must contain three `.social-link` anchors (facebook, instagram, tripadvisor) inside `footerSocial`.
2. Deploy; view live source **with JS disabled**: icons present in footer HTML (crawler-visible backlinks corroborating JSON-LD `sameAs` — an AEO entity-trust win, not just UX).
3. In `/admin`: type a TikTok URL in Profiles → icon appears in preview instantly; clear the field → it disappears; Publish → live footer shows 4 icons after cache TTL (s-maxage=60).
4. Keyboard/AT check: each icon is a focusable `<a>` with `aria-label`, SVG `aria-hidden` — screen reader announces "Facebook (opens in a new tab)".
5. Empty-list check: with all URLs removed, `#footerSocial` is hidden (browser) and the baked region is empty (server) — no stray gap.

**Effort:** ~2–3 h including icon-path sourcing and gate updates. No schema, blob, or function changes; fully backward-compatible (missing `socialLinksHTML` is guarded everywhere, so a stale cached `render-core.js` cannot break the edge bake).
