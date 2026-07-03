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
    // Prune blobs that fell off the index (requires delete(); see plan §5).
    for (const dropped of index.slice(200)) {
      try { await store.delete("o/" + dropped.id); } catch (_) { /* best effort */ }
    }
    await store.setJSON("index", trimmed);

    return resp(200, { success: true, id });
  } catch (err) {
    return resp(500, { success: false, error: "Storage error: " + err.message });
  }
};
