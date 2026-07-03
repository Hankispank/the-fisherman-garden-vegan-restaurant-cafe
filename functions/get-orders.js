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
