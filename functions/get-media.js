"use strict";
/**
 * get-media — serve uploaded images from blob storage with CDN cache headers.
 *
 * GET /.netlify/functions/get-media?key=<uuid.ext>
 *
 * No auth required (images referenced from public content are public).
 * The CDN caches the response for 1 year (images are immutable — they
 * get new UUIDs on re-upload, so cache-busting is automatic).
 */

const ALLOWED_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

exports.handler = async function (event) {
  const key = (event.queryStringParameters || {}).key;

  if (!key || /[\/\\]/.test(key)) {
    return { statusCode: 400, body: "Bad request." };
  }

  const ext = key.split(".").pop().toLowerCase();
  const contentType = ALLOWED_EXT[ext];
  if (!contentType) {
    return { statusCode: 400, body: "Unsupported file type." };
  }

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("media", event);
    const blob  = await store.get(key, { type: "arrayBuffer" });

    if (!blob) {
      return {
        statusCode: 404,
        headers: { "Cache-Control": "no-store" },
        body: "Not found.",
      };
    }

    return {
      statusCode:      200,
      isBase64Encoded: true,
      headers: {
        "Content-Type":  contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: Buffer.from(blob).toString("base64"),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Cache-Control": "no-store" },
      body: "Storage error: " + err.message,
    };
  }
};
