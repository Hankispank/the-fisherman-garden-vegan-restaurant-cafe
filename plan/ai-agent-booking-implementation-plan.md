# AI-Agent Booking — Implementation Plan

**Date:** 2026-07-07
**Goal:** Let an AI assistant (ChatGPT, Gemini, Claude, or any HTTP-capable agent) **book a table directly** — no Chrome extension, no browser automation — and let assistants **proactively offer** booking. Uses only self-hostable / free components (no paid third-party reservation service).

**Decisions locked with owner (2026-07-07):**
- Confirmation model: **request → owner confirms** (API acknowledges "pending", customer notified).
- Customer notification: **yes**, automatic — via the restaurant's own mailbox (SMTP), no paid service.
- Integrations: **standards layer** (REST + OpenAPI + `ReserveAction`) + **ChatGPT Action packaging**; must work for most AIs without subscribing to anything. → we also add a **self-hosted MCP server** (free, runs on your own Netlify) so **Claude** works natively.
- Availability: **opening hours + basic per-slot capacity**.
- Post-booking: after a successful reservation, surface a **soft, optional menu deep-link** ("browse while you wait") from the server response so every AI relays the same wording. Never a required step; browsing ≠ a pre-order bound to the booking.

---

## 0. Current state (newest code) — what already works

You are ~60% there. The booking backend already exists:

- `functions/submit-order.js` — public, no-auth JSON endpoint. Hardened: `POST`-only, 10 KB cap, honeypot (`botcheck`), field allowlist + length caps, 30 req/IP/15 min rate limit. Stores each submission to **Netlify Blobs** (`orders` store, key `o/<id>`) + a capped index. Returns `{success, id}`.
- `js/config.js` → `endpoint: "/.netlify/functions/submit-order"` — the on-page form already routes here (the old Web3Forms path is gone).
- `openapi.json` (OpenAPI 3.1) — describes the endpoint; `__BASE_URL__` is substituted at prebake (`scripts/prebake.mjs` L107-110).
- `api.html` served at `/api` — human docs + curl example, links to `/openapi.json`.
- `llms.txt` + `/.well-known/llms.txt` — advertise "Programmatic booking: /api (OpenAPI: /openapi.json)".
- Admin side: `functions/get-orders.js`, `functions/update-order.js` (auth) to view + mark handled.

**So why does an AI still "need the Chrome extension"?** Because assistants today are *driving the web form UI* instead of *calling the API*, and nothing wires the API into the assistant's tool layer. The concrete gaps:

1. **No `schema.org` `ReserveAction`** in the JSON-LD → answer-engines/agents get no machine signal that a booking action exists at a URL, so they neither call it nor proactively offer it.
2. **No CORS / preflight** on `submit-order` → any browser-context agent is blocked cross-origin.
3. **Thin contract** → returns `status:"new"`, no availability/hours validation, no customer notification. An AI can't honestly promise a booking or explain what happens next.
4. **No native connector** → Claude needs an MCP server; ChatGPT needs the OpenAPI imported as an Action; Gemini needs the OpenAPI as a function/tool. None auto-discovers `/openapi.json` from a chat.

This plan closes those four gaps.

---

## 1. Target architecture

```
                 ┌─────────────── discovery (so the AI knows it CAN book) ───────────────┐
   Page JSON-LD  │  Restaurant.potentialAction = ReserveAction → EntryPoint(POST url)     │
   /llms.txt     │  "## Booking for AI agents" block: method, URL, fields, availability   │
   /openapi.json │  OpenAPI 3.1 (submitOrder + checkAvailability), x-openai-isConsequential│
   /.well-known/ai-plugin.json  (ChatGPT/plugin-style manifest → openapi.json)            │
                 └───────────────────────────────────────────────────────────────────────┘
                                             │
        ┌────────────────────────────────────┼─────────────────────────────────────────┐
        ▼                                     ▼                                          ▼
  ChatGPT custom GPT Action           Gemini / generic HTTP agent               Claude (MCP)
        │  imports openapi.json               │  imports openapi.json                    │  adds MCP URL
        └──────────────┬──────────────────────┴───────────────┬──────────────────────────┘
                       ▼                                       ▼
        POST /.netlify/functions/submit-order        POST /.netlify/functions/mcp (JSON-RPC)
                       │                                       │ (tools/call → book_table)
                       ▼                                       ▼
        ┌──────────────────────── booking core (server) ───────────────────────┐
        │  CORS + preflight · validate (hours + capacity) · status:"pending"     │
        │  → Netlify Blobs (orders + slot counters) · notify owner + customer    │
        │  → response: {status:"pending_confirmation", id, message, reservation} │
        └───────────────────────────────────────────────────────────────────────┘
                       │
                       ▼  owner opens /admin → confirm
        update-order {status:"confirmed"} → notify customer "confirmed"
```

Everything is your own Netlify site + free npm (`nodemailer`) + your restaurant mailbox. No external booking platform.

---

## 2. How each AI will book (consumer view)

- **ChatGPT** — owner creates a *custom GPT* → **Actions** → *Import from URL* `https://<site>/openapi.json` → Auth: *None*. The GPT can now call `submitOrder`/`checkAvailability`. `x-openai-isConsequential: true` on the POST makes ChatGPT show a confirm step before booking. The `/.well-known/ai-plugin.json` manifest lets plugin-style clients discover it too.
- **Gemini / Vertex / any function-calling agent** — import the same `openapi.json` as a tool/function declaration; call `submitOrder`.
- **Claude** — add the **self-hosted MCP server** URL `https://<site>/.netlify/functions/mcp` as a connector (Settings → Connectors / Desktop config). Claude then has `check_availability` + `book_table` tools and books natively. (Without MCP, Claude.ai cannot POST arbitrary endpoints from a chat — MCP is the native path, hence Phase 5.)
- **Any HTTP agent / your own future on-site assistant** — reads `/llms.txt` booking block or `/openapi.json`, then `POST`s JSON. CORS enables browser-context callers.

**Proactive prompting reality:** a third-party AI will *proactively* offer to book only once (a) its connector/Action is installed, or (b) it is browsing the page and parses the `ReserveAction`. You cannot force an external model to prompt unprompted; this plan maximises both paths by making the capability discoverable in every machine surface.

---

## 3. Phase 1 — Enrich the REST booking API (server)

### 3.1 `functions/_lib/booking-config.json` *(new — generated by prebake, see §6)*
Server-side availability params (functions can't eval the browser `window.SITE_CONFIG`, so prebake emits this from the SSOT):
```json
{ "tzOffsetMinutes": 420, "opens": "08:00", "closes": "21:00", "slotMinutes": 90, "capacityPerSlot": 8, "maxPartySize": 20, "menuUrl": "https://<site>/#menu" }
```

### 3.2 `functions/_lib/availability.js` *(new)*
```js
"use strict";
const cfg = require("./booking-config.json");

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
// Both "now" and the requested time are built as UTC wall-clock so the comparison
// is consistent regardless of the Lambda's own zone. VN has no DST → fixed offset.
const nowLocalMs = () => Date.now() + cfg.tzOffsetMinutes * 60000;
const slotKey = (date, time) => "slot/" + date + "T" + time;

async function check({ date, time, guests }, event) {
  if (!date || !time) return { ok: false, reason: "Please provide a date and time." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return { ok: false, reason: "Use date YYYY-MM-DD and time HH:MM (24h)." };

  const reqMs = Date.parse(date + "T" + time + ":00Z");
  if (Number.isNaN(reqMs)) return { ok: false, reason: "Invalid date/time." };
  if (reqMs < nowLocalMs()) return { ok: false, reason: "That time is in the past." };

  const mins = toMin(time);
  if (mins < toMin(cfg.opens) || mins > toMin(cfg.closes))
    return { ok: false, reason: `We're open ${cfg.opens}–${cfg.closes} daily.`,
             suggestions: [cfg.opens, "12:00", "19:00"] };

  const party = parseInt(guests || "0", 10) || 0;
  if (cfg.maxPartySize && party > cfg.maxPartySize)
    return { ok: false, reason: `For parties over ${cfg.maxPartySize}, please contact us directly.` };

  const { getStore } = require("./blobs");
  const store = getStore("orders", event);
  const used = (await store.get(slotKey(date, time), { type: "json" })) || { count: 0 };
  if (cfg.capacityPerSlot && used.count + Math.max(party, 1) > cfg.capacityPerSlot)
    return { ok: false, reason: "That time is fully booked. Please try another slot." };

  return { ok: true };
}

async function reserveSlot(store, { date, time, guests }) {
  const key = slotKey(date, time);
  const used = (await store.get(key, { type: "json" })) || { count: 0 };
  used.count += Math.max(parseInt(guests || "1", 10) || 1, 1);
  await store.setJSON(key, used); // benign race, same pattern as the order index
}

module.exports = { check, reserveSlot, slotKey };
```

### 3.3 `functions/submit-order.js` *(edit)*
Add CORS + preflight, reservation validation, `pending` status, slot reservation, notification, and a richer response. Diff-level changes:
```js
// near the top
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS };
```
```js
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed." });
  // …existing size / rate-limit / JSON parse / honeypot / sanitize …

  if (data.type !== "order" && data.type !== "reservation")
    return resp(400, { success: false, error: "Invalid type." });
  if (!data.customer_contact) return resp(400, { success: false, error: "Missing contact." });

  // NEW: reservation availability (hours + capacity)
  if (data.type === "reservation") {
    const av = require("./_lib/availability");
    const chk = await av.check({ date: data.date, time: data.time, guests: data.guests }, event);
    if (!chk.ok) return resp(409, { success: false, status: "unavailable",
      error: chk.reason, suggestions: chk.suggestions || [] });
  }

  const status = data.type === "reservation" ? "pending" : "new";
  const id = (data.order_id || "NA").replace(/[^\w-]/g, "").slice(0, 40) + "-" + Date.now();
  const record = { ...data, id, receivedAt: new Date().toISOString(), status };

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("orders", event);
    await store.setJSON("o/" + id, record);
    // …existing index unshift/trim/prune, but write status: status …

    if (data.type === "reservation") {
      try { await require("./_lib/availability").reserveSlot(store, data); } catch (_) {}
    }
    try { await require("./_lib/notify").sendBookingNotifications(record); } catch (_) {}

    const bcfg = require("./_lib/booking-config.json");          // has menuUrl
    const nudge = data.type === "reservation" && bcfg.menuUrl
      ? ` While you wait, you can browse the menu (optional): ${bcfg.menuUrl}` : "";
    const message = data.type === "reservation"
      ? `Reservation request received for ${data.date} ${data.time} (${data.guests || "?"} guests). ` +
        `The restaurant will confirm shortly` + (data.customer_contact ? " via your contact." : ".") + nudge
      : "Order received.";
    return resp(200, {
      success: true,
      status: status === "pending" ? "pending_confirmation" : "received",
      id, message,
      reservation: data.type === "reservation"
        ? { name: data.customer_name, date: data.date, time: data.time, guests: data.guests }
        : undefined,
      // Structured hint so agents can render a soft, optional CTA (browse ≠ pre-order).
      menu: data.type === "reservation" && bcfg.menuUrl
        ? { url: bcfg.menuUrl, suggestion: "Browse the menu while you wait — optional, not required to book." }
        : undefined,
    });
  } catch (err) {
    return resp(500, { success: false, error: "Storage error: " + err.message });
  }
};
```
> Note `resp()` already spreads `JSON_HEADERS`, so CORS rides on every response automatically once `JSON_HEADERS` includes `CORS`.

### 3.4 `functions/check-availability.js` *(new)*
Lets agents check before booking (better UX; lets the AI propose valid times):
```js
"use strict";
const av = require("./_lib/availability");
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const H = { "Content-Type": "application/json", ...CORS };
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Use GET." }) };
  const q = event.queryStringParameters || {};
  const r = await av.check({ date: q.date, time: q.time, guests: q.guests }, event);
  return { statusCode: 200, headers: H,
    body: JSON.stringify({ available: r.ok, reason: r.reason || null, suggestions: r.suggestions || [] }) };
};
```

### 3.5 Menu nudge (post-booking, optional)
The booking response carries a **soft, optional** invitation to browse the menu — driven from the server so every assistant (ChatGPT, Gemini, Claude) relays the same wording without being told to. It is never a required step, and it is framed as *browse*, not a pre-order tied to the reservation. One source (`booking-config.json` → `menuUrl`, deep-linked to the `#menu` anchor) feeds four surfaces:

- **REST `submit-order`** — the `message` string *and* a structured `menu:{url,suggestion}` field (see §3.3) so tool-based agents can render a tidy CTA.
- **MCP `book_table`** — automatic: the tool reuses `submit-order`'s handler, so `j.message` already includes the nudge (§6.1).
- **Customer confirmation email** (`notify.js`, §5.1) — a "browse the menu" line.
- **`llms.txt` agent block** (§4.2) — documents the browse link for assistants reading the page.

Honest framing to keep in the copy: choosing items on the site is your existing separate cart/pickup flow — it is **not** attached to the reservation. The nudge says "browse while you wait," not "lock in your food." Wiring the cart to a reservation is deliberately out of scope here.

---

## 4. Phase 2 — Advertise the booking action (discovery)

### 4.1 `js/render-core.js` → `buildJsonLd` *(edit — template-level, all sites inherit)*
Add `potentialAction` to the `Restaurant` node (place just before `graph` is assembled, ~L356):
```js
if (seo.enableActions !== false) {
  var bookUrl = seo.bookingApiUrl || (base + "/.netlify/functions/submit-order");
  restaurant.potentialAction = [{
    "@type": "ReserveAction",
    name: "Reserve a table",
    target: {
      "@type": "EntryPoint",
      urlTemplate: bookUrl,
      httpMethod: "POST",
      contentType: "application/json",
      encodingType: "application/json",
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform"
      ]
    },
    result: { "@type": "FoodEstablishmentReservation", name: "Table reservation" }
  }];
}
```
This is a sanctioned template-level edit to the locked engine (per `TEMPLATE.md`: "a genuinely new feature belongs in the template so all sites inherit it"). It is emitted in both the edge bake and the browser, so crawlers see it in the no-JS HTML.

### 4.2 `netlify/edge-functions/lib/bake-core.mjs` → `buildLlms` / `buildLlmsFull` *(edit)*
Replace the single "Programmatic booking" line with an explicit agent block so browsing assistants can act on it:
```js
lines.push("");
lines.push("## Booking for AI agents");
lines.push("");
lines.push("You can book a table or place an order programmatically — no human UI needed.");
lines.push("- Check availability: GET " + base + "/.netlify/functions/check-availability?date=YYYY-MM-DD&time=HH:MM&guests=N");
lines.push("- Create a booking: POST " + base + "/.netlify/functions/submit-order");
lines.push("  JSON body: { \"type\":\"reservation\", \"customer_name\":\"…\", \"customer_contact\":\"email or phone\", \"date\":\"YYYY-MM-DD\", \"time\":\"HH:MM\", \"guests\":\"N\", \"botcheck\":\"\" }");
lines.push("  Hours 08:00–21:00 local (Asia/Ho_Chi_Minh). Response returns { status:\"pending_confirmation\", id }. The restaurant confirms; the guest is emailed if an email was provided.");
lines.push("- After booking you may invite the guest to browse the menu (optional, not required to book): " + base + "/#menu");
lines.push("- Machine spec: " + base + "/openapi.json");
```

### 4.3 `openapi.json` *(edit)*
- Change `servers[0].url` to `"__BASE_URL__"` (prebake substitutes per site — right now it hard-codes the Fisherman URL, which breaks other forks).
- Add the `/.netlify/functions/check-availability` GET path.
- Enrich the `submitOrder` 200 schema with `status`, `message`, `reservation`.
- Add a 409 `unavailable` response.
- On the `submitOrder` POST add `"x-openai-isConsequential": true` (ChatGPT shows a confirm before booking); on `checkAvailability` add `"x-openai-isConsequential": false`.
- Add a clear `description` instructing agents to prefer `type:"reservation"` for table bookings and to pass 24h `HH:MM` within 08:00–21:00.

### 4.4 `.well-known/ai-plugin.json` *(new — static, `__BASE_URL__` replaced by prebake)*
```json
{
  "schema_version": "v1",
  "name_for_human": "The Fisherman Booking",
  "name_for_model": "the_fisherman_booking",
  "description_for_human": "Check availability and book a table or order food at The Fisherman.",
  "description_for_model": "Check availability and submit table reservations or food orders for The Fisherman (An Bang Beach, Hoi An, Vietnam). To book a table call submitOrder with type='reservation', date (YYYY-MM-DD), time (HH:MM 24h, 08:00–21:00 local), guests, customer_name, and customer_contact (email or phone). Confirm all details with the user before booking. Bookings are pending until the restaurant confirms; if an email is given the guest is emailed a confirmation.",
  "api": { "type": "openapi", "url": "__BASE_URL__/openapi.json" },
  "contact_email": "thefisherman.veganrestaurant@gmail.com",
  "legal_info_url": "__BASE_URL__/terms"
}
```

### 4.5 `api.html` *(edit)*
Add: the availability endpoint, the new response contract, the confirmation model ("pending → confirmed"), a ChatGPT "Import from URL" walkthrough, and the MCP URL (Phase 5).

---

## 5. Phase 3 & 4 — Notifications + owner confirmation

### 5.1 `functions/_lib/notify.js` *(new)* — SMTP via the restaurant's own mailbox (free, no SaaS)
```js
"use strict";
let _tx = null;
function tx() {
  if (_tx) return _tx;
  const nodemailer = require("nodemailer");
  const port = Number(process.env.SMTP_PORT || 465);
  _tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _tx;
}
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ""));
const owner = () => process.env.OWNER_EMAIL || process.env.SMTP_USER;

async function sendBookingNotifications(rec) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.warn("notify: SMTP not set; skipping"); return; }
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  const body = `New ${rec.type} ${rec.id}\nName: ${rec.customer_name || ""}\nContact: ${rec.customer_contact || ""}\n` +
               `When: ${when}\nGuests: ${rec.guests || ""}\nNotes: ${rec.notes || ""}\nStatus: ${rec.status}`;
  await tx().sendMail({ from: owner(), to: owner(),
    subject: `New ${rec.type}: ${rec.customer_name || "guest"} — ${when}`, text: body })
    .catch((e) => console.warn("notify owner:", e.message));
  if (isEmail(rec.customer_contact)) {
    const menuUrl = (() => { try { return require("./booking-config.json").menuUrl; } catch { return ""; } })();
    await tx().sendMail({ from: owner(), to: rec.customer_contact,
      subject: "We received your reservation request",
      text: `Hi ${rec.customer_name || ""},\n\nWe received your request for ${when} (${rec.guests || "?"} guests). ` +
            `Our team will confirm shortly.\n\nReference: ${rec.id}` +
            (menuUrl ? `\n\nBrowse the menu while you wait (optional): ${menuUrl}` : "") +
            `\n— The Fisherman` })
      .catch((e) => console.warn("notify customer:", e.message));
  }
}

async function sendConfirmation(rec) {
  if (!process.env.SMTP_USER || !isEmail(rec.customer_contact)) return;
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  await tx().sendMail({ from: owner(), to: rec.customer_contact,
    subject: "Your table is confirmed — The Fisherman",
    text: `Hi ${rec.customer_name || ""},\n\nYour table for ${when} (${rec.guests || "?"} guests) is confirmed. ` +
          `See you soon!\n\nReference: ${rec.id}\n— The Fisherman` })
    .catch((e) => console.warn("confirm mail:", e.message));
}
module.exports = { sendBookingNotifications, sendConfirmation };
```
Notifications are **best-effort** — a mail failure never blocks the booking (callers wrap in try/catch). If a phone (not email) was given, only the owner is emailed and the owner confirms via WhatsApp/Zalo as today.

### 5.2 `functions/update-order.js` *(edit)* — owner confirm/decline + confirmation email
Extend the allowed statuses and fire the confirmation mail:
```js
} else if (["handled", "new", "pending", "confirmed", "declined"].includes(body.status)) {
  index = index.map((r) => (r.id === body.id ? { ...r, status: body.status } : r));
  const order = await store.get("o/" + body.id, { type: "json" });
  if (order) {
    order.status = body.status;
    await store.setJSON("o/" + body.id, order);
    if (body.status === "confirmed") { try { await require("./_lib/notify").sendConfirmation(order); } catch (_) {} }
  }
}
```
Admin UI (`admin/admin.js` orders view) gains **Confirm** / **Decline** buttons that POST `{id, status:"confirmed"|"declined"}` (mirrors the existing "handled" call — labels only, same wiring).

### 5.3 `package.json` *(edit)*
```json
"dependencies": { "@netlify/blobs": "…", "nodemailer": "^6.9.14" }
```

### 5.4 Netlify env vars (owner sets in Site settings → Environment)
`SMTP_USER` (Gmail address), `SMTP_PASS` (Gmail **App Password**, not the login password), optional `SMTP_HOST`/`SMTP_PORT`, optional `OWNER_EMAIL`. Absent → notifications silently skip (booking still works).

---

## 6. Phase 5 (recommended, optional) — self-hosted MCP server for Claude

A single function speaking **MCP over Streamable HTTP** (JSON-RPC 2.0, stateless POST). No external service, no paid deps. Claude adds it by URL; it then exposes `check_availability` + `book_table`.

### 6.1 `functions/mcp.js` *(new — skeleton)*
```js
"use strict";
const av = require("./_lib/availability");
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id" };
const H = { "Content-Type": "application/json", ...CORS };
const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

const TOOLS = [
  { name: "check_availability", description: "Check if a table is available.",
    inputSchema: { type: "object", required: ["date", "time"], properties: {
      date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" },
      guests: { type: "string" } } } },
  { name: "book_table", description: "Request a table reservation (pending until the restaurant confirms).",
    inputSchema: { type: "object", required: ["customer_name", "customer_contact", "date", "time", "guests"], properties: {
      customer_name: { type: "string" }, customer_contact: { type: "string", description: "email or phone" },
      date: { type: "string" }, time: { type: "string" }, guests: { type: "string" }, notes: { type: "string" } } } },
];

async function callTool(name, args, event) {
  if (name === "check_availability") {
    const r = await av.check(args, event);
    return { content: [{ type: "text", text: r.ok ? "Available." : "Not available: " + r.reason }] };
  }
  if (name === "book_table") {
    // Reuse the same core as the REST endpoint by invoking submit-order's logic.
    const { handler } = require("./submit-order");
    const res = await handler({ httpMethod: "POST", headers: event.headers,
      body: JSON.stringify({ type: "reservation", channel: "email", contact_method: "email", botcheck: "", ...args }) });
    const j = JSON.parse(res.body || "{}");
    return { content: [{ type: "text", text: j.message || (j.success ? "Booked (pending): " + j.id : "Failed: " + (j.error || "")) }] };
  }
  throw new Error("Unknown tool: " + name);
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify(rpcErr(null, -32600, "POST only")) };
  let msg; try { msg = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: H, body: JSON.stringify(rpcErr(null, -32700, "Parse error")) }; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize")
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, {
        protocolVersion: "2024-11-05", capabilities: { tools: {} },
        serverInfo: { name: "the-fisherman-booking", version: "1.0.0" } })) };
    if (method === "tools/list")
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, { tools: TOOLS })) };
    if (method === "tools/call") {
      const out = await callTool(params.name, params.arguments || {}, event);
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, out)) };
    }
    if (method === "notifications/initialized" || (id == null))
      return { statusCode: 202, headers: H, body: "" };
    return { statusCode: 200, headers: H, body: JSON.stringify(rpcErr(id, -32601, "Method not found: " + method)) };
  } catch (e) {
    return { statusCode: 200, headers: H, body: JSON.stringify(rpcErr(id, -32000, e.message)) };
  }
};
```
> Caveats to validate during build: MCP transport is evolving; confirm the target client (Claude) accepts a **stateless streamable-HTTP** server (no SSE session) — the skeleton above answers `initialize`/`tools/list`/`tools/call` synchronously, which covers the common case. If a session/SSE handshake is required by the client version, front it with a tiny session map or use `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`. Keep this phase behind a feature flag until verified. Because `book_table` reuses `submit-order`'s exported `handler`, availability + notifications + storage stay single-sourced.

Expose a clean path in `netlify.toml`:
```toml
[[redirects]]
  from = "/mcp"
  to   = "/.netlify/functions/mcp"
  status = 200
```

---

## 7. Config, SSOT & prebake wiring

### 7.1 `js/config.js` *(edit)* — owner-editable booking block (SSOT)
```js
booking: { tzOffsetMinutes: 420, opens: "08:00", closes: "21:00", slotMinutes: 90, capacityPerSlot: 8, maxPartySize: 20 /*, menuUrl: "" — optional; auto-derived as <site>/#menu */ },
```

### 7.2 `scripts/prebake.mjs` *(edit)* — emit server config + substitute `__BASE_URL__`
After the existing `openapi.json` block (~L110):
```js
// booking-config.json for serverless availability (from SITE_CONFIG.booking + hours)
const bk = (shim.SITE_CONFIG.booking) || {};
const bookingCfg = {
  tzOffsetMinutes: bk.tzOffsetMinutes ?? 420,
  opens: bk.opens || "08:00", closes: bk.closes || "21:00",
  slotMinutes: bk.slotMinutes || 90,
  capacityPerSlot: bk.capacityPerSlot || 8,
  maxPartySize: bk.maxPartySize || 20,
  menuUrl: bk.menuUrl || ((base || origin || "") + "/#menu"), // deep-link for the post-booking nudge
};
fs.writeFileSync(path.join(root, "functions", "_lib", "booking-config.json"),
  JSON.stringify(bookingCfg, null, 2)); // functions bundle from repo/functions AFTER build command runs

// ai-plugin.json base-url substitution (same treatment as openapi.json)
const pluginSrc = path.join(root, ".well-known", "ai-plugin.json");
if (fs.existsSync(pluginSrc)) {
  const txt = readTextStrict(pluginSrc).replace(/__BASE_URL__/g, base || origin || "");
  fs.writeFileSync(path.join(outDir, ".well-known", "ai-plugin.json"), txt);
}
```
> Order matters: the Netlify `command` runs prebake *before* functions are bundled, so writing `functions/_lib/booking-config.json` at build time is picked up in the deployed bundle.

### 7.3 `netlify.toml` *(edit)* — routes + CORS-safe headers
- Add the `/mcp` redirect (§6).
- Optionally expose `/api/book` → `/.netlify/functions/submit-order` and `/api/availability` → `/.netlify/functions/check-availability` for cleaner agent-facing URLs.
- The existing `X-Content-Type-Options` header block on `/.netlify/functions/*` is fine; CORS is set per-function in code (needed because `*` must accompany the response, and OPTIONS is handled in-function).

---

## 8. Security, abuse & correctness

- **Public + unauthenticated by design** (guests/agents call it). Existing guards stay: honeypot, 30/IP/15 min, 10 KB cap, field allowlist. Availability adds a natural throttle (capacity per slot).
- **Pending-by-default** means an AI can never *guarantee* a table — it promises a *request*; the owner confirms. This is the safe contract for autonomous agents and matches the owner's choice.
- **Customer notification** doubles as light anti-abuse: if an agent books under someone's email, that person is emailed and can flag it. Phone-only bookings are owner-verified.
- **No secrets in client code.** SMTP creds live only in Netlify env; `submit-order`/`mcp` never expose them.
- **Idempotency (nice-to-have):** accept an optional `client_token`; if seen within N minutes, return the same `id` instead of double-booking (guards against agent retries). Store token→id in Blobs with short TTL.
- **CORS `*`** is acceptable for a public booking POST with no cookies/credentials. Do **not** add `Access-Control-Allow-Credentials`.

---

## 9. Testing & acceptance

**Local (`netlify dev`):**
```bash
# availability
curl "http://localhost:8888/.netlify/functions/check-availability?date=2026-07-10&time=19:00&guests=2"
# book (expect 200 pending_confirmation + id)
curl -X POST "http://localhost:8888/.netlify/functions/submit-order" -H "Content-Type: application/json" \
  -d '{"type":"reservation","customer_name":"Anna","customer_contact":"anna@example.com","date":"2026-07-10","time":"19:00","guests":"2","botcheck":""}'
# out-of-hours (expect 409 unavailable)
curl -X POST … -d '{"type":"reservation","date":"2026-07-10","time":"23:30", …}'
# preflight (expect 204 + ACAO:*)
curl -i -X OPTIONS "http://localhost:8888/.netlify/functions/submit-order"
# MCP
curl -X POST "http://localhost:8888/mcp" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
**Acceptance:**
- JSON-LD (no-JS HTML) contains `ReserveAction` with the POST `EntryPoint` (extend `scripts/verify-crawlable.js` to assert it).
- `/llms.txt` contains the "Booking for AI agents" block; `/openapi.json` has both paths and `__BASE_URL__` substituted; `/.well-known/ai-plugin.json` resolves.
- A booking creates `o/<id>` (status `pending`), increments the slot counter, and (with SMTP set) emails owner + customer.
- The reservation response (`message` + `menu.url`) and the customer email include the optional `#menu` deep-link nudge; it is absent for `type:"order"`.
- Owner `Confirm` flips status to `confirmed` and emails the customer.
- ChatGPT custom GPT with the imported Action completes a booking end-to-end; MCP `tools/call book_table` returns a pending id.

---

## 10. Template / pipeline notes (so every site inherits this)

- All engine edits (`render-core` `ReserveAction`, `bake-core` llms block) are **template-level** — they flow to every derived site; only *values* (`config.booking`, SMTP env, `ai-plugin` contact) are per-site.
- Add to the pipeline hardening plan's gates: `verify-crawlable` asserts `ReserveAction` present; scrub gate asserts `openapi.json`/`ai-plugin.json` have no leftover `__BASE_URL__` and no template contact email; `verify-owner-fields` (proposed there) checks `SMTP_USER`/`SMTP_PASS` presence if notifications are enabled.
- `booking-config.json` is generated, not hand-authored — keep it out of source control (add to `.gitignore`) or commit a default; either way prebake overwrites it.

---

## 11. Phased rollout & effort

1. **Phase 1 (½–1 day):** availability lib + `submit-order` CORS/validation/pending/response + `check-availability`. *Unblocks any HTTP agent immediately.*
2. **Phase 2 (½ day):** `ReserveAction` JSON-LD + llms booking block + OpenAPI enrich + `ai-plugin.json` + `api.html`. *Makes it discoverable + ChatGPT-importable.*
3. **Phase 3–4 (½–1 day):** `nodemailer` notify + owner confirm/decline + admin buttons + env. *Delivers the request→confirm→notify loop.*
4. **Phase 5 (1–2 days, optional):** MCP server for Claude, behind a flag until the transport is validated. *Native Claude booking + proactive offers.*

**Definition of done:** a fresh chat in ChatGPT (with the Action) or Claude (with the MCP connector) can check availability and book a table; the guest is emailed a "request received", the owner confirms in admin, the guest is emailed "confirmed" — all without any browser extension.

---

## 12. Honest limitations

- You cannot make a third-party assistant *proactively* prompt with zero setup: it must have your Action/MCP installed **or** be actively browsing the page and parsing `ReserveAction`. This plan maximises both, but the last mile (installing the connector, or the model choosing to browse) is outside your code.
- The MCP transport spec is still moving; treat Phase 5 as "verify against the current Claude connector spec before shipping."
- Gmail SMTP has a ~500 msg/day cap — ample for a café, but if volume grows, swap `notify.js`'s transport for a free-tier email API later (one-file change).
