"use strict";
/**
 * Adapt a Netlify `exports.handler(event)` function to a Vercel Node request.
 */

function header(req, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v[0] : v;
  }
  return "";
}

function bodyString(req) {
  if (req.body == null) return "";
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

function toEvent(req) {
  const proto = header(req, "x-forwarded-proto") || "https";
  const host = header(req, "host") || process.env.VERCEL_URL || "";
  return {
    httpMethod: req.method,
    headers: Object.assign({}, req.headers, {
      host,
      "x-forwarded-proto": proto,
      "x-forwarded-for": header(req, "x-forwarded-for") || header(req, "x-real-ip") || "unknown",
      cookie: header(req, "cookie"),
    }),
    queryStringParameters: req.query || {},
    body: bodyString(req),
    isBase64Encoded: false,
  };
}

function send(res, result) {
  const headers = result.headers || {};
  Object.keys(headers).forEach((k) => {
    if (headers[k] != null) res.setHeader(k, headers[k]);
  });
  const status = result.statusCode || 200;
  if (result.isBase64Encoded) {
    res.status(status).send(Buffer.from(result.body || "", "base64"));
    return;
  }
  res.status(status).send(result.body == null ? "" : result.body);
}

function wrap(netlifyHandler) {
  return async function handler(req, res) {
    const event = toEvent(req);
    const result = await netlifyHandler(event);
    send(res, result);
  };
}

module.exports = { toEvent, send, wrap };
