"use strict";
const session = require("./_lib/session");
const HTML = { "Content-Type": "text/html; charset=utf-8" };

const page = (title, msg, extra = "") =>
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<div style="font-family:system-ui;max-width:520px;margin:12vh auto;padding:0 20px;text-align:center">` +
  `<h1 style="font-size:1.4rem">${title}</h1><p style="color:#555">${msg}</p>${extra}</div>`;

function tokenFor(id) {
  const now = Math.floor(Date.now() / 1000);
  return session.sign({ id, kind: "booking-action", iat: now, exp: now + 7 * 24 * 3600 });
}

exports.handler = async function (event) {
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  if (!session.checkRateLimit(ip))
    return { statusCode: 429, headers: HTML, body: page("Too many requests", "Please try again later.") };

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

  if (method === "GET") {
    if (order.status === "confirmed" || order.status === "declined")
      return { statusCode: 200, headers: HTML, body: page(`Already ${order.status}`,
        `${order.customer_name || "Guest"} · ${when} · ${order.guests || "?"} guests.`) };
    const form = (act, label, color) =>
      `<form method="POST" action="/confirm" style="display:inline-block;margin:8px">` +
      `<input type="hidden" name="token" value="${token}"><input type="hidden" name="action" value="${act}">` +
      `<button style="padding:12px 22px;border:0;border-radius:10px;color:#fff;background:${color};font-size:1rem">${label}</button></form>`;
    return { statusCode: 200, headers: HTML, body: page("Confirm this booking?",
      `${order.customer_name || "Guest"} · ${when} · ${order.guests || "?"} guests${order.notes ? " · " + order.notes : ""}`,
      form("confirm", "✓ Confirm", "#1a7f4b") + form("decline", "✕ Decline", "#a23")) };
  }

  if (method === "POST") {
    const action = new URLSearchParams(event.body || "").get("action");
    if (action !== "confirm" && action !== "decline")
      return { statusCode: 400, headers: HTML, body: page("Unknown action", "") };
    const status = action === "confirm" ? "confirmed" : "declined";

    const { setStatus, afterStatusChange } = require("./_lib/orders");
    const { changed } = await setStatus(store, payload.id, status);
    await afterStatusChange(store, order, status, changed);

    return { statusCode: 200, headers: HTML,
      body: page(status === "confirmed" ? "Confirmed ✓" : "Declined",
        `${order.customer_name || "Guest"} · ${when}. ` +
        (status === "confirmed" ? "The guest has been emailed a confirmation." : "The guest has been notified.")) };
  }

  return { statusCode: 405, headers: HTML, body: page("Method not allowed", "") };
};

module.exports.tokenFor = tokenFor;
