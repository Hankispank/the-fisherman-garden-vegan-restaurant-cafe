"use strict";
/**
 * get-content — serve published content (public) or draft (auth required).
 *
 * GET /.netlify/functions/get-content          → published.json (CDN-cacheable)
 * GET /.netlify/functions/get-content?draft=1  → draft.json (auth required)
 */

const session = require("./_lib/session");

const JSON_HEADERS = {
  "Content-Type":           "application/json",
  "Cache-Control":          "public, s-maxage=60, stale-while-revalidate=300",
};

exports.handler = async function (event) {
  const isDraft = event.queryStringParameters && event.queryStringParameters.draft === "1";

  // Draft access requires a valid session
  if (isDraft) {
    const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
    const payload = session.verify(token);
    if (!payload) {
      return {
        statusCode: 401,
        headers:    { "Content-Type": "application/json" },
        body:       JSON.stringify({ error: "Unauthorized." }),
      };
    }
  }

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("content", event);
    const key   = isDraft ? "draft" : "published";
    const data  = await store.get(key, { type: "json" });

    if (!data) {
      return {
        statusCode: 404,
        headers:    { "Content-Type": "application/json" },
        body:       JSON.stringify({ error: "No content found." }),
      };
    }

    return {
      statusCode: 200,
      headers:    isDraft ? { "Content-Type": "application/json" } : JSON_HEADERS,
      body:       JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    { "Content-Type": "application/json" },
      body:       JSON.stringify({ error: "Storage error: " + err.message }),
    };
  }
};
