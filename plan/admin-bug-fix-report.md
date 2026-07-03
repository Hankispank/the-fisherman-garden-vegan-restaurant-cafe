# Admin & Publish Bug Fix Report

**Site:** The Fisherman Garden Vegan Restaurant & Cafe  
**Repository:** `the-fisherman-garden-vegan-restaurant-cafe`  
**Production URL:** https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app  
**Admin URL:** https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app/admin  
**Report date:** 2026-07-02  

This document summarizes the bugs encountered while standing up and using the admin panel on this derived restaurant site, the root causes found, the code changes made, and how to verify fixes.

---

## Context: What Was Set Up First

Before the admin bugs appeared, the site was initialized from the shared restaurant template and connected to hosting:

| Item | Detail |
|------|--------|
| GitHub repo | `Hankispank/the-fisherman-garden-vegan-restaurant-cafe` |
| Netlify site ID | `f3c76d32-1ab5-4a96-8b34-fede3da3c9c9` |
| CI deploy | `.github/workflows/netlify-deploy.yml` (push to `main`) |
| Netlify env vars | `ADMIN_PASSWORD`, `SESSION_SECRET` (from local `.env`, not committed) |
| GitHub secret | `NETLIFY_AUTH_TOKEN` for CI deploys |
| Local dev | `netlify dev` on port **8888** (required for admin, edge SSR, and blobs) |

**How admin publish is supposed to work:**

1. Admin edits → `POST /.netlify/functions/save-content` → Netlify Blobs key `content/draft`
2. Admin clicks Publish → `POST /.netlify/functions/publish` → promotes draft to `content/published`
3. Public site loads published content via:
   - **Edge SSR** (`netlify/edge-functions/render.js`) — bakes menu, amenities, JSON-LD into HTML
   - **Client JS** (`js/content-loader.js`) — fetches `get-content`, merges into `window.*` before `app.js` renders

---

## Bug 1: Admin Images Not Showing

### Symptom

Menu photos, gallery images, and previews in the admin UI showed broken images or loaded the admin HTML page instead of the image file.

### Root cause

Admin is served from `/admin/*`. Asset paths in content like `assets/menu/foo.webp` are **relative**, so the browser resolved them as `/admin/assets/...` instead of `/assets/...`. That path returns admin HTML, not the image.

### Fix

**File:** `admin/admin.js`

Added root-relative URL helpers and applied them after every re-render:

```javascript
function rootAssetUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (/^(https?:|\/|data:|#|blob:)/.test(url)) return url;
  return "/" + url.replace(/^\.\//, "");
}

function fixRenderedAssetUrls() {
  document.querySelectorAll("img[src]").forEach(function (img) {
    // prefix relative src and srcset entries with /
  });
}
```

`fixRenderedAssetUrls()` is called from `reRenderSite()` and image preview/upload flows.

### Git commit

`6e768f9` — *Fix admin storage, images, and partial draft publish.*

---

## Bug 2: Save / Publish Storage Error in Production

### Symptom

Saving or publishing in admin returned:

```text
Storage error: ENOENT: mkdir '/var/task/.netlify/blobs-local/content'
```

### Root cause

`functions/_lib/blobs.js` misdetected the production Lambda environment as “local dev” and tried to write to a filesystem blob store under `/var/task/.netlify/blobs-local/`, which does not exist in Lambda.

### Fix

**File:** `functions/_lib/blobs.js`

1. Detect Lambda via `process.env.AWS_LAMBDA_FUNCTION_NAME` and always use `@netlify/blobs` in production.
2. Call `blobs.connectLambda(event)` before `getStore()` so Blobs works in Functions.
3. Pass the Lambda `event` into `getStore()` from every function that reads/writes blobs.

```javascript
function useNetlifyBlobs() {
  if (process.env.NETLIFY_DEV === "true") return false;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  return !!process.env.NETLIFY_BLOBS_CONTEXT
    && process.env.NETLIFY_BLOBS_CONTEXT !== "undefined";
}

function netlifyStore(nameOrOpts, event) {
  const blobs = require("@netlify/blobs");
  if (event && blobs.connectLambda) blobs.connectLambda(event);
  return blobs.getStore(nameOrOpts);
}
```

**Files updated to pass `event`:**

- `functions/get-content.js`
- `functions/save-content.js`
- `functions/publish.js`
- `functions/get-media.js`
- `functions/upload-image.js`

### Git commit

`6e768f9`

---

## Bug 3: False SEO Warning on Publish

### Symptom

After clicking Publish, admin showed a persistent warning:

```text
Menu item count mismatch: live JSON-LD has 149, expected 0
```

Publish still succeeded, but the warning looked like a failure.

### Root cause

Early test saves wrote **partial drafts** to blob storage (e.g. amenities-only) with no `menuItems` array. On publish:

- `expectedItemCount` was computed as `(toPublish.menuItems && toPublish.menuItems.length) || null` → effectively **0** when missing
- The live page JSON-LD (from seed/prebake) correctly had **149** menu items
- The SEO check compared 149 vs 0 and flagged a mismatch

### Fixes (multi-part)

#### 3a. Shared merge helper — never drop arrays on partial save/publish

**New file:** `functions/_lib/content-merge.js`

```javascript
function mergePartialContent(existing, incoming) {
  // Arrays (menuItems, gallery, …) replaced only when incoming has length > 0
  // Objects (config, seo, translations, …) shallow-merged
}
```

Used by both `save-content.js` (merge incoming draft onto existing draft) and `publish.js` (merge draft onto published snapshot).

#### 3b. Complete drafts before save in admin

**File:** `admin/admin.js`

```javascript
function ensureDraftComplete() {
  if (!draft.menuItems || !draft.menuItems.length)
    draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS || []));
  // same for menuCategories, gallery, reviews, config, translations, seo
}
```

Called from `saveDraft()` so auto-save and manual save always persist a full content object when possible.

#### 3c. Skip SEO warning when expected count is zero

**File:** `functions/publish.js`

```javascript
if (expectedItemCount > 0 && count !== expectedItemCount) {
  warnings.push(`Menu item count mismatch: ...`);
}
```

#### 3d. Attempted (reverted) server-side backfill from local files

Commit `c2ae69d` tried to read `js/data.js` from the Lambda filesystem on publish. That failed in production:

```text
ENOENT /var/task/js/data.js
```

The Lambda bundle does not include repo seed files. This approach was superseded by the HTTP-based backfill in Bug 4 (see below).

### Git commits

- `c2ae69d` — *Backfill missing menu data from seed on publish* (fs approach; superseded)
- `4c8c4e5` — *Merge partial admin saves and suppress false SEO menu warnings*

---

## Bug 4: Publish Does Not Update the Public Website

### Symptom

Edits in admin (amenities, menu text, etc.) appeared in the admin preview after save, but the public homepage at `/` did not reflect changes after Publish.

### Root causes (four interacting issues)

| # | Issue | Effect |
|---|--------|--------|
| 1 | **Partial published blob** | `GET /get-content` returned only `config` + `seo` — no `menuItems`, `translations`, or `gallery`. Most admin edits never reached the public merge layer. |
| 2 | **Publish without save** | `doPublish()` called publish directly when `isDirty === false`, even if the blob draft was still partial. `ensureDraftComplete()` ran in memory on load but was not persisted unless the user edited something. |
| 3 | **Missing amenities re-render on public site** | `app.js` does not render the amenities section. Edge SSR bakes amenities into HTML, but the browser never refreshed `#amenitiesBody` after `content-loader.js` merged published SEO. Admin called `window.renderAmenities()` but that function was **never defined**. |
| 4 | **CDN / edge caching** | Edge HTML used `s-maxage=600` (10 min). `get-content` used `s-maxage=60`. Users could see stale content even after a successful publish. |

### Fixes

#### 4a. New HTTP seed backfill module (production-safe)

**New file:** `functions/_lib/seed-fetch.js`

Fetches deployed seed files over HTTP (same approach as the edge function), evaluates them in a VM sandbox, and backfills missing arrays:

```javascript
async function fetchSeedArrays(origin) {
  const win = evalWindowScript(await fetchJsModule(origin, "data.js"));
  return { menuCategories, menuItems, gallery, reviews };
}

function backfillMissingArrays(target, seed) {
  // Fill keys only when target array is missing or empty
}
```

Works in Lambda because it reads from the live site origin, not `/var/task/js/`.

#### 4b. Publish repairs partial drafts before promoting

**File:** `functions/publish.js`

Before merging draft → published:

1. Clone draft → `draftToPublish`
2. HTTP backfill missing `menuItems`, `gallery`, `reviews`, `menuCategories`
3. Backfill `translations` from `/js/i18n.js` if missing
4. Write repaired draft back to blob storage
5. Merge onto existing published snapshot
6. Backfill published result again from seed (belt-and-braces)

#### 4c. Admin always saves a complete draft before publish

**File:** `admin/admin.js`

```javascript
function doPublish() {
  ensureDraftComplete();
  saveDraft().then(function (ok) {
    if (!ok) return;
    fetch(FN + "/publish", { method: "POST", credentials: "include" }) …
  });
}
```

Previously publish ran immediately when nothing was dirty, skipping persistence of in-memory completed draft.

#### 4d. Auto-repair incomplete blob draft on admin load

**File:** `admin/admin.js`

```javascript
var incomplete = !content.menuItems || !content.menuItems.length;
ensureDraftComplete();
if (incomplete) scheduleSave();
```

When admin opens with a partial draft in blobs, it backfills from live globals and schedules a save to repair storage.

#### 4e. Define `window.renderAmenities` in admin

**File:** `admin/admin.js`

```javascript
function renderAmenitiesAdmin() {
  var html = window.RenderCore.amenitySectionHTML(
    window.SEO_CONFIG.amenities || [], LANG(), window.SEO_CONFIG.customAmenities
  );
  document.getElementById("amenitiesBody").innerHTML = html;
}
window.renderAmenities = renderAmenitiesAdmin;
```

Called from `reRenderSite()` and `persistAmenities()`.

#### 4f. Public site amenities re-render after content load

**File:** `js/content-loader.js`

Added `renderAmenitiesSection()` using `RenderCore.amenitySectionHTML`, called at end of `applyContent()` so JS-enabled visitors see published amenities even when edge HTML is briefly cached.

#### 4g. Guard empty arrays in merge paths

Partial blobs must not wipe seed data with empty arrays.

**Files:**

- `js/content-loader.js` — only assign `menuItems`, `gallery`, etc. when `array.length > 0`
- `netlify/edge-functions/render.js` — same length guards in `loadContent()`

#### 4h. Shorter cache headers

| File | Before | After |
|------|--------|-------|
| `functions/get-content.js` | `s-maxage=60, stale-while-revalidate=300` | `max-age=0, s-maxage=30, must-revalidate` |
| `netlify/edge-functions/render.js` (HTML) | `s-maxage=600, stale-while-revalidate=86400` | `s-maxage=60, stale-while-revalidate=300` |

Note: `content-loader.js` already uses `fetch(..., { cache: "no-store" })`.

### Deployment status

These Bug 4 changes were deployed to production via:

```bash
netlify deploy --prod --dir "." --no-build
```

Deploy ID: `6a469484f636822c8d807531` (2026-07-02).

**Post-fix verification (automated):**

- After publish: `GET /.netlify/functions/get-content` returned **149 menuItems**, **11 amenities**, full content object
- Live homepage HTML included updated amenities (e.g. kids playground, high chairs)
- Publish SEO warnings: **none**

### Git status

Bug 4 fixes are in the working tree at report time (not yet committed to `main`):

| File | Change |
|------|--------|
| `functions/_lib/seed-fetch.js` | **New** — HTTP seed backfill |
| `functions/publish.js` | Seed backfill on publish |
| `functions/get-content.js` | Shorter cache |
| `admin/admin.js` | `renderAmenities`, always save before publish, auto-repair draft |
| `js/content-loader.js` | Amenities re-render, array guards |
| `netlify/edge-functions/render.js` | Array guards, shorter HTML cache |

---

## Related Fix: Build / Deploy With Empty Web3Forms Key

### Symptom

CI or local deploy failed when `web3formsKey` was still empty in `js/config.js`.

### Fix

**Commit:** `3a91e82` — *Allow incomplete template scrub until Web3Forms key is configured.*

Build command uses `--allow-incomplete` so the site can deploy before the order form email key is set (ordering still works via WhatsApp/Zalo).

---

## Complete File Change Index

### Committed to `main`

| Commit | Files | Summary |
|--------|-------|---------|
| `6e768f9` | `admin/admin.js`, `functions/_lib/blobs.js`, `functions/get-content.js`, `functions/get-media.js`, `functions/publish.js`, `functions/save-content.js`, `functions/upload-image.js` | Blobs production fix, admin image URLs, partial publish merge, `ensureDraftComplete` |
| `4c8c4e5` | `functions/_lib/content-merge.js`, `functions/publish.js`, `functions/save-content.js` | Shared merge helper, SEO warning guard |
| `c2ae69d` | `functions/publish.js` | Fs seed backfill attempt (superseded by `seed-fetch.js`) |
| `3a91e82` | `netlify.toml` (and related) | Allow incomplete scrub for deploy |

### Deployed but uncommitted (Bug 4)

| File | Role |
|------|------|
| `functions/_lib/seed-fetch.js` | HTTP seed loader for Lambda |
| `functions/publish.js` | Backfill + promote |
| `functions/get-content.js` | Cache headers |
| `admin/admin.js` | Publish flow, amenities render, draft repair |
| `js/content-loader.js` | Public amenities + array guards |
| `netlify/edge-functions/render.js` | Edge array guards + cache |

---

## Architecture Notes (For Future Debugging)

### What admin shows vs what the public site shows

| Layer | Admin (`/admin`) | Public (`/`) |
|-------|------------------|--------------|
| Seed data | `js/config.js`, `data.js`, `i18n.js`, `seo.js` | Same |
| Draft overlay | `get-content?draft=1` | — |
| Published overlay | — | `get-content` via `content-loader.js` + edge SSR |
| Menu render | `app.js` + `languagechange` | `app.js` (client) + edge bake (no-JS/crawlers) |
| Amenities render | `renderAmenitiesAdmin()` | Edge bake + **`renderAmenitiesSection()` in content-loader** |
| Gallery render | `renderGalleryAdmin()` | `app.js` + edge bake |

### Locked files (not modified)

Per `AGENTS.md`, these were **not** changed:

- `js/app.js`
- `js/render-core.js`
- `index.html` structure
- SEO engine in `js/seo.js`

All fixes stayed in admin, functions, content-loader, and edge render overlay logic.

---

## Operator Checklist After Fixes

1. Hard-refresh admin (`Ctrl+Shift+R`) to load latest `admin.js`.
2. Edit content → wait for **“Draft saved ✓”** (auto-save ~1.2s after last change).
3. Click **Publish** → wait for **“Published vN ✓”** (no SEO warning unless real mismatch).
4. Open public site in a new tab or hard-refresh (`Ctrl+Shift+R`).
5. Allow up to **~1 minute** for CDN edge cache to refresh (reduced from 10 minutes).

### Verify published blob (no auth required)

```bash
curl -s https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app/.netlify/functions/get-content | jq '.menuItems | length, .seo.amenities'
```

Expected after a full publish: menu item count ≈ 149, amenities array non-empty.

### Local full-stack preview

```bash
netlify dev
# Admin: http://localhost:8888/admin
# Public: http://localhost:8888/
```

Plain `python -m http.server` does **not** run functions, blobs, or edge SSR.

---

## Known Remaining Items

| Item | Status |
|------|--------|
| `web3formsKey` empty in `js/config.js` | Order/reservation forms use WhatsApp/Zalo; email POST disabled until key set |
| Bug 4 code uncommitted on `main` | Deployed to Netlify prod via CLI; should be committed and pushed for CI parity |
| GitHub Actions deploy | Requires `NETLIFY_AUTH_TOKEN` secret; may fail if Netlify account credits exhausted (use CLI deploy as fallback) |

---

## Summary

Five distinct issues were addressed across the admin publish pipeline:

1. **Broken image paths** in admin — fixed with root-relative asset URLs.
2. **Blob storage failures** in Lambda — fixed with `connectLambda` and correct environment detection.
3. **False SEO warnings** — fixed with partial merge logic and conditional menu count check.
4. **Public site not updating after publish** — fixed with complete-draft saves, HTTP seed backfill on publish, amenities re-render on the public site, and shorter CDN caches.
5. **Deploy blocked by empty Web3Forms key** — fixed with `--allow-incomplete` build flag.

Together, these changes make the admin → blob storage → publish → public site pipeline reliable for this derived restaurant site.
