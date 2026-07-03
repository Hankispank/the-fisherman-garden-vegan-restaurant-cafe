# Slim Mobile Navigation — Implementation Plan

**Date:** 2026-07-03 · verified against working tree (post-`a3ec7ca`)
**Issue:** the 44-character brand name ("The Fisherman Garden Vegan Restaurant & Cafe") wraps to 2–3 lines in the sticky top nav on mobile, making the bar very thick.

---

## 1. Review — root cause & side effects (verified)

1. **No styling exists for the logo text.** `.nav__logo-text` (`index.html:373–374`, filled from `data-fact="name"`) has **zero rules** in `css/styles.css` — no `white-space`, no `overflow`, no responsive font-size. Inside the flex row `.nav__inner` (`styles.css:114`) it competes with `.nav__actions` (lang toggle + cart + burger, ~150px) and wraps freely on narrow screens.
2. **`shortName` is dead config.** `js/config.js:16` defines `shortName: "The Fisherman"` — grep confirms no consumer anywhere (site, admin, bake, JSON-LD). The template already anticipated this exact problem and never wired it up.
3. **Secondary bug — hardcoded menu anchor:** the mobile dropdown uses `position: fixed; inset: 64px 0 auto 0` (`styles.css:479–483`), assuming a slim single-line nav. With today's thick nav the open menu overlaps the bar's lower lines; fixing nav height without fixing this would leave a visible gap, and any future thick state breaks it again.
4. Same wrapping affects the **footer brand** (`.footer__brand strong`, full name again) — not the reported issue, but noted; footer is not sticky so no action required.

## 2. Options considered

| Option | Verdict |
|--------|---------|
| A. CSS-only: one-line ellipsis on the full name | Slim, 3 lines of CSS, but "The Fisherman Garden Vegan Restaur…" is an ugly brand presentation |
| B. **Swap to `shortName` on small screens (dual-span) + ellipsis safety net** | **Recommended** — intentional branding ("The Fisherman"), uses existing config, degrades to Option A when shortName is empty, works no-JS (server-baked, CSS-toggled) |
| C. Viewport-scaled font (`clamp()`), keep full name | Unpredictable for arbitrary template names; 44 chars would need unreadably small text to fit one line |
| D. Hide text on mobile, emoji mark only | Loses brand entirely; rejected |

**Recommendation: Option B.** Render both name variants server-side in two spans and let CSS pick per breakpoint — no JS, no layout shift, crawlers still see the full name, and every layer that edits names (admin, publish overlay, bake) keeps working. Bonus AEO tie-in: `shortName` becomes a real, visible `alternateName` candidate (AEO plan P1.4).

---

## 3. Implementation

### 3.1 `index.html` — dual-span logo (lines 372–375)

```html
<a href="#home" class="nav__logo">
  <span class="nav__logo-mark" data-fact="logo">🎣</span>
  <span class="nav__logo-text nav__logo-text--full" data-fact="name">The Fisherman Garden Vegan Restaurant &amp; Cafe</span>
  <span class="nav__logo-text nav__logo-text--short" data-fact="shortName" aria-hidden="true">The Fisherman</span>
</a>
```

`aria-hidden` on the short span prevents double announcement; the full span stays in the accessibility tree at all widths (visually hidden ≠ display:none? — no: we use `display:none` per breakpoint, so instead put `aria-hidden` dynamically? Simpler and correct: both spans are plain text; screen readers on mobile read the short name — that is acceptable and honest. Drop the `aria-hidden` and let each breakpoint expose exactly one span; implement with `display:none`, which removes the hidden one from the a11y tree too. Final markup carries **no** aria attributes.)

### 3.2 `css/styles.css` — visibility toggle + safety net + slimmer mobile bar

Desktop defaults (nav block, after line 116):

```css
.nav__logo { min-width: 0; }                      /* allow flex truncation */
.nav__logo-text--short { display: none; }
.nav__logo-text {                                  /* safety net: never wrap */
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
```

In the existing `@media (max-width: 880px)` block (line 478):

```css
.nav { padding: 0.55rem 0; }                       /* was 0.85rem */
.nav__logo { font-size: 1.15rem; flex: 1; }        /* was 1.3rem */
.nav__logo-text--full { display: none; }
.nav__logo-text--short { display: inline; }
```

Fallback behaviour: if `shortName` is empty, the short span is empty → bar shows only the emoji mark; to avoid that, §3.3 makes every filler fall back to the full name. Then the worst case (site with no shortName and a long name) is a one-line ellipsised full name — Option A as the guaranteed floor. Bar height becomes deterministic (~56–60px).

### 3.3 Fill `shortName` in all three render layers (fallback = `name`)

- **Server bake** — `bake-core.mjs applyFacts()` text map (line 125–131): add `shortName: cfg.shortName || cfg.name`. The generic `data-fact` replacer (line 132–137) handles the rest — no other bake change.
- **Browser (published overlay)** — `content-loader.js applyContactFacts()`/`applyStaticDOM()`: fill `[data-fact="shortName"]` from `c.config.shortName || c.config.name`; and where `nav.logoText` is applied (line 141), scope the selector to `.nav__logo-text--full` so the admin's logo-text override doesn't clobber the short span.
- **Admin live sync** — `admin/admin.js`: the nav draft snapshot (lines 213–215) and re-apply (line 364) plus the NAV editor field (line 976) all target `.nav__logo-text` — scope those selectors to `--full` as well.

### 3.4 Make `shortName` editable — `admin/admin.js` Settings editor

In `openSettingsEditor()` next to the existing brand/phone fields (~line 540):

```js
addTextField(body, "Short name (mobile nav)", cfg.shortName || window.SITE_CONFIG.shortName || "", function (v) {
  setDraftConfig("shortName", v.trim());
  window.SITE_CONFIG.shortName = v.trim();
  document.querySelectorAll('[data-fact="shortName"]').forEach(function (n) {
    n.textContent = v.trim() || window.SITE_CONFIG.name;
  });
}, "e.g. The Fisherman");
```

`setDraftConfig` already persists into `published.config`, and the edge merges `published.config` over the seed (`render.js:41`) — so the value flows to the baked page with no further work.

### 3.5 Fix the hardcoded dropdown anchor (`styles.css:479–483`)

Replace the fixed-position hack with nav-anchored positioning so the menu always starts exactly under the bar, whatever its height:

```css
@media (max-width: 880px) {
  .nav__links {
    position: absolute; top: 100%; left: 0; right: 0;   /* was: fixed; inset: 64px 0 auto 0 */
    …existing column styles unchanged…
  }
}
```

`.nav` is `position: sticky` (`styles.css:105`) — a positioned ancestor — so `absolute; top:100%` anchors to it correctly. One behavioural check: the unscrolled nav is `background: transparent`; the dropdown has its own `background: var(--c-bg)` (line 481) so it stays opaque. Verify the open-menu state also forces the nav background (`.nav:has(.nav__links.is-open) { background: var(--c-bg); }` or toggle `is-scrolled` in the burger handler in `app.js` — pick whichever matches existing burger JS).

### 3.6 JSON-LD synergy (2 lines, optional but free)

In `render-core.js buildJsonLd()` restaurant node: `if (p.config && p.config.shortName) restaurant.alternateName = [p.config.shortName];` (merge with the AEO plan's `alternateNames` if that ships first). The visible mobile brand then corroborates the structured-data alias.

---

## 4. Acceptance checklist

1. 375px-wide viewport (iPhone SE class): nav is a single ~56–60px line — emoji + "The Fisherman" + lang/cart/burger; no wrap at 320px either.
2. Desktop ≥881px: full name, unchanged appearance; a window slowly narrowed from 1200→881px never wraps (ellipsis guard).
3. Burger menu opens flush under the bar at any nav height (no overlap/gap), scrolled and unscrolled, menu backdrop opaque.
4. View-source (JS off, edge-baked): both spans present, full name in HTML for crawlers; `shortName` filled server-side.
5. Admin: edit "Short name (mobile nav)" → mobile-width preview updates live; Publish → live edge HTML carries it. Clearing the field falls back to the full name (ellipsised on mobile).
6. Admin NAV editor "logo text" edit still updates only the desktop/full span; VI/EN toggle unaffected (name spans are `data-fact`, not i18n).
7. `node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html` passes (the `data-fact` name checks unchanged; optionally add a gate: baked HTML contains `nav__logo-text--short` with non-empty text).

**Effort:** ~1.5–2 h. Files touched: `index.html`, `css/styles.css`, `netlify/edge-functions/lib/bake-core.mjs`, `js/content-loader.js`, `admin/admin.js`, (optional) `js/render-core.js`, (possibly) the burger handler in `js/app.js` for the open-menu background.
