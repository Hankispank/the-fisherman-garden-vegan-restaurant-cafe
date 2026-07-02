"use strict";
/**
 * publish — promote draft → published + snapshot the previous version.
 *
 * POST /.netlify/functions/publish  (auth required, no body needed)
 */

const session = require("./_lib/session");

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Overlay a partial draft onto the last published snapshot (never drop menu/gallery by accident). */
function mergeDraftOntoPublished(existing, draft) {
  if (!existing) return draft;
  const out = JSON.parse(JSON.stringify(existing));
  const arrayKeys = ["menuCategories", "menuItems", "gallery", "reviews"];
  const objectKeys = ["config", "translations", "seo", "nav", "visit", "footer", "theme"];

  arrayKeys.forEach(function (key) {
    if (draft[key] && draft[key].length) out[key] = draft[key];
  });
  objectKeys.forEach(function (key) {
    if (!draft[key] || typeof draft[key] !== "object") return;
    out[key] = { ...(out[key] || {}), ...draft[key] };
  });
  if (draft.version != null) out.version = draft.version;
  if (draft.updatedAt) out.updatedAt = draft.updatedAt;
  return out;
}

/**
 * After promoting, fetch the live "/" and run lightweight crawlability
 * assertions. Returns an array of human-readable warnings (never throws).
 * Pragmatic: warn-only, no rollback — the owner sees breakage immediately.
 */
async function seoWarnings(origin, expectedItemCount) {
  const warnings = [];
  try {
    const res = await fetch(origin + "/?_seocheck=" + Date.now());
    const html = await res.text();

    const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!blocks) {
      warnings.push("No JSON-LD found on the live page.");
    } else {
      let data;
      try { data = JSON.parse(blocks[1]); } catch (_) { warnings.push("JSON-LD did not parse on the live page."); }
      if (data) {
        const graph = data["@graph"] || [];
        const menu = graph.find((n) => n["@type"] === "Menu");
        const count = menu ? (menu.hasMenuSection || []).reduce((a, s) => a + (s.hasMenuItem || []).length, 0) : 0;
        if (expectedItemCount != null && count !== expectedItemCount) {
          warnings.push(`Menu item count mismatch: live JSON-LD has ${count}, expected ${expectedItemCount}.`);
        }
      }
    }
    const canonical = (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i) || [])[1];
    if (!canonical || !/^https?:\/\//.test(canonical)) warnings.push("Canonical URL is missing or not absolute (set SEO_CONFIG.baseUrl).");
  } catch (e) {
    warnings.push("Could not verify the live page: " + e.message);
  }
  return warnings;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const token   = session.getTokenFromCookie(event.headers.cookie || event.headers.Cookie || "");
  const payload = session.verify(token);
  if (!payload) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };
  }

  try {
    const { getStore } = require("./_lib/blobs");
    const store = getStore("content", event);

    // Fetch current draft
    const draft = await store.get("draft", { type: "json" });
    if (!draft) {
      return {
        statusCode: 404,
        headers:    JSON_HEADERS,
        body:       JSON.stringify({ error: "No draft to publish." }),
      };
    }

    // Snapshot the existing published version before overwriting
    const existing = await store.get("published", { type: "json" });
    if (existing) {
      const snapKey = `snapshots/${existing.publishedAt || existing.updatedAt || new Date().toISOString()}`;
      await store.setJSON(snapKey, existing);
    }

    // Promote draft → published (merge onto existing so partial drafts stay safe)
    const toPublish = mergeDraftOntoPublished(existing, draft);
    toPublish.publishedAt = new Date().toISOString();
    toPublish.version     = (toPublish.version || 0) + 1;
    await store.setJSON("published", toPublish);

    // Post-publish SEO check (warn-only; surfaced in the admin UI).
    const proto  = event.headers["x-forwarded-proto"] || "https";
    const host   = event.headers.host || event.headers.Host;
    const origin = process.env.URL || (host ? `${proto}://${host}` : "");
    const menuCount = (toPublish.menuItems && toPublish.menuItems.length) || null;
    const warnings = origin ? await seoWarnings(origin, menuCount) : [];

    return {
      statusCode: 200,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ ok: true, version: toPublish.version, publishedAt: toPublish.publishedAt, warnings: warnings }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    JSON_HEADERS,
      body:       JSON.stringify({ error: "Storage error: " + err.message }),
    };
  }
};
