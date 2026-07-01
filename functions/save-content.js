"use strict";
/**
 * save-content — write the in-progress draft (auth required).
 *
 * POST /.netlify/functions/save-content
 * Body: the full content JSON (see §5 data shape in the plan)
 */

const session = require("./_lib/session");

const JSON_HEADERS = { "Content-Type": "application/json" };

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
  const payload = session.verify(token);
  if (!payload) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };
  }

  let content;
  try {
    content = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  // Stamp updatedAt
  content.updatedAt = new Date().toISOString();
  if (!content.version) content.version = 0;

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("content");
    await store.setJSON("draft", content);

    return {
      statusCode: 200,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ ok: true, updatedAt: content.updatedAt }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ error: "Storage error: " + err.message }),
    };
  }
};
