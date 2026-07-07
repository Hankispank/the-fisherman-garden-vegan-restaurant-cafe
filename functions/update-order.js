"use strict";
/** update-order — POST { id, status } or { id, delete: true } (auth required). */
const session = require("./_lib/session");
const JSON_HEADERS = { "Content-Type": "application/json" };

const ALLOWED = ["handled", "new", "pending", "confirmed", "declined"];

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
      await store.setJSON("index", index);
    } else if (ALLOWED.includes(body.status)) {
      const { setStatus, afterStatusChange } = require("./_lib/orders");
      const { order, changed } = await setStatus(store, body.id, body.status);
      if (order) await afterStatusChange(store, order, body.status, changed);
    } else {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Nothing to do." }) };
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Storage error: " + err.message }) };
  }
};
