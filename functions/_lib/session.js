"use strict";
/**
 * session.js — JWT signing/verification + cookie helpers + rate limiting.
 *
 * Uses Node's built-in crypto module (no external dependencies).
 * JWT is HMAC-SHA256 signed; stored in an httpOnly Secure cookie.
 */

const crypto = require("crypto");

const SECRET       = process.env.SESSION_SECRET || "dev-secret-please-change-me-in-env";
const COOKIE_NAME  = "gl_admin_session";
const TTL_SECONDS  = 8 * 60 * 60; // 8 hours

/* ---------- base64url ---------- */
function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/* ---------- JWT ---------- */
function sign(payload) {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64url(JSON.stringify(payload));
  const sigBuf  = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sigBuf)}`;
}

function verify(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  let expectedSig;
  try {
    expectedSig = b64url(
      crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest()
    );
  } catch (_) {
    return null;
  }

  // Constant-time comparison (both must be same byte length)
  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(sig.padEnd(expectedSig.length, " "), "utf8");
    expBuf = Buffer.from(expectedSig, "utf8");
  } catch (_) {
    return null;
  }
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function issueToken() {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: "admin", iat: now, exp: now + TTL_SECONDS });
}

/* ---------- cookies ---------- */
function setCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL_SECONDS}; Path=/`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
}

function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const re = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`);
  const m  = cookieHeader.match(re);
  return m ? m[1] : null;
}

/* ---------- rate limiter (in-memory, resets on cold start) ---------- */
const _attempts = new Map(); // ip → { count, resetAt }
const WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const MAX_TRIES  = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  let rec   = _attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + WINDOW_MS };
  }
  rec.count++;
  _attempts.set(ip, rec);
  return rec.count <= MAX_TRIES;
}

module.exports = {
  sign,
  verify,
  issueToken,
  setCookieHeader,
  clearCookieHeader,
  getTokenFromCookie,
  checkRateLimit,
  COOKIE_NAME,
};
