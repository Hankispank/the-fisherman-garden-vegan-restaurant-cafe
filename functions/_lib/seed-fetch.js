"use strict";

const vm = require("vm");

async function fetchJsModule(origin, filename) {
  const base = String(origin || "").replace(/\/$/, "");
  const res = await fetch(base + "/js/" + filename);
  if (!res.ok) throw new Error("seed fetch failed: " + filename);
  return res.text();
}

function evalWindowScript(text) {
  const ctx = { window: {} };
  vm.runInNewContext(text, ctx);
  return ctx.window;
}

async function fetchSeedArrays(origin) {
  const win = evalWindowScript(await fetchJsModule(origin, "data.js"));
  return {
    menuCategories: win.MENU_CATEGORIES || [],
    menuItems:      win.MENU_ITEMS || [],
    gallery:        win.GALLERY || [],
    reviews:        win.REVIEWS || [],
  };
}

async function fetchSeedTranslations(origin) {
  const win = evalWindowScript(await fetchJsModule(origin, "i18n.js"));
  return win.TRANSLATIONS || null;
}

/** Fill missing menu/gallery/review arrays from the deployed seed files. */
function backfillMissingArrays(target, seed) {
  if (!target || !seed) return target;
  ["menuCategories", "menuItems", "gallery", "reviews"].forEach(function (key) {
    if (!target[key] || !target[key].length) {
      if (seed[key] && seed[key].length) target[key] = seed[key];
    }
  });
  return target;
}

module.exports = {
  fetchSeedArrays,
  fetchSeedTranslations,
  backfillMissingArrays,
};
