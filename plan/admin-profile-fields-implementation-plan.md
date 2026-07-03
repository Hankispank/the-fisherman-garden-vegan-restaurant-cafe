# Admin: Separate Profile-Link Fields — Implementation Plan

**Goal:** Replace the single "Profiles — one URL per line" textarea in Admin → ✎ Edit SETTINGS with one labeled input field per platform (Google Business, Tripadvisor, Yelp, Facebook, Instagram, TikTok), plus a catch-all for anything else.
**Date:** 2026-07-03 · companion to `plan/footer-social-icons-implementation-plan.md`

---

## 1. Current state (verified)

- The editor is built in `openSettingsEditor()` (`admin/admin.js:488`). The profiles UI is one `<textarea id="seoSameAs">` (`admin/admin.js:579–591`): value = `sameAs.join("\n")`, and its `input` handler splits on newlines → `setDraftSeo("sameAs", arr)` + `window.SEO_CONFIG.sameAs = arr`.
- Everything downstream consumes the flat `seo.sameAs` **array**: JSON-LD (`render-core.js:347`), `llms.txt` Profiles section (`bake-core.mjs:282–287`), the edge overlay (`render.js:48`), and the planned footer icons (`socialRows()` matches by hostname).
- The file already has the exact helper needed: `addTextField(body, label, value, onInput)` — used ~10× in the same editor (e.g. `admin/admin.js:505–521`).

**Design decision — UI-only change, no data-model change.** The separate fields are decomposed from and recomposed into the same `seo.sameAs` array. Published blobs, JSON-LD, `llms.txt`, and the footer-icon matcher all keep working unmodified, and old published content loads cleanly into the new UI.

---

## 2. Changes — all in `admin/admin.js`

### 2.1 Platform catalog (top-level, near other constants)

```js
// Profile platforms shown as separate fields in Settings. host = hostname
// matcher used to slot existing sameAs URLs into the right field.
var PROFILE_FIELDS = [
  { key: "google",      label: "Google Business / Maps", host: /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i,  placeholder: "https://www.google.com/maps/place/..." },
  { key: "tripadvisor", label: "Tripadvisor",            host: /(^|\.)tripadvisor\.[a-z.]+$/i,               placeholder: "https://www.tripadvisor.com/Restaurant_Review-..." },
  { key: "yelp",        label: "Yelp",                   host: /(^|\.)yelp\.[a-z.]+$/i,                      placeholder: "https://www.yelp.com/biz/..." },
  { key: "facebook",    label: "Facebook",               host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,     placeholder: "https://www.facebook.com/yourpage" },
  { key: "instagram",   label: "Instagram",              host: /(^|\.)instagram\.com$/i,                     placeholder: "https://www.instagram.com/yourhandle/" },
  { key: "tiktok",      label: "TikTok",                 host: /(^|\.)tiktok\.com$/i,                        placeholder: "https://www.tiktok.com/@yourhandle" },
];

function profileHostOf(url) {
  var m = String(url || "").match(/^https?:\/\/([^\/?#]+)/i);
  return m ? m[1] : "";
}
```

If the footer-icons plan is implemented first, reuse its hostname regexes: keep `PROFILE_FIELDS` matching `RenderCore.SOCIAL_CATALOG` keys so the two catalogs can't drift (admin catalog may import `window.RenderCore.SOCIAL_CATALOG` for the shared four and only add `google`/`yelp` locally).

### 2.2 Decompose / recompose helpers

```js
// sameAs[] → { google: url, …, other: [urls] } — first match wins per
// platform; every unmatched URL is preserved in `other` (never dropped).
function decomposeProfiles(sameAs) {
  var out = { other: [] }, used = {};
  (sameAs || []).forEach(function (u, i) {
    var host = profileHostOf(u);
    var hit = PROFILE_FIELDS.find(function (p) { return !out[p.key] && p.host.test(host); });
    if (hit) { out[hit.key] = u; used[i] = true; }
  });
  (sameAs || []).forEach(function (u, i) { if (!used[i] && String(u).trim()) out.other.push(u); });
  return out;
}

// fields → flat array in stable catalog order, others last, empties removed.
function composeProfiles(vals) {
  var arr = PROFILE_FIELDS.map(function (p) { return (vals[p.key] || "").trim(); }).filter(Boolean);
  return arr.concat((vals.other || []).map(function (s) { return s.trim(); }).filter(Boolean));
}
```

Duplicate URLs of the same platform (e.g. two Instagram links — profile + post, as in the current seed) land as: first → Instagram field, second → Other. Nothing is silently lost.

### 2.3 Replace the textarea block (`admin/admin.js:579–591`)

Delete the `profWrap` textarea construction and its listener; replace with:

```js
addDivider(body, "Profiles & social links");
var profVals = decomposeProfiles(seoCur.sameAs && seoCur.sameAs.length ? seoCur.sameAs : (liveSeo.sameAs || []));

function commitProfiles() {
  var arr = composeProfiles(profVals);
  setDraftSeo("sameAs", arr);
  if (window.SEO_CONFIG) window.SEO_CONFIG.sameAs = arr;
  if (window.renderSocial) window.renderSocial(); // live footer-icon preview
}

PROFILE_FIELDS.forEach(function (p) {
  addTextField(body, p.label, profVals[p.key] || "", function (v) {
    profVals[p.key] = v;
    markProfileValidity(p, v); // §2.4
    commitProfiles();
  });
  // set placeholder on the input just created:
  body.lastElementChild.querySelector("input").placeholder = p.placeholder;
});

// Catch-all keeps arbitrary extra profiles (blogs, Maps short links, etc.)
var otherWrap = document.createElement("div");
otherWrap.className = "admin-field";
otherWrap.innerHTML = '<label>Other profile URLs — one per line</label>' +
  '<textarea id="seoSameAsOther" rows="2">' + escHtml((profVals.other || []).join("\n")) + '</textarea>';
body.appendChild(otherWrap);
document.getElementById("seoSameAsOther").addEventListener("input", function () {
  profVals.other = this.value.split("\n");
  commitProfiles();
});
```

(If `addTextField` doesn't expose the created element cleanly, extend it with an optional `placeholder` 5th arg instead of the `lastElementChild` reach-in — one-line change, backward-compatible since all existing call sites omit it.)

### 2.4 Soft validation (no hard blocks)

```js
function markProfileValidity(p, v) {
  var input = /* the field's input element */;
  var bad = v.trim() && !(/^https?:\/\//i.test(v.trim()) && p.host.test(profileHostOf(v.trim())));
  input.classList.toggle("admin-input--warn", !!bad);
  input.title = bad ? "This doesn't look like a " + p.label + " URL (expected " + p.placeholder + ")" : "";
}
```

Plus one CSS rule in the admin stylesheet block: `.admin-input--warn { border-color: #f59e0b; background: #fffbeb; }`. Warn-only, never block — a wrong-but-intentional URL still saves (matching the current textarea's permissiveness); it will simply sort into the field's own key on next open only if it matches, otherwise reopen shows it under Other.

### 2.5 Update the helper note (`admin/admin.js:598–600`)

Change `seoNote.textContent` to: `"Each link powers your Google/AI listing (sameAs) and the footer social icons. Leave a field empty to hide that platform."`

---

## 3. Compatibility notes

- **Storage unchanged:** `draft.seo.sameAs` stays a flat array → `functions/save-content.js` / `publish.js`, the edge overlay, JSON-LD, `llms.txt`, and `verify-crawlable.js` need **zero changes**.
- **Old content:** any previously published `sameAs` (any order, any platforms) decomposes losslessly; unknown platforms surface in Other.
- **Footer icons plan:** `commitProfiles()` calls `window.renderSocial()`, giving field-by-field live preview. Implement in either order; each guards for the other's absence.
- **Reopen behaviour:** `openSettingsEditor()` rebuilds from `draft.seo` (line 553), so decompose runs on every open — field assignment is deterministic (catalog order, first match wins).

## 4. Acceptance checklist

1. Open Settings with current seed data: Tripadvisor, Facebook, Instagram fields pre-filled; the Instagram *post* URL appears under Other; Google/Yelp/TikTok empty.
2. Type a TikTok URL → draft `sameAs` gains it (inspect via Publish preview or `window.SEO_CONFIG.sameAs`), footer icon appears live (if icons feature shipped).
3. Paste a Facebook URL into the Yelp field → amber warn border, still saved.
4. Clear Facebook field → URL removed from `sameAs`; footer FB icon disappears; JSON-LD `sameAs` on next publish omits it.
5. Publish → `/.netlify/functions/get-content` `seo.sameAs` is a flat, correctly ordered array; live `llms.txt` Profiles section matches.
6. Close/reopen editor twice → values stable (no reshuffling or loss).

**Effort:** ~1.5–2 h. Single-file change (`admin/admin.js`) plus one admin CSS rule.
