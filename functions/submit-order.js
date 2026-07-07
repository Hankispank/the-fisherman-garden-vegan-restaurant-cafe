"use strict";
/**
 * submit-order — public endpoint for order/reservation submissions.
 * No auth (customers/agents call it). Hardened: method check, size cap, honeypot,
 * field allowlist + length caps, per-IP rate limit, capped index, availability.
 * See plan/ai-agent-booking-implementation-plan.md
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS };

const _hits = new Map();
function allow(ip) {
  const now = Date.now();
  let rec = _hits.get(ip);
  if (!rec || now > rec.resetAt) rec = { count: 0, resetAt: now + 15 * 60 * 1000 };
  rec.count++;
  _hits.set(ip, rec);
  return rec.count <= 30;
}

const FIELDS = {
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
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return resp(405, { error: "Method not allowed." });
  if ((event.body || "").length > 10 * 1024) return resp(413, { error: "Payload too large." });

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  if (!allow(ip)) return resp(429, { error: "Too many requests." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (_) { return resp(400, { error: "Invalid JSON body." }); }

  if (body.botcheck) return resp(200, { success: true, id: "ok" });

  const data = sanitize(body);
  if (data.type !== "order" && data.type !== "reservation")
    return resp(400, { success: false, error: "Invalid type." });
  if (!data.customer_contact)
    return resp(400, { success: false, error: "Missing contact." });

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

    const index = (await store.get("index", { type: "json" })) || [];
    index.unshift({ id, at: record.receivedAt, type: data.type,
                    name: data.customer_name || "", total: data.total || "", status: status });
    const trimmed = index.slice(0, 200);
    for (const dropped of index.slice(200)) {
      try { await store.delete("o/" + dropped.id); } catch (_) { /* best effort */ }
    }
    await store.setJSON("index", trimmed);

    if (data.type === "reservation") {
      try { await require("./_lib/availability").reserveSlot(store, data); } catch (_) {}
    }
    try { await require("./_lib/notify").sendBookingNotifications(record); } catch (_) {}

    const bcfg = require("./_lib/booking-config.json");
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
      menu: data.type === "reservation" && bcfg.menuUrl
        ? { url: bcfg.menuUrl, suggestion: "Browse the menu while you wait — optional, not required to book." }
        : undefined,
    });
  } catch (err) {
    return resp(500, { success: false, error: "Storage error: " + err.message });
  }
};
