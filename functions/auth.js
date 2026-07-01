"use strict";
/**
 * auth — POST to login, GET to check session, DELETE to logout.
 *
 * Env vars required:
 *   ADMIN_PASSWORD   — the shared admin password
 *   SESSION_SECRET   — random string used to sign session JWTs
 */

const crypto  = require("crypto");
const session = require("./_lib/session");

const JSON_HEADERS = { "Content-Type": "application/json" };

exports.handler = async function (event) {
  const method = event.httpMethod;

  /* ── GET: check whether the caller has a valid session ─────────────── */
  if (method === "GET") {
    const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
    const payload = session.verify(token);
    return {
      statusCode: payload ? 200 : 401,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ ok: !!payload }),
    };
  }

  /* ── POST: validate password → issue session cookie ────────────────── */
  if (method === "POST") {
    const ip = (event.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();

    if (!session.checkRateLimit(ip)) {
      return {
        statusCode: 429,
        headers:    JSON_HEADERS,
        body:       JSON.stringify({ error: "Too many attempts. Try again later." }),
      };
    }

    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch (_) { /* ignore */ }

    const { password } = body;
    const stored       = process.env.ADMIN_PASSWORD;

    if (!stored) {
      return {
        statusCode: 500,
        headers:    JSON_HEADERS,
        body:       JSON.stringify({ error: "Server not configured (ADMIN_PASSWORD missing)." }),
      };
    }

    // Constant-time comparison; pad to same length to avoid length oracle
    const padLen  = Math.max((password || "").length, stored.length);
    const aBuf    = Buffer.alloc(padLen);
    const bBuf    = Buffer.alloc(padLen);
    Buffer.from(password || "").copy(aBuf);
    Buffer.from(stored).copy(bBuf);

    const match = crypto.timingSafeEqual(aBuf, bBuf) && (password || "").length === stored.length;

    if (!match) {
      return {
        statusCode: 401,
        headers:    JSON_HEADERS,
        body:       JSON.stringify({ error: "Invalid password." }),
      };
    }

    const token = session.issueToken();
    return {
      statusCode: 200,
      headers:    { ...JSON_HEADERS, "Set-Cookie": session.setCookieHeader(token) },
      body:       JSON.stringify({ ok: true }),
    };
  }

  /* ── DELETE: clear session cookie (logout) ──────────────────────────── */
  if (method === "DELETE") {
    return {
      statusCode: 200,
      headers:    { ...JSON_HEADERS, "Set-Cookie": session.clearCookieHeader() },
      body:       JSON.stringify({ ok: true }),
    };
  }

  return {
    statusCode: 405,
    headers:    JSON_HEADERS,
    body:       JSON.stringify({ error: "Method not allowed." }),
  };
};
