# One-Click Email Confirm/Decline — Implementation Plan

**Date:** 2026-07-07
**Goal:** Let the owner **confirm or decline a booking straight from the notification email** — one click, no logging into `/admin`. Clicking triggers the same server action the admin panel does today (set status → email the guest), like the verification link in a sign-up email.

**Answer to "is this possible?":** Yes. Use **signed magic links** in the owner email. Your `functions/_lib/session.js` already exposes an HMAC-SHA256 `sign()/verify()` (keyed by `SESSION_SECRET`, with `exp` + constant-time compare). We reuse it to mint an unforgeable, expiring token per booking — possession of the emailed link is the authorization, so the owner needs no session/cookie. The admin panel keeps working as an alternate path.

---

## 1. Flow

```
booking (pending) ──► owner email ──► [ Confirm ]  [ Decline ]     ← magic links (signed token)
                                          │             │
                              GET /booking-action?token=…  (READ ONLY: shows booking + two buttons)
                                          │
                              owner clicks a button → POST {token, action}
                                          │
                          verify token → set status (confirmed|declined)
                          confirmed → email guest "table confirmed"; keep slot
                          declined  → email guest "couldn't accommodate"; release slot
                                          │
                              → simple HTML result page ("Confirmed ✓")
```

**Why GET is read-only and mutation is POST:** Gmail/Outlook and security scanners *prefetch* links in emails. If the GET link mutated state, a booking could be auto-confirmed the instant the email is scanned. So the GET link only **renders** a landing page with the booking details and two buttons; the actual status change happens on the **POST** a human triggers by clicking a button. This is the same reason password-reset flows land you on a page rather than acting on link-open.

---

## 2. Security model

- **Auth = a signed, expiring token in the URL.** `session.sign({ id, kind:"booking-action", exp })` → base64url JWT. `session.verify()` rejects tampering and expiry. No admin cookie required.
- **Token carries only the booking id** (not the action) → one link works for both Confirm and Decline; the owner chooses on the landing page. Nothing sensitive is exposed (the id is already a random-ish `<prefix>-<timestamp>`).
- **Expiry:** 7 days (`exp = now + 7*24*3600`). Stale links simply 401 with "link expired — use the admin panel".
- **Secrecy = the owner's inbox**, same trust boundary as the whole notification. If `SESSION_SECRET` is strong and set (it already must be for admin), links are unforgeable.
- **Idempotent + safe re-clicks:** acting on an already-handled booking just shows its current status; re-confirming is a no-op; the guest email is only sent on an actual status *change*.
- **Light rate-limit** on the endpoint (reuse the in-memory limiter pattern) to blunt brute-force of tokens (infeasible anyway against HMAC).
- **No CSRF concern:** the token *is* the capability; a POST without a valid token does nothing.

Requirement: `SESSION_SECRET` set to a strong value in Netlify env (already needed for `/admin`). If it's still the dev default, set it — the plan's `verify` inherits that guard.

---

## 3. Files to add / change

### 3.1 `functions/_lib/orders.js` *(new — shared status writer, kills drift)*
Both the admin `update-order` and the new email endpoint should mutate status through one function:
```js
"use strict";
// Single source of truth for "set a booking's status" (index + o/<id>).
async function setStatus(store, id, status) {
  let index = (await store.get("index", { type: "json" })) || [];
  const before = index.find((r) => r.id === id);
  index = index.map((r) => (r.id === id ? { ...r, status } : r));
  const order = await store.get("o/" + id, { type: "json" });
  if (order) { order.status = status; await store.setJSON("o/" + id, order); }
  await store.setJSON("index", index);
  return { order, changed: !before || before.status !== status, prevStatus: before && before.status };
}
module.exports = { setStatus };
```
Refactor `functions/update-order.js` to call `orders.setStatus(store, body.id, body.status)` instead of its inline map/write (behavior unchanged; one code path).

### 3.2 `functions/_lib/availability.js` *(edit — add slot release)*
A pending booking already reserved a slot (`reserveSlot` at submit). On **decline**, give the seats back:
```js
async function releaseSlot(store, { date, time, guests }) {
  const key = slotKey(date, time);
  const used = (await store.get(key, { type: "json" })) || { count: 0 };
  used.count = Math.max(0, used.count - Math.max(parseInt(guests || "1", 10) || 1, 1));
  await store.setJSON(key, used);
}
module.exports = { check, reserveSlot, releaseSlot, slotKey };
```

### 3.3 `functions/booking-action.js` *(new — the magic-link endpoint)*
```js
"use strict";
const session = require("./_lib/session");
const HTML = { "Content-Type": "text/html; charset=utf-8" };

const page = (title, msg, extra = "") =>
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<div style="font-family:system-ui;max-width:520px;margin:12vh auto;padding:0 20px;text-align:center">` +
  `<h1 style="font-size:1.4rem">${title}</h1><p style="color:#555">${msg}</p>${extra}</div>`;

function tokenFor(id) { // 7-day signed link token
  const now = Math.floor(Date.now() / 1000);
  return session.sign({ id, kind: "booking-action", iat: now, exp: now + 7 * 24 * 3600 });
}

exports.handler = async function (event) {
  const method = event.httpMethod;
  const q = event.queryStringParameters || {};
  const token = q.token || (event.body && new URLSearchParams(event.body).get("token"));
  const payload = session.verify(token);
  if (!payload || payload.kind !== "booking-action")
    return { statusCode: 401, headers: HTML, body: page("Link expired or invalid", "Please use the admin panel to manage this booking.") };

  const { getStore } = require("./_lib/blobs");
  const store = getStore("orders", event);
  const order = await store.get("o/" + payload.id, { type: "json" });
  if (!order) return { statusCode: 404, headers: HTML, body: page("Booking not found", "It may have been removed.") };

  const when = [order.date, order.time].filter(Boolean).join(" ");

  // GET → read-only landing with two buttons (prefetch-safe).
  if (method === "GET") {
    if (order.status === "confirmed" || order.status === "declined")
      return { statusCode: 200, headers: HTML, body: page(`Already ${order.status}`,
        `${order.customer_name || "Guest"} · ${when} · ${order.guests || "?"} guests.`) };
    const form = (act, label, color) =>
      `<form method="POST" action="/.netlify/functions/booking-action" style="display:inline-block;margin:8px">` +
      `<input type="hidden" name="token" value="${token}"><input type="hidden" name="action" value="${act}">` +
      `<button style="padding:12px 22px;border:0;border-radius:10px;color:#fff;background:${color};font-size:1rem">${label}</button></form>`;
    return { statusCode: 200, headers: HTML, body: page("Confirm this booking?",
      `${order.customer_name || "Guest"} · ${when} · ${order.guests || "?"} guests${order.notes ? " · " + order.notes : ""}`,
      form("confirm", "✓ Confirm", "#1a7f4b") + form("decline", "✕ Decline", "#a23")) };
  }

  // POST → perform the action (human clicked a button).
  if (method === "POST") {
    const action = new URLSearchParams(event.body || "").get("action");
    if (action !== "confirm" && action !== "decline")
      return { statusCode: 400, headers: HTML, body: page("Unknown action", "") };
    const status = action === "confirm" ? "confirmed" : "declined";

    const { setStatus } = require("./_lib/orders");
    const { changed } = await setStatus(store, payload.id, status);

    if (changed) {
      const notify = require("./_lib/notify");
      const av = require("./_lib/availability");
      try {
        if (status === "confirmed") await notify.sendConfirmation(order);
        else { await notify.sendDecline(order); await av.releaseSlot(store, order); }
      } catch (_) { /* best effort */ }
    }
    return { statusCode: 200, headers: HTML,
      body: page(status === "confirmed" ? "Confirmed ✓" : "Declined",
        `${order.customer_name || "Guest"} · ${when}. ` +
        (status === "confirmed" ? "The guest has been emailed a confirmation." : "The guest has been notified.")) };
  }

  return { statusCode: 405, headers: HTML, body: page("Method not allowed", "") };
};

module.exports.tokenFor = tokenFor; // used by notify.js to build the links
```

### 3.4 `functions/_lib/notify.js` *(edit — put the links in the owner email + add decline mail)*
Owner email gains a **Confirm / Decline** magic link (HTML email so the buttons are tappable). Build the URL from `booking-config.json.baseUrl` (added in §3.5) and the signed token:
```js
const cfgBase = () => { try { return require("./booking-config.json").baseUrl || process.env.URL || ""; } catch { return process.env.URL || ""; } };

async function sendBookingNotifications(rec) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.warn("notify: SMTP not set; skipping"); return; }
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  const base = cfgBase();
  const link = base ? `${base}/.netlify/functions/booking-action?token=${encodeURIComponent(require("../booking-action").tokenFor(rec.id))}` : "";

  const text = `New ${rec.type} ${rec.id}\nName: ${rec.customer_name || ""}\nContact: ${rec.customer_contact || ""}\n` +
               `When: ${when}\nGuests: ${rec.guests || ""}\nNotes: ${rec.notes || ""}\nStatus: ${rec.status}` +
               (link ? `\n\nManage this booking: ${link}` : "");
  const html = `<p><b>New ${rec.type}</b> — ${rec.customer_name || "guest"}</p>` +
    `<p>When: ${when}<br>Guests: ${rec.guests || "?"}<br>Contact: ${rec.customer_contact || ""}<br>Notes: ${rec.notes || "—"}</p>` +
    (link ? `<p><a href="${link}" style="background:#1a7f4b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Review &amp; confirm</a></p>` +
            `<p style="color:#888;font-size:.85rem">Opens a page with Confirm / Decline buttons. Link valid 7 days.</p>` : "");

  await tx().sendMail({ from: owner(), to: owner(), subject: `New ${rec.type}: ${rec.customer_name || "guest"} — ${when}`, text, html })
    .catch((e) => console.warn("notify owner:", e.message));
  // …existing guest "request received" email unchanged…
}

async function sendDecline(rec) {
  if (!process.env.SMTP_USER || !isEmail(rec.customer_contact)) return;
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  await tx().sendMail({ from: owner(), to: rec.customer_contact,
    subject: "About your reservation request — The Fisherman",
    text: `Hi ${rec.customer_name || ""},\n\nSorry — we're unable to accommodate ${when} (${rec.guests || "?"} guests). ` +
          `Please try another time or message us on WhatsApp/Zalo and we'll help.\n\nReference: ${rec.id}\n— The Fisherman` })
    .catch((e) => console.warn("decline mail:", e.message));
}
module.exports = { sendBookingNotifications, sendConfirmation, sendDecline };
```
> `require("../booking-action")` from `_lib/notify.js` resolves to `functions/booking-action.js` (one dir up). Only `tokenFor` (pure `session.sign`) is used — no circular execution.

### 3.5 `functions/_lib/booking-config.json` + `scripts/prebake.mjs` *(edit — add `baseUrl`)*
Emails need the absolute site URL. Add it where prebake already builds the booking config:
```js
const bookingCfg = {
  // …existing fields…
  baseUrl: base || origin || "",                 // NEW — absolute site URL for email links
  menuUrl: bk.menuUrl || ((base || origin || "") + "/#menu"),
};
```
(`process.env.URL` is the runtime fallback in `notify.js` if the file lacks it.)

### 3.6 `netlify.toml` *(optional — prettier link)*
```toml
[[redirects]]
  from = "/confirm"
  to   = "/.netlify/functions/booking-action"
  status = 200
```
Then emails can use `${base}/confirm?token=…`. Cosmetic; the function path works without it.

### 3.7 `admin/admin.js` *(no change required)*
The admin Orders view keeps its Confirm/Decline buttons (they call `update-order`, now routed through the shared `orders.setStatus`). Email links and admin are two front-doors to the same action.

---

## 4. Testing

**Local (`netlify dev`, SMTP optional):**
```bash
# 1) make a pending booking → grab its id from the response / admin
curl -s -X POST localhost:8888/.netlify/functions/submit-order -H "Content-Type: application/json" \
  -d '{"type":"reservation","customer_name":"Anna","customer_contact":"anna@example.com","date":"2026-07-14","time":"19:00","guests":"2","botcheck":""}'

# 2) mint a link the way notify does (node one-liner) and open it:
node -e 'process.env.SESSION_SECRET="dev-secret-please-change-me-in-env";const s=require("./functions/_lib/session");console.log("http://localhost:8888/.netlify/functions/booking-action?token="+encodeURIComponent(s.sign({id:"<ID>",kind:"booking-action",exp:Math.floor(Date.now()/1000)+600})))'
# → GET shows the landing page with Confirm/Decline (no state change)
# → click Confirm → status flips to "confirmed", guest email sent (if SMTP set)
```
**Assertions:**
- GET never changes status (prefetch-safe); only the POST button does.
- Confirm → `o/<id>.status === "confirmed"`, guest gets "confirmed" mail, slot kept.
- Decline → status `declined`, guest gets "couldn't accommodate" mail, slot count decremented.
- Expired/garbled token → 401 landing page, no mutation.
- Re-clicking a handled link → "Already confirmed/declined", no duplicate email.
- Admin Confirm/Decline still works (shared `orders.setStatus`).

---

## 5. Edge cases & notes

- **Email client prefetch** — handled by the GET-reads / POST-writes split. (If you ever want *true* one-click with no landing page, you'd accept the small prefetch risk and use single-use tokens that self-invalidate; the two-step is safer and still one obvious click.)
- **SMTP not configured** — no owner email is sent, so there are no links; the owner uses `/admin` exactly as today. The feature is purely additive.
- **`SESSION_SECRET` must be strong and stable** — rotating it invalidates outstanding links (acceptable; admin still works). If it's still the dev default, set it before shipping.
- **Token in URL** — logged by proxies/history. Low sensitivity (only lets someone confirm/decline one specific booking), 7-day expiry, and it's the owner's own inbox. Acceptable, same as reset links.
- **HTML email** — Gmail renders the button; the `text` part includes the raw URL as fallback for plain-text clients.

---

## 6. Effort & sequencing

1. `_lib/orders.js` + refactor `update-order.js` (~30 min).
2. `availability.js` `releaseSlot` (~10 min).
3. `booking-action.js` GET/POST + pages (~1–2 h).
4. `notify.js` owner-email links + `sendDecline` (~45 min).
5. `booking-config.json`/`prebake.mjs` `baseUrl` + optional `/confirm` route (~15 min).
6. Test matrix in §4; then it ships with the same deploy as the booking API.

**Definition of done:** the owner receives a booking email, taps **Review & confirm**, sees the booking with two buttons, clicks **Confirm**, and the guest is emailed a confirmation — without ever opening `/admin`.
