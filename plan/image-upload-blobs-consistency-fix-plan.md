# Image Upload Failure ("uncachedEdgeURL") — Root Cause & Implementation Plan

**Date:** 2026-07-03 · verified in working tree
**Symptom:** every admin image upload (share image, gallery, menu photos, hero) shows
`Error: Storage error: Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`

---

## 1. Root cause (verified)

1. The visible message is produced by `admin/admin.js:1946–1950` (`prog.textContent = "Error: " + res.body.error`), i.e. the **`upload-image` function itself returns the 500** — this is not a client or network problem.
2. `functions/upload-image.js:75` and `functions/get-media.js:29` are the **only two places** in the codebase that request strong consistency:
   ```js
   const store = getStore({ name: "media", consistency: "strong" }, event);
   ```
3. All functions in this project are **classic CJS Lambda-style handlers** (`exports.handler`). For those, the Blobs context that Netlify injects (decoded by `connectLambda(event)` in `functions/_lib/blobs.js:27–30`) contains the edge URL + token but **not the `uncachedEdgeURL`** that strong-consistency operations must use (they deliberately bypass the edge cache). `@netlify/blobs` (v8.2.0 installed, per `package-lock.json`) therefore throws exactly this error on any strong-mode operation. Modern ESM "v2" functions receive the full context automatically — these functions predate that style.
4. Why "read" on an upload: in strong mode the v8 client performs internal read/validation steps around `set()`; the first such operation throws. `get-media` (strong `get()`) fails the same way — hence "everywhere images can be uploaded" and also anywhere an uploaded image is *served*.

**Why strong consistency was chosen at all:** so a freshly uploaded image is immediately readable when the admin preview refetches it. That is the only requirement strong mode was serving.

## 2. Solution decision

**Fix: drop strong consistency (use the default, eventual) and handle the one read-after-write moment in the admin UI.** Keys are immutable UUIDs (`upload-image.js:71–73`) — an image is never overwritten, so eventual consistency is semantically safe everywhere; the only exposure is a few seconds where a *brand-new* key may 404. We close that gap client-side with an instant local preview + automatic retry.

Alternatives considered and rejected for now:
- **Migrate the two functions to ESM v2** (gets `uncachedEdgeURL`, keeps strong mode): larger refactor — different handler signature (Request/Response), `_lib/session.js` cookie helpers expect the Lambda `event` shape. Documented as the long-term modernization path (Appendix A).
- **API-access mode** (`getStore({ name, siteID, token })` against `api.netlify.com`, strongly consistent): requires creating and managing a personal access token as a secret env var — new operational burden for a template meant to deploy with zero secrets.

## 3. Implementation

### 3.1 `functions/upload-image.js` — line 75

```js
// BEFORE
const store = getStore({ name: "media", consistency: "strong" }, event);
// AFTER — eventual (default) consistency; keys are immutable UUIDs so
// read-after-write is handled client-side (admin preview retry).
const store = getStore("media", event);
```

### 3.2 `functions/get-media.js` — line 29 + 404 hardening

```js
// BEFORE
const store = getStore({ name: "media", consistency: "strong" }, event);
// AFTER
const store = getStore("media", event);
```

And the not-found branch (line ~33) must never be cached by the CDN (a freshly-uploaded key can 404 for a few seconds — caching that 404 for a year would "lose" the image):

```js
    if (!blob) {
      return {
        statusCode: 404,
        headers: { "Cache-Control": "no-store" },   // NEW — never cache a miss
        body: "Not found.",
      };
    }
```

(The 200 branch keeps `public, max-age=31536000, immutable` — correct for UUID-keyed files. Add the same `no-store` header to the `catch` 500 branch.)

### 3.3 `admin/admin.js` — instant preview + automatic retry

**(a) Give `onSuccess` the local data URL** so editors can show the image instantly without any network read. In `uploadImage` (line 1931ff):

```js
    var dataUrl = null;                                            // NEW
    compressImage(file)
      .then(function (result) {
        dataUrl = "data:" + result.type + ";base64," + result.base64;   // NEW
        …fetch unchanged…
      })
      …
        if (res.ok && res.body.url) {
          if (prog) prog.textContent = "Uploaded ✓";
          onSuccess(res.body.url, dataUrl);                        // CHANGED (2nd arg)
        }
```

All existing call sites pass a callback `(url)` and ignore the extra argument — **fully backward-compatible**. Callers that re-render a preview immediately (e.g. the Settings share-image editor, `admin.js:~640`, which calls `openSettingsEditor()` right after upload) can optionally stash `dataUrl` in a module-level map keyed by `url` and use it as the preview `src` — but the generic retry in (b) already covers them.

**(b) Delegated image-retry** — one listener, covers every admin preview (`error` events don't bubble, so use capture). Add near the bottom of the admin IIFE:

```js
  /* Retry get-media images that 404 in the eventual-consistency window
   * right after upload: up to 5 attempts with exponential backoff. */
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;
    if ((img.getAttribute("src") || "").indexOf("/get-media") === -1) return;
    var n = parseInt(img.dataset.mediaRetry || "0", 10);
    if (n >= 5) return;
    img.dataset.mediaRetry = String(n + 1);
    setTimeout(function () {
      var base = img.src.replace(/[?&]r=\d+/, "");
      img.src = base + (base.indexOf("?") > -1 ? "&" : "?") + "r=" + Date.now();
    }, 400 * Math.pow(2, n));                    // 0.4s → 6.4s total
  }, true);
```

(The `r=` param busts the CDN entry for retries only; the eventual 200 is then cached normally under that URL — a rare, harmless duplicate cache entry.)

**(c) Public site:** no change needed — published content references `get-media` URLs minutes-to-days after upload, far outside the consistency window.

### 3.4 Sanity check for other stores

`grep -rn "consistency" functions/` → only the two lines above. The `content` and (planned) `orders` stores already use default consistency — unaffected, and this is why publish/save has been working while uploads fail.

## 4. Test plan / acceptance

1. **Deploy preview:** Admin → Settings → Share image → upload a JPEG >1600px: progress shows "Compressing… → Uploading… → Uploaded ✓", **no Storage error**, preview renders (instantly or within the retry window).
2. Repeat for every upload surface the user reported: gallery editor, menu-item photo, hero/theme image — all succeed.
3. Immediately after upload, devtools network tab: any first-hit `get-media` 404 has `Cache-Control: no-store` and the retried request returns 200 with the immutable header.
4. Publish → open the public site (normal + JS-disabled): the new image serves via `get-media` with 200 + long cache.
5. Local dev (`netlify dev`): unchanged behaviour (the local wrapper in `_lib/blobs.js` ignores the consistency option entirely — writes land in `.netlify/blobs-local/media/`).
6. Regression: `save-content`/`publish`/`get-content` still work (they never used strong mode).

## 5. File-by-file summary

| File | Change |
|------|--------|
| `functions/upload-image.js` | line 75: drop `consistency: "strong"` |
| `functions/get-media.js` | line 29: same; `no-store` on 404/500 branches |
| `admin/admin.js` | `uploadImage` passes `dataUrl` as 2nd arg; delegated capture-phase retry listener |

**Effort:** ~45 min + deploy-preview testing. No new dependencies, no secrets, no runtime migration.

## Appendix A — long-term option (not now)

Migrating `upload-image`/`get-media` to Netlify Functions v2 (ESM `export default async (req, context)`) restores the full Blobs environment including `uncachedEdgeURL`, allowing strong consistency without workarounds, and enables streaming responses for `get-media` (no base64 inflation). Requires adapting `_lib/session.js` cookie handling to the `Request` API. Worth bundling into any future functions-runtime modernization; not justified for this bug alone.
