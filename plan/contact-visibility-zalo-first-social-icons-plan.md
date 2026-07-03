# Contact Visibility, Zalo-First & Footer Social Icons — Implementation Plan

**Date:** 2026-07-03 · verified against working tree at commit `a3ec7ca`
**Scope:** three owner-requested improvements: (1) opt-in display of phone/email per section, (2) Zalo-first ordering + selectable chat buttons in Find Us, (3) the footer social icons that were planned but never implemented.

---

## 0. Verified current state

- **Item 1:** Restaurant email/phone render unconditionally via `data-fact` nodes — Visit list `index.html:335–341`, footer `index.html:386–387` — filled server-side by `applyFacts()` (`bake-core.mjs:123–149`), in-browser by `applyContactFacts()` (`content-loader.js:76–92`), and by the admin sync (`admin/admin.js:270`). No show/hide mechanism exists anywhere.
- **Item 2:** WhatsApp is first + pre-selected in both channel pickers (`index.html:290–296` reserve, `457–464` cart/checkout), and is the hard fallback in `app.js:325` (`return active?.dataset.app || "whatsapp"`). The Visit section has **only** a WhatsApp button (`index.html:348–350`); no Zalo button exists on the page at all, though `cfg.zalo` is configured and `openDeepLink("zalo", …)` (`app.js:288–294`) already handles Zalo's no-prefill limitation (copy text + open `zalo.me`).
- **Item 3:** Commit `a3ec7ca` implemented only the **admin half** of `plan/footer-social-icons-implementation-plan.md` (per-platform Profile fields + a guarded `if (window.renderSocial) window.renderSocial()` at `admin/admin.js:626`). The frontend half — `SOCIAL_CATALOG`/`socialLinksHTML` in `render-core.js`, the `footerSocial` host + `SOCIAL_START/END` markers in `index.html`, the bake region in `bake-core.mjs`, `renderSocial()` in `js/seo.js`, the content-loader refresh, and the CSS — **does not exist**, so the admin call is a silent no-op and no icons render. Nothing to debug; the feature was simply not built.

Shared groundwork used by items 1+2: there is no checkbox helper in admin (`addTextField` at `admin/admin.js:1866` now supports a placeholder arg; checkboxes exist only ad-hoc at lines 757/1230).

---

## 1. Item 1 — Opt-in phone & email display per section

### 1.1 Data model (published content, no schema migration)

New optional booleans on the existing `visit` and `footer` draft objects:

| Key | Default | Semantics |
|-----|---------|-----------|
| `visit.showPhone` / `footer.showPhone` | shown | hide only when `=== false` |
| `visit.showEmail` / `footer.showEmail` | **hidden** | show only when `=== true` |

The asymmetric defaults implement the requirement "email … should **not by default** be displayed". Absent keys (all existing published blobs) therefore hide email and keep phone — the behaviour change is exactly the requested one, with no republish required for the default.

### 1.2 Markup — targetable rows (`index.html`)

Add `data-contact` to the *row* (label + value), so hiding removes the whole entry:

- `index.html:334` → `<li data-contact="phone">` (Visit phone `<li>`)
- `index.html:338` → `<li data-contact="email">` (Visit email `<li>`)
- `index.html:386` → `<a data-contact="phone" data-fact="tel" …>`
- `index.html:387` → `<a data-contact="email" data-fact="email" …>`

Footer rows carry a second attribute `data-area="footer"`; Visit rows `data-area="visit"`, so the two sections toggle independently.

### 1.3 Server bake (`netlify/edge-functions/lib/bake-core.mjs`)

New pure helper, called from `bakeHtml()` after `applyFacts(out, cfg)` (line ~236):

```js
export function applyContactVisibility(html, pub) {
  const v = (pub && pub.visit) || {}, f = (pub && pub.footer) || {};
  const hide = [];
  if (v.showEmail !== true)  hide.push(["visit", "email"]);
  if (f.showEmail !== true)  hide.push(["footer", "email"]);
  if (v.showPhone === false) hide.push(["visit", "phone"]);
  if (f.showPhone === false) hide.push(["footer", "phone"]);
  for (const [area, kind] of hide) {
    html = html.replace(new RegExp(
      '<(li|a)([^>]*data-area="' + area + '"[^>]*data-contact="' + kind + '"[^>]*)>[\\s\\S]*?<\\/\\1>', "g"), "");
  }
  return html;
}
```

`bakeHtml` already receives `shim._published` (`pub`, line 177). **Prebake note:** `scripts/prebake.mjs` bakes with no published content → email rows are stripped from the static baseline too (correct per the new default).

### 1.4 Browser (`js/content-loader.js`)

In `applyStaticDOM()` (after line 110), mirror the same rules with `el.style.display = "none" / ""` on `[data-area][data-contact]` nodes, driven by `c.visit` / `c.footer`. Runs on every content merge, so publishes flip visibility without redeploy.

### 1.5 Admin (`admin/admin.js`)

- Add a reusable helper next to `addTextField` (~line 1866):

```js
function addCheckboxField(parent, label, checked, onChange) { /* label + <input type=checkbox>, admin-field styling, fires onChange(checked) */ }
```

- **Visit editor** (`openVisitEditor`, line 1647, under "Contact info" divider): `addCheckboxField(body, "Show phone number", v.showPhone !== false, …)` and `addCheckboxField(body, "Show email address", v.showEmail === true, …)` → write `draft.visit.showPhone/showEmail`, live-toggle the matching `[data-area="visit"]` nodes, `scheduleSave()`.
- **Footer editor** (`openFooterEditor`, line 1695): same two checkboxes writing `draft.footer.*`, toggling `[data-area="footer"]` nodes.
- Update the Settings contact note (`admin.js:552`) to mention visibility is controlled per-section in the Visit/Footer editors.

### 1.6 Consistency ripples

- **JSON-LD:** `restaurant.email` (`render-core.js:337`) should follow visibility — emit only if email is shown in *at least one* section. Pass `emailVisible` into `buildJsonLd` via its params from both callers (`bake-core.mjs:179–192` knows `pub`; browser `seo.js buildGraph()` reads the merged `_CONTENT_*`/published flags via a small getter). `telephone` stays in JSON-LD regardless (core AI/Google listing datum; hiding it on-page is cosmetic).
- **llms.txt:** the Phone line stays; add an Email line only when visible (`buildLlms`, which has `shim._published`).
- **Unaffected:** Web3Forms notifications (`cfg.email` backend use, `app.js submitToEndpoint`), the reserve form's phone/email *guest contact* toggle (`index.html:259–266` — that is the guest's own contact method, not the restaurant's).

---

## 2. Item 2 — Zalo-first + selectable chat buttons in Find Us

### 2.1 Zalo-first channel pickers (checkout + reservation)

- `index.html:457–464` (`#orderChan`) and `index.html:290–296` (`#reserveChan`): reorder so the **Zalo button is first and carries `is-active`**; WhatsApp second, without `is-active`.
- `js/app.js:325`: `return active?.dataset.app || "zalo";` — fallback matches the new default.
- No other logic changes: `setupChannelPicker` (`app.js:508–519`) is order-agnostic, and `openDeepLink`'s Zalo branch (clipboard copy + `zalo.me` open + toast `msg.zaloCopied`) already exists.

### 2.2 Zalo button in the Visit ("Find us") section

- `index.html:344–350` — insert before the WhatsApp anchor:

```html
<a class="btn btn--zalo" target="_blank" rel="noopener" data-fact="zalo" data-chat="zalo"
   href="https://zalo.me/84905660623" data-i18n="visit.zalo">Chat on Zalo</a>
```

  and add `data-chat="whatsapp"` to the existing WhatsApp anchor. Zalo placed **first** (Zalo-first requirement).
- **i18n** (`js/i18n.js`): `visit.zalo` — EN `"Chat on Zalo"`, VI `"Nhắn Zalo"`.
- **CSS** (`css/styles.css`, next to `.btn--whatsapp`): `.btn--zalo { background:#0068FF; color:#fff; }` + matching hover — same shape/size as the WhatsApp button (both are `.btn`).
- **Bake** (`bake-core.mjs applyFacts`, mirror the whatsapp rule at line 141): `data-fact="zalo"` href → `"https://zalo.me/" + cfg.zalo`.

### 2.3 Owner choice: Zalo / WhatsApp / both

- **Data:** `visit.showZalo` (default true), `visit.showWhatsapp` (default true), `visit.zaloHref` (optional override, like `whatsappHref`).
- **Admin Visit editor** (`admin.js:1647ff`, "Map & Links"): `addTextField` "Zalo link (zalo.me/…)" mirroring the WhatsApp field at line 1683; two `addCheckboxField`s "Show Zalo button" / "Show WhatsApp button" toggling the `[data-chat]` anchors live + `scheduleSave()`. Also extend the draft snapshot (`admin.js:206–210` add `zaloHref`) and the draft re-apply block (`admin.js:331–339` add zalo href + visibility).
- **Browser:** `content-loader.js applyStaticDOM` (after line 110): apply `zaloHref` to `[data-chat="zalo"]` and hide either button when its flag `=== false`.
- **Server:** reuse `applyContactVisibility`-style stripping in `bakeHtml` for `data-chat` anchors when flags are `false` (extend the helper with `[visit.showZalo, visit.showWhatsapp]` rules; defaults keep both).
- Unchecking **both** is allowed but pointless; admin shows a soft note "At least one chat button is recommended" when both are off (non-blocking).

---

## 3. Item 3 — Actually implement the footer social icons

Execute `plan/footer-social-icons-implementation-plan.md` §2.1–2.8 as written — it remains valid post-`a3ec7ca`. Deltas to apply while implementing:

1. **Line drift:** re-locate anchors by pattern, not the plan's line numbers (`admin.js` grew ~107 lines; `renderAmenities` in `js/seo.js` and the amenities bake in `bake-core.mjs` are unchanged and remain the templates to mirror).
2. **Catalog reuse both directions:** admin now owns `PROFILE_FIELDS` (`admin/admin.js:26`) with hostname regexes for google/tripadvisor/yelp/facebook/instagram/tiktok. Put `SOCIAL_CATALOG` (facebook, instagram, tiktok, tripadvisor + inline SVGs) in `render-core.js` per the original plan, and refactor `PROFILE_FIELDS` to source its four overlapping host regexes from `window.RenderCore.SOCIAL_CATALOG` so the two lists cannot drift.
3. **The admin hook already exists** (`admin.js:626`) — do not re-add; the per-field `commitProfiles()` path calls it on every keystroke once `window.renderSocial` exists.
4. **Placement coordination with item 1:** the `footerSocial` div goes in `.footer__brand` after the tagline (`index.html:375`) — independent of the `data-contact` rows in `.footer__col`, no conflict.
5. Add the `verify-crawlable.js` gate from the original plan §2.8 (baked HTML contains a `.social-link--<key>` anchor for every platform matched in `SEO_CONFIG.sameAs`).

---

## 4. Build & rollout order

1. **PR 1 (item 3):** render-core + index.html markers + bake-core region + seo.js + content-loader + CSS + verify gate. Deploy → icons appear from currently published/seed `sameAs` immediately.
2. **PR 2 (items 1+2, shared surfaces):** index.html `data-contact`/`data-chat` attributes + Zalo button + picker reorder; bake-core `applyContactVisibility` + zalo fact; content-loader visibility; app.js fallback; i18n + CSS; admin `addCheckboxField` + Visit/Footer editor checkboxes + zalo field; JSON-LD/llms email gating.
3. Owner actions after deploy: review Visit/Footer editors — tick "Show email" only if wanted; confirm Zalo link; Publish.

## 5. Acceptance checklist

1. Fresh deploy, no publish: static + edge HTML show **no email** in Visit or footer; phone visible; Zalo button first in Visit, checkout and reserve pickers default to Zalo (`is-active` + `app.js` fallback).
2. Admin: tick "Show email address" in Visit editor → email `<li>` appears live; Publish → live page shows it (edge, JS off) and JSON-LD regains `email`; untick → gone from HTML, JSON-LD, and llms.txt.
3. Untick "Show WhatsApp button" → only Zalo renders in Visit (live preview + published + baked no-JS HTML).
4. Cart checkout with JS: confirm-fallback shows the Zalo button when Zalo was the channel (`app.js:353–354` unchanged, still correct).
5. Footer shows round icons for exactly the platforms present in `seo.sameAs` (Instagram *post* URLs excluded); admin Profile field edits toggle icons live; empty list hides the container.
6. `node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html` passes with the new social + contact-visibility gates.
7. VI language toggle: "Nhắn Zalo" label renders; picker defaults unaffected.

**Effort:** item 3 ~2–3 h (plan pre-exists), items 1+2 ~4–5 h combined (shared helper/visibility machinery), plus testing.
