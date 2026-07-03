"use strict";
/**
 * blobs.js — Netlify Blobs wrapper with local filesystem fallback.
 *
 * On Netlify (production or linked `netlify dev`): delegates to @netlify/blobs.
 * Locally without a linked site: stores files under .netlify/blobs-local/<store>/<key>
 * so every function works offline with zero Netlify account setup.
 */

const fs   = require("fs");
const path = require("path");

// NETLIFY_DEV=true is injected by `netlify dev` for local development.
// NETLIFY_BLOBS_CONTEXT is set to the string "undefined" by netlify dev (truthy but invalid),
// so we cannot rely on it alone — use NETLIFY_DEV as the reliable local-dev signal.
// Production Functions run on Lambda (/var/task) where NETLIFY_BLOBS_CONTEXT may be absent;
// detect that runtime and always delegate to @netlify/blobs there.
function useNetlifyBlobs() {
  if (process.env.NETLIFY_DEV === "true") return false;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  return !!process.env.NETLIFY_BLOBS_CONTEXT
    && process.env.NETLIFY_BLOBS_CONTEXT !== "undefined";
}

/* ── Netlify production path ─────────────────────────────────────── */
function netlifyStore(nameOrOpts, event) {
  const blobs = require("@netlify/blobs");
  if (event && blobs.connectLambda) blobs.connectLambda(event);
  return blobs.getStore(nameOrOpts);
}

/* ── Local filesystem path ───────────────────────────────────────── */
// Resolve root relative to the repo root (two levels up from functions/_lib/)
const LOCAL_ROOT = path.resolve(__dirname, "../../.netlify/blobs-local");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function localStore(storeName) {
  const storeDir = path.join(LOCAL_ROOT, storeName);
  ensureDir(storeDir);

  function keyPath(key) {
    // Allow keys with slashes (e.g. "snapshots/2026-06-23T10:00:00.000Z")
    const safe = key.replace(/[<>:"|?*]/g, "_");
    const full  = path.join(storeDir, safe);
    ensureDir(path.dirname(full));
    return full;
  }

  return {
    async get(key, opts) {
      const file = keyPath(key);
      if (!fs.existsSync(file)) return null;
      const buf = fs.readFileSync(file);
      if (opts && opts.type === "json")        return JSON.parse(buf.toString("utf8"));
      if (opts && opts.type === "arrayBuffer") return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      if (opts && opts.type === "text")        return buf.toString("utf8");
      return buf;
    },

    async set(key, value, _opts) {
      const file = keyPath(key);
      const buf  = Buffer.isBuffer(value) ? value : Buffer.from(value);
      fs.writeFileSync(file, buf);
    },

    async setJSON(key, data) {
      const file = keyPath(key);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    },

    async delete(key) {
      const file = keyPath(key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  };
}

/**
 * getStore(nameOrOpts, event)
 * Drop-in replacement for @netlify/blobs getStore().
 * Pass the Lambda `event` in production so connectLambda can configure Blobs.
 */
function getStore(nameOrOpts, event) {
  if (useNetlifyBlobs()) return netlifyStore(nameOrOpts, event);
  const name = typeof nameOrOpts === "string" ? nameOrOpts : nameOrOpts.name;
  return localStore(name);
}

module.exports = { getStore };
