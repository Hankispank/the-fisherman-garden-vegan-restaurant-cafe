# Order Submission Error ("We couldn't reach our server") — Root Cause & Implementation Plan

**Date:** 2026-07-03 · verified in code (working tree, post-`1d75687`)
**Symptom:** every order (and reservation) shows *"We couldn't reach our server. Please send your order manually below."* with a WhatsApp/Zalo fallback button.

---

## 1. Root cause analysis (verified, not a network problem)

The message is misleading — the server **is** reached; the request is **rejected**:

1. "Order now" → `setupChannelPicker`'s click handler (`js/app.js:522–566`) builds the Web3Forms payload with `access_key: cfg.web3formsKey` (`app.js:416`, reservations `:454`).
2. **`js/config.js:24` has `web3formsKey: ""`** — the key was never configured. Deliberately so: commit `3a91e82` ("Allow incomplete template scrub until Web3Forms key is configured") added `--allow-incomplete` to the build command (`netlify.toml:6`), and `scripts/verify-no-template-data.js:57` explicitly recognizes `web3formsKey: ""` as an incomplete-template marker. This is a known unfinished setup step, silenced at deploy time.
3. `submitToEndpoint` (`app.js:300–321`) POSTs to `https://api.web3forms.com/submit`; Web3Forms answers with `success: false` (invalid/empty access key) → the promise resolves `false` → `showConfirmState(…, "err")` → i18n `confirm.error` = the screenshot text, plus the fallback button.
4. In parallel the deep link **did already open** (`openDeepLink` is called unconditionally at `app.js:549`) — hence the odd combination in the screenshot: an error banner *and* "Didn't open? Tap to send directly".

Consequences beyond the scary message: `onSuccess` never runs, so the **cart is never cleared** even when the customer completed the order via WhatsApp/Zalo, and the restaurant gets **no email notification** for any order — the chat message is currently the only record.

Secondary defect: there is **no admin field** for the key (only a passing mention in the Settings note, `admin/admin.js:610`), so a non-technical owner cannot fix this without editing code.

## 2. Fix strategy — two layers

- **A. Operational root fix:** configure a real Web3Forms access key, editable from admin.
- **B. Code hardening:** make the no-key state behave gracefully (chat-first flow, honest copy) and distinguish "rejected" from "offline" — so the template never shows a false server error again.

---

## 3. Implementation

### 3.1 (A) Web3Forms key — provisioning + admin field

1. **Owner action:** create a free access key at web3forms.com using `thefisherman.veganrestaurant@gmail.com` (the address that should receive order/booking emails). The key is designed to be public (client-side) — no secret handling needed.
2. **Admin UI** (`admin/admin.js`, `openSettingsEditor()`, in the "Contact — site-wide" area near line 605):

```js
addTextField(body, "Web3Forms access key (order/booking email notifications)",
  cfg.web3formsKey || window.SITE_CONFIG.web3formsKey || "", function (v) {
    setDraftConfig("web3formsKey", v.trim());
    window.SITE_CONFIG.web3formsKey = v.trim();
  }, "e.g. 1a2b3c4d-…");
```

   Data path is already wired end-to-end: `setDraftConfig` → published `config` → browser merge `content-loader.js:46` (`deepMerge(window.SITE_CONFIG, c.config)`) → `app.js` reads `cfg.web3formsKey` at click time. No further plumbing.
3. **Seed hygiene:** also set the key in `js/config.js:24` (the seed governs first paint before the content fetch and any reset-to-seed path).
4. **Re-arm the deploy gate:** once the key is set, remove `--allow-incomplete` from `netlify.toml:6` so `verify-no-template-data.js` again hard-fails future template copies shipped without a key.

### 3.2 (B1) Graceful no-key mode (`js/app.js`)

In `submitToEndpoint` (line 300), short-circuit before fetching:

```js
async function submitToEndpoint(payload) {
  if (!payload.access_key) return "nokey";   // endpoint not configured — don't fake an error
  …existing fetch/sendBeacon logic…
}
```

In the click handler's `.then()` (`app.js:551–559`), handle the third state:

```js
.then((ok) => {
  if (ok === "nokey") {
    showConfirmState(confirmEls, "chat", orderId, successKey, text, channel, subject);
    // do NOT clear the cart — the customer may still need to press send in the chat app
  } else if (ok) { …existing "ok"… } else { …existing "err"… }
})
```

And in `showConfirmState` (`app.js:359ff`) add the `"chat"` state: status text = new i18n key `confirm.sentViaChat`, fallback panel **visible** (reuse `renderFallbackButtons` — same "Didn't open?" affordance, but under an accurate headline).

### 3.3 (B2) Honest copy for real failures (`js/i18n.js`)

- New key `confirm.sentViaChat` — EN: `"Your order was prepared in {app}. Press Send there to complete it — we'll confirm shortly."` VI: `"Đơn của bạn đã được mở trong {app}. Bấm Gửi để hoàn tất — chúng tôi sẽ xác nhận sớm."` (`showConfirmState` already has `channel` in scope for `{app}` substitution: WhatsApp/Zalo/Email.)
- Reword `confirm.error` (line 165/322) to cover genuine failures without blaming the network wrongly — EN: `"We couldn't record your order automatically. Please send it via the button below — it reaches us directly."` (VI equivalent, line 322.)
- Note: i18n **values** are admin-editable; keys are template-locked — adding a key means also adding it to the VI block and it flows through `applyI18n`/admin i18n editors automatically.

### 3.4 (B3) Distinguish "rejected" from "offline" (optional, small)

`submitToEndpoint` currently collapses HTTP-rejected (`success:false`) and network-down into `false`. Return `"rejected"` when a response arrived but `json.success !== true` while a key **is** configured — and log `json.message` to console for diagnosability (`console.warn("web3forms:", json.message)`). Both still render the `"err"` state; the console line turns a future "invalid key / domain blocked / quota" incident from guesswork into a 10-second diagnosis.

### 3.5 Verification gate

Extend `scripts/verify-no-template-data.js` semantics (already detects the empty key): after the owner sets the key, the removal of `--allow-incomplete` (§3.1.4) makes the build fail if the key ever regresses to empty/sentinel. No new script needed.

## 4. Acceptance checklist

1. **Before key (no-key mode):** place a test order → chat app opens, panel shows *"Your order was prepared in WhatsApp…"* (no server-error wording), fallback button present, cart preserved, no POST fired (network tab).
2. **Configure key in admin → Publish:** place a test order → Web3Forms email arrives at the restaurant inbox with order ID, items, total, contact; panel shows *"Order received! Reference …"*; cart clears.
3. **Reservation flow:** same two states verified (shares the machinery, `app.js:596`).
4. **Genuine offline test** (devtools offline): honest `confirm.error` copy + fallback button; deep link still opens on regained focus.
5. **VI:** all three states render Vietnamese strings.
6. Deploy with key + re-armed gate: `node scripts/verify-no-template-data.js` (no `--allow-incomplete`) passes; then intentionally blank the key locally → build fails (gate proven).

## 5. File-by-file summary

| File | Change |
|------|--------|
| `js/config.js:24` | real Web3Forms key (seed) |
| `admin/admin.js` (~605) | "Web3Forms access key" field via `addTextField` + note update |
| `js/app.js` | `submitToEndpoint` no-key short-circuit + `"rejected"` reason; `"chat"` confirm state; cart-clear only on true success |
| `js/i18n.js` | new `confirm.sentViaChat` (EN+VI); reworded `confirm.error` (EN+VI) |
| `netlify.toml:6` | remove `--allow-incomplete` **after** key is live |

**Effort:** ~2 h code + owner's 5-minute Web3Forms signup. Risk: low — all changes are additive states; the configured-key happy path is untouched.
