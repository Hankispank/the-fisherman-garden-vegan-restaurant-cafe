# Self-Contained Order Log (Netlify Blobs) — Detailed Implementation Plan

**Date:** 2026-07-03 (v2, fully specified with code) · **supersedes** `plan/order-submit-web3forms-fix-plan.md`
**Goal:** orders/reservations are POSTed to the site's own Netlify Function, stored in Netlify Blobs (the infrastructure already powering admin content), and browsable in the admin panel. WhatsApp/Zalo stays the instant channel; the log is the restaurant-side record and makes "Order received! Reference …" actually true. No third-party service, no key.

All code below is written against the verified working tree (post-`1d75687`): `openPanel()` at `admin/admin.js:498`, `var FN = "/.netlify/functions"` at `admin.js:23`, admin bar markup at `admin/admin.html:43–51`, session guard pattern from `functions/save-content.js:19–23`, `checkRateLimit` exported from `functions/_lib/session.js:89–101`, blobs wrapper `functions/_lib/blobs.js` (local fallback has **no `list()`/`delete()`** — hence the index-key design).

---

## 1. Data shape (store `orders`, separate from `content`)

- Key `index` → JSON array, newest first, **capped 200**:
  `[{ "id": "FG-20260703-A1B2-1751500000000", "at": "2026-07-03T09:15:00.000Z", "type": "order", "name": "Anna", "total": "255,000 ₫", "status": "new" }]`
- Key `o/<id>` → full sanitized payload + `receivedAt`, `status`.

`id` = client `generateOrderId()` + `"-" + Date.now()` server-side (uniqueness without coordination). Index read-modify-write can race two simultaneous orders; worst case one index row is lost while both `o/<id>` blobs persist — acceptable at restaurant volume; documented in code.

---

## 2. NEW `functions/submit-order.js` — public write endpoint

```js
"use strict";
/**
 * submit-order — public endpoint for order/reservation submissions.
 * No auth (customers call it). Hardened: method check, size cap, honeypot,
 * field allowlist + length caps, per-IP rate limit, capped index.
 * See plan/order-log-netlify-blobs-implementation-plan.md
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

/* Own limiter (do NOT reuse session.checkRateLimit: its 10/15min window is
 * tuned for login brute force; shared restaurant Wi-Fi would trip it). */
const _hits = new Map(); // ip → { count, resetAt }
function allow(ip) {
  const now = Date.now();
  let rec = _hits.get(ip);
  if (!rec || now > rec.resetAt) rec = { count: 0, resetAt: now + 15 * 60 * 1000 };
  rec.count++;
  _hits.set(ip, rec);
  return rec.count <= 30; // 30 submissions / 15 min / IP
}

const FIELDS = {           // allowlist → max length
  type: 24, order_id: 64, contact_method: 16, channel: 16,
  customer_name: 120, customer_contact: 160, order_type: 60,
  guests: 8, date: 16, time: 8, items: 4000, total: 40,
  notes: 1000, message: 4000, subject: 160, from_name: 120,
};

function sanitize(body) {
  const out = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    if (typeof body[k] === "string") out[k] = body[k].slice(0, max);
  }
  return out;
}

function resp(code, obj) {
  return { statusCode: code, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed." });
  if ((event.body || "").length > 10 * 1024) return resp(413, { error: "Payload too large." });

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  if (!allow(ip)) return resp(429, { error: "Too many requests." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (_) { return resp(400, { error: "Invalid JSON body." }); }

  // Honeypot: pretend success, store nothing (don't teach bots).
  if (body.botcheck) return resp(200, { success: true, id: "ok" });

  const data = sanitize(body);
  if (data.type !== "order" && data.type !== "reservation")
    return resp(400, { success: false, error: "Invalid type." });
  if (!data.customer_contact)
    return resp(400, { success: false, error: "Missing contact." });

  const id = (data.order_id || "NA").replace(/[^\w-]/g, "").slice(0, 40) + "-" + Date.now();
  const record = { ...data, id, receivedAt: new Date().toISOString(), status: "new" };

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("orders", event);

    await store.setJSON("o/" + id, record);

    // Index update (read-modify-write; benign race documented in the plan).
    const index = (await store.get("index", { type: "json" })) || [];
    index.unshift({ id, at: record.receivedAt, type: data.type,
                    name: data.customer_name || "", total: data.total || "", status: "new" });
    const trimmed = index.slice(0, 200);
    // Prune blobs that fell off the index (requires delete(); see §5).
    for (const dropped of index.slice(200)) {
      try { await store.delete("o/" + dropped.id); } catch (_) { /* best effort */ }
    }
    await store.setJSON("index", trimmed);

    return resp(200, { success: true, id });
  } catch (err) {
    return resp(500, { success: false, error: "Storage error: " + err.message });
  }
};
```

## 3. NEW `functions/get-orders.js` — admin read (session-guarded)

```js
"use strict";
/** get-orders — list order index, or one full order via ?id= (auth required). */
const session = require("./_lib/session");
const JSON_HEADERS = { "Content-Type": "application/json" };

exports.handler = async function (event) {
  if (event.httpMethod !== "GET")
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };

  // Same guard as functions/save-content.js:19–23
  const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
  const payload = session.verify(token);
  if (!payload)
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("orders", event);
    const id = (event.queryStringParameters || {}).id;

    if (id) {
      const order = await store.get("o/" + id, { type: "json" });
      if (!order) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Not found." }) };
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ order }) };
    }
    const index = (await store.get("index", { type: "json" })) || [];
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ orders: index }) };
  } catch (err) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Storage error: " + err.message }) };
  }
};
```

## 4. NEW `functions/update-order.js` — mark handled / delete (session-guarded)

```js
"use strict";
/** update-order — POST { id, status: "handled" } or { id, delete: true } (auth required). */
const session = require("./_lib/session");
const JSON_HEADERS = { "Content-Type": "application/json" };

exports.handler = async function (event) {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };

  const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
  if (!session.verify(token))
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (_) { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }
  if (!body.id) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Missing id." }) };

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("orders", event);
    let index = (await store.get("index", { type: "json" })) || [];

    if (body.delete === true) {
      try { await store.delete("o/" + body.id); } catch (_) {}
      index = index.filter((r) => r.id !== body.id);
    } else if (body.status === "handled" || body.status === "new") {
      index = index.map((r) => (r.id === body.id ? { ...r, status: body.status } : r));
      const order = await store.get("o/" + body.id, { type: "json" });
      if (order) { order.status = body.status; await store.setJSON("o/" + body.id, order); }
    } else {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Nothing to do." }) };
    }

    await store.setJSON("index", index);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Storage error: " + err.message }) };
  }
};
```

## 5. `functions/_lib/blobs.js` — add `delete()` to the local fallback

In `localStore()`'s returned object (after `setJSON`, ~line 72):

```js
    async delete(key) {
      const file = keyPath(key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
```

(The production path already exposes `delete()` via `@netlify/blobs` — no change there.)

## 6. `js/config.js` — endpoint swap, key removal

```js
// DELETE line 24:  web3formsKey: "",
// REPLACE line 25:
  endpoint: "/.netlify/functions/submit-order",   // relative → works on any domain
```

## 7. `js/app.js` — three small edits

**7.1** `buildOrderPayload` (line ~416) and `buildReservationPayload` (line ~454): **delete the `access_key: cfg.web3formsKey,` line** from each. Everything else in the payloads matches the server allowlist (§2 `FIELDS`) — verified field-by-field.

**7.2** `submitToEndpoint` (line ~300) — success detection + diagnosability. Replace the fetch block's return line:

```js
        const json = await res.json().catch(() => ({}));
        if (!(res.ok && json.success === true)) {
          console.warn("order-log rejected:", res.status, json.error || "");   // NEW
          return false;
        }
        return true;
```

(`sendBeacon` fallback unchanged — fire-and-forget returns `true`, same as today.)

**7.3** No changes to the click handler (`app.js:522–566`): success path now truthfully shows `confirm.successOrder` with the reference id; failure path shows the reworded copy (§8). Cart still clears only via `onSuccess` on real success.

## 8. `js/i18n.js` — honest failure copy (values are admin-editable; keys unchanged)

```js
// EN block, line ~165 — REPLACE value:
"confirm.error": "We couldn't save your order on our server. Please make sure to press Send in WhatsApp/Zalo — your order reaches us directly there.",

// VI block, line ~322 — REPLACE value:
"confirm.error": "Không lưu được đơn trên máy chủ. Vui lòng bấm Gửi trong WhatsApp/Zalo — đơn của bạn sẽ đến thẳng chúng tôi.",
```

## 9. Admin panel — Orders view

**9.1 `admin/admin.html`** — add to the admin bar (line ~46, before the Preview button):

```html
<button class="admin-bar__btn" id="adminOrdersBtn" title="View received orders">📋 Orders</button>
```

**9.2 `admin/admin.js`** — panel + badge (place near the other `open*Editor` functions; wire-up in the post-login init where the other `admin-bar__btn` listeners are bound):

```js
/* ── ORDERS ─────────────────────────────────────────────────────── */
function fmtWhen(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function refreshOrdersBadge() {
  fetch(FN + "/get-orders", { credentials: "include" })
    .then(function (r) { return r.ok ? r.json() : { orders: [] }; })
    .then(function (j) {
      var n = (j.orders || []).filter(function (o) { return o.status === "new"; }).length;
      var btn = el("adminOrdersBtn");
      if (btn) btn.textContent = n ? "📋 Orders (" + n + ")" : "📋 Orders";
    })
    .catch(function () {});
}

function openOrdersPanel() {
  openPanel("ORDERS — received orders & bookings", '<div class="admin-note">Loading…</div>', "");
  fetch(FN + "/get-orders", { credentials: "include" })
    .then(function (r) { return r.json(); })
    .then(function (j) { renderOrdersList(j.orders || []); })
    .catch(function () {
      el("adminPanelBody").innerHTML = '<div class="admin-note admin-note--error">Could not load orders.</div>';
    });
}

function renderOrdersList(orders) {
  var body = el("adminPanelBody");
  if (!orders.length) {
    body.innerHTML = '<div class="admin-note admin-note--info">No orders yet — new orders appear here and in your WhatsApp/Zalo chat.</div>';
    return;
  }
  body.innerHTML = orders.map(function (o) {
    return '<div class="admin-order' + (o.status === "new" ? " admin-order--new" : "") + '" data-id="' + escHtml(o.id) + '">' +
      '<div class="admin-order__row">' +
        '<span class="admin-order__type">' + (o.type === "reservation" ? "📅 Booking" : "🍽️ Order") + "</span>" +
        '<span class="admin-order__when">' + escHtml(fmtWhen(o.at)) + "</span>" +
      "</div>" +
      '<div class="admin-order__row">' +
        "<strong>" + escHtml(o.name || "—") + "</strong>" +
        "<span>" + escHtml(o.total || "") + "</span>" +
      "</div>" +
      '<div class="admin-order__detail" hidden></div>' +
      "</div>";
  }).join("");

  body.querySelectorAll(".admin-order").forEach(function (row) {
    row.addEventListener("click", function () { toggleOrderDetail(row); });
  });
}

function toggleOrderDetail(row) {
  var box = row.querySelector(".admin-order__detail");
  if (!box.hidden) { box.hidden = true; return; }
  fetch(FN + "/get-orders?id=" + encodeURIComponent(row.dataset.id), { credentials: "include" })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var o = j.order || {};
      var contact = escHtml(o.customer_contact || "");
      var link = o.contact_method === "email"
        ? '<a href="mailto:' + contact + '">' + contact + "</a>"
        : '<a href="tel:' + contact.replace(/[^\d+]/g, "") + '">' + contact + "</a>";
      box.innerHTML =
        "<pre class='admin-order__items'>" + escHtml(o.items || o.message || "") + "</pre>" +
        "<p>Contact: " + link + (o.guests ? " · Guests: " + escHtml(o.guests) : "") +
        (o.date ? " · " + escHtml(o.date) + " " + escHtml(o.time || "") : "") + "</p>" +
        '<div class="admin-order__actions">' +
          '<button class="admin-btn" data-act="handled">✓ Mark handled</button>' +
          '<button class="admin-btn admin-btn--danger" data-act="delete">🗑 Delete</button>' +
        "</div>";
      box.hidden = false;
      box.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          var payload = b.dataset.act === "delete"
            ? { id: row.dataset.id, delete: true }
            : { id: row.dataset.id, status: "handled" };
          fetch(FN + "/update-order", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(function () { openOrdersPanel(); refreshOrdersBadge(); });
        });
      });
    });
}

// In the post-login init (next to the other admin-bar button bindings):
el("adminOrdersBtn").addEventListener("click", openOrdersPanel);
refreshOrdersBadge();
```

**9.3 `admin/admin.css`** — minimal styles:

```css
.admin-order { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; }
.admin-order--new { border-color: #16a34a; background: #f0fdf4; }
.admin-order__row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.admin-order__items { white-space: pre-wrap; font-size: 12px; background: #f8fafc; padding: 8px; border-radius: 6px; }
.admin-order__actions { display: flex; gap: 8px; margin-top: 6px; }
.admin-btn--danger { color: #b91c1c; }
```

## 10. Template scrub, config & docs cleanup

1. `scripts/verify-no-template-data.js`: delete line 45 (`"00000000-…-000000000002", // seed web3formsKey sentinel`) and lines 57–59 (the three `web3formsKey` regexes). An absent key is no longer an incompleteness marker.
2. `netlify.toml:6`: remove `--allow-incomplete` — **after** running `node scripts/verify-no-template-data.js` locally to confirm no *other* incomplete markers trip.
3. `admin/admin.js:610` Settings note → `"Phone and email update everywhere at once — Visit section, footer. Order/booking notifications arrive in your WhatsApp/Zalo chat and under 📋 Orders in this admin bar."`
4. Doc sweep: `TEMPLATE.md`, `AGENTS.md`, `.env.example` — replace Web3Forms setup instructions with two lines describing the order log (public `submit-order`, admin `get-orders`/`update-order`, store `orders`).
5. Out of scope (explicit): email notifications. Later = one provider call inside `submit-order.js`; storage/admin unchanged.

## 11. Test plan / acceptance

1. **Local (`netlify dev`)**: place an order → 200 `{success:true,id}`; files appear under `.netlify/blobs-local/orders/` (`index`, `o/<id>`); panel shows "Order received! Reference FG-…"; cart clears.
2. **Reservation**: submits via same endpoint, `type: "reservation"`, appears as "📅 Booking".
3. **Honeypot**: `curl -d '{"botcheck":"x","type":"order","customer_contact":"1"}' …/submit-order` → `{success:true}` and **nothing stored**.
4. **Validation**: missing contact → 400 + panel shows the reworded `confirm.error`; chat deep link opened regardless. Body >10KB → 413. 31st request in 15 min from one IP → 429.
5. **Admin**: badge shows `📋 Orders (1)`; open → row (green/new) → detail shows items, `tel:` link, guests; Mark handled → badge clears; Delete → row + blob gone; logged out → `get-orders` returns 401.
6. **Race sanity**: two rapid orders → both `o/<id>` blobs exist (index may briefly show one — acceptable, documented).
7. **Prod deploy**: repeat 1 & 5 on the live site; grep the served JS for `web3forms` → zero hits; build passes with the scrub gate re-armed (no `--allow-incomplete`).

## 12. File-by-file summary

| File | Change | Section |
|------|--------|---------|
| `functions/submit-order.js` | **new** — public, validated, honeypot, rate-limited, capped index | §2 |
| `functions/get-orders.js` | **new** — session-guarded list/detail | §3 |
| `functions/update-order.js` | **new** — session-guarded handled/delete | §4 |
| `functions/_lib/blobs.js` | add `delete()` to local fallback | §5 |
| `js/config.js` | endpoint → own function; remove `web3formsKey` | §6 |
| `js/app.js` | drop `access_key` ×2; stricter success check + warn log | §7 |
| `js/i18n.js` | reword `confirm.error` EN+VI | §8 |
| `admin/admin.html` | Orders button in admin bar | §9.1 |
| `admin/admin.js` | Orders panel, badge, wiring | §9.2 |
| `admin/admin.css` | order-row styles | §9.3 |
| `scripts/verify-no-template-data.js` | remove web3forms sentinels | §10 |
| `netlify.toml` | remove `--allow-incomplete` | §10 |
| `TEMPLATE.md`, `AGENTS.md`, `.env.example` | doc sweep | §10 |

**Effort:** ~3–4 h + §11 testing. No new npm dependencies (uses existing `@netlify/blobs` path), no external accounts.
