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
    } else if (ALLOWED.includes(body.status)) {
      index = index.map((r) => (r.id === body.id ? { ...r, status: body.status } : r));
      const order = await store.get("o/" + body.id, { type: "json" });
      if (order) {
        order.status = body.status;
        await store.setJSON("o/" + body.id, order);
        if (body.status === "confirmed") {
          try { await require("./_lib/notify").sendConfirmation(order); } catch (_) {}
        }
      }
    } else {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Nothing to do." }) };
    }

    await store.setJSON("index", index);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Storage error: " + err.message }) };
  }
};
