"use strict";

/** Overlay a partial content object onto an existing snapshot (never drop arrays by accident). */
function mergePartialContent(existing, incoming) {
  if (!existing) return incoming;
  const out = JSON.parse(JSON.stringify(existing));
  const arrayKeys = ["menuCategories", "menuItems", "gallery", "reviews"];
  const objectKeys = ["config", "translations", "seo", "nav", "visit", "footer", "theme"];

  arrayKeys.forEach(function (key) {
    if (Array.isArray(incoming[key])) out[key] = incoming[key];
  });
  objectKeys.forEach(function (key) {
    if (!incoming[key] || typeof incoming[key] !== "object") return;
    out[key] = { ...(out[key] || {}), ...incoming[key] };
  });
  if (incoming.version != null) out.version = incoming.version;
  if (incoming.updatedAt) out.updatedAt = incoming.updatedAt;
  return out;
}

module.exports = { mergePartialContent };
