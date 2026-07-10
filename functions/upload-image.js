"use strict";
/**
 * upload-image — validate, store, and return a URL for an uploaded image.
 *
 * POST /.netlify/functions/upload-image  (auth required)
 * Body JSON: { data: "<base64>", type: "image/webp", name: "photo.webp" }
 *
 * Client MUST compress to WebP / JPEG before uploading (≤ 3 MB, ≤ 1600 px).
 * The function is a server-side backstop for the size/type limits.
 *
 * Images are stored in the "media" blob store and served via the
 * get-media function (which adds long-lived CDN cache headers).
 */

const crypto  = require("crypto");
const session = require("./_lib/session");

const JSON_HEADERS   = { "Content-Type": "application/json" };
const ALLOWED_TYPES  = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES      = 3 * 1024 * 1024; // 3 MB

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
  const payload = session.verify(token);
  if (!payload) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { data, type, name } = body;

  if (!type || !ALLOWED_TYPES.has(type)) {
    return {
      statusCode: 400,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ error: "Invalid file type. Allowed: JPEG, PNG, WebP." }),
    };
  }

  if (!data || typeof data !== "string") {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Missing image data." }) };
  }

  let buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch (_) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid base64 data." }) };
  }

  if (buffer.length > MAX_BYTES) {
    return {
      statusCode: 400,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ error: `File too large (max 3 MB). Received ${(buffer.length / 1024 / 1024).toFixed(1)} MB.` }),
    };
  }

  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  const id  = crypto.randomUUID();
  const key = `${id}.${ext}`;

  try {
    const { getStore } = require("./_lib/blobs");
    // Eventual (default) consistency; keys are immutable UUIDs so
    // read-after-write is handled client-side (admin preview retry).
    const store = getStore("media", event);
    await store.set(key, buffer, {
      metadata: { type, originalName: name || key },
    });

    // Relative URL served through the get-media function (CDN-cached after first hit).
    // Relative keeps it portable across localhost / preview / production deploys.
    const url = `/.netlify/functions/get-media?key=${encodeURIComponent(key)}`;

    return {
      statusCode: 200,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ ok: true, url, key }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ error: "Storage error: " + err.message }),
    };
  }
};
