/*
 * verify-crawlable.js — WS-E acceptance test (JS-disabled crawl check).
 *
 * Fetches the raw served HTML (no JavaScript executed) and asserts that the
 * SEO/AI requirements hold:
 *   - every menu item name, price, and description is present in the HTML,
 *   - exactly one valid application/ld+json block exists, containing a Menu
 *     with the full item count, Offer prices, and an aggregateRating,
 *   - canonical and og:url are absolute URLs.
 *
 * Usage:  node scripts/verify-crawlable.js [url]
 *         node scripts/verify-crawlable.js --file index.html   (check a local baked file)
 * Default url: http://localhost:8888/
 * Exit code 0 = pass, 1 = fail (suitable as a build/publish/CI gate).
 */

const argv = process.argv.slice(2);
const fileIdx = argv.indexOf("--file");
const FILE_ARG = fileIdx !== -1 ? argv[fileIdx + 1] : null;
const URL_ARG = (!FILE_ARG && argv[0] && !argv[0].startsWith("--")) ? argv[0] : "http://localhost:8888/";

/* Load the full seed (config, i18n, data, seo, render-core) via the baker's
 * shim, so the expected values come from the single source of truth. */
const fs = require("fs");
const path = require("path");
const { readTextStrict } = require("./lib/safe-read.cjs");

async function loadSeed() {
  // Load the FULL seed (config, i18n, data, seo, render-core) through the same
  // shim the baker uses, so expected menu values AND SEO_CONFIG.amenities +
  // RenderCore (catalog/groups) all come from the single source of truth.
  const root = path.resolve(__dirname, "..");
  const { makeShim, evalSeed, assertSeedComplete } = await import("../netlify/edge-functions/lib/bake-core.mjs");
  const files = ["config", "i18n", "data", "seo", "render-core"];
  const texts = files.map((f) => ({ name: f, text: readTextStrict(path.join(root, "js", f + ".js")) }));
  const shim = makeShim();
  evalSeed(shim, texts);
  assertSeedComplete(shim);
  return shim;
}

function money(n, c, lang) {
  c = c || {};
  const num = Number(n).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    minimumFractionDigits: c.decimals || 0,
    maximumFractionDigits: c.decimals || 0,
  });
  return c.position === "before" ? c.symbol + num : num + " " + c.symbol;
}

async function main() {
  const seed = await loadSeed();
  const items = seed.MENU_ITEMS || [];
  const currency = (seed.SITE_CONFIG || {}).currency || {};

  const target = FILE_ARG ? FILE_ARG : URL_ARG;
  let html;
  if (FILE_ARG) {
    try {
      html = readTextStrict(path.resolve(process.cwd(), FILE_ARG)); // fail closed on a truncated baked file
    } catch (e) {
      console.error(`\n❌ verify-crawlable FAILED for ${FILE_ARG}\n  - UNREADABLE/INCOMPLETE — ${e.message}\n`);
      process.exit(1);
    }
  } else {
    const res = await fetch(URL_ARG);
    html = await res.text();
  }

  const failures = [];
  let restaurant = null; // captured from JSON-LD for the amenity checks below

  // 1. Every dish: name + price + description present in raw HTML.
  for (const it of items) {
    const name = it.name.en;
    const desc = it.desc.en;
    const price = money(it.price, currency, "en");
    if (!html.includes(name)) failures.push(`menu name missing: "${name}"`);
    if (!html.includes(desc)) failures.push(`menu description missing for: "${name}"`);
    if (!html.includes(price)) failures.push(`menu price missing for "${name}": expected "${price}"`);
  }

  // 2. Exactly one JSON-LD block, valid, with full Menu + aggregateRating.
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length !== 1) {
    failures.push(`expected exactly 1 application/ld+json block, found ${blocks.length}`);
  } else {
    let data;
    try {
      data = JSON.parse(blocks[0][1]);
    } catch (e) {
      failures.push("JSON-LD did not parse: " + e.message);
    }
    if (data) {
      const graph = data["@graph"] || [];
      const menu = graph.find((n) => n["@type"] === "Menu");
      restaurant = graph.find((n) => n["@type"] === "Restaurant");
      const ldItemCount = menu ? (menu.hasMenuSection || []).reduce((a, s) => a + (s.hasMenuItem || []).length, 0) : 0;
      if (!menu) failures.push("JSON-LD: no Menu node");
      if (ldItemCount !== items.length) failures.push(`JSON-LD menu item count ${ldItemCount} != live ${items.length}`);
      if (!restaurant || !restaurant.aggregateRating) failures.push("JSON-LD: missing aggregateRating");
      // spot-check an Offer price exists
      const firstWithPrice = menu && (menu.hasMenuSection || []).some((s) => (s.hasMenuItem || []).some((m) => m.offers && m.offers.price));
      if (!firstWithPrice) failures.push("JSON-LD: MenuItems missing Offer price");
    }
  }

  // 3. canonical + og:url absolute.
  const canonical = (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i) || [])[1];
  const ogUrl = (html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i) || [])[1];
  if (!canonical || !/^https?:\/\//.test(canonical)) failures.push(`canonical not absolute: ${canonical || "(missing)"}`);
  if (!ogUrl || !/^https?:\/\//.test(ogUrl)) failures.push(`og:url not absolute: ${ogUrl || "(missing)"}`);

  // 4. No literal "undefined" in baked HTML (hours/llms regression tripwire).
  if (html.includes("undefined")) failures.push('HTML contains literal string "undefined"');

  // 5. Opening hours shape in JSON-LD.
  if (restaurant && restaurant.openingHoursSpecification) {
    for (const spec of restaurant.openingHoursSpecification) {
      if (!spec.dayOfWeek || !spec.dayOfWeek.length) {
        failures.push("JSON-LD: openingHoursSpecification has empty dayOfWeek");
      }
      if (!/^\d{2}:\d{2}$/.test(spec.opens || "")) {
        failures.push(`JSON-LD: openingHoursSpecification opens invalid: ${spec.opens || "(missing)"}`);
      }
      if (!/^\d{2}:\d{2}$/.test(spec.closes || "")) {
        failures.push(`JSON-LD: openingHoursSpecification closes invalid: ${spec.closes || "(missing)"}`);
      }
    }
  } else if (restaurant) {
    failures.push("JSON-LD: Restaurant missing openingHoursSpecification");
  }

  // 6. Self-sabotaging review text tripwire.
  if (restaurant && restaurant.review) {
    for (const rev of restaurant.review) {
      const body = rev.reviewBody || "";
      if (/closed (the )?(business|down|permanently)/i.test(body)) {
        failures.push(`JSON-LD: reviewBody contains closed-business language: "${body.slice(0, 80)}…"`);
      }
    }
  }

  // 7. llms.txt checks when verifying a local baked file.
  if (FILE_ARG) {
    const llmsPath = path.resolve(path.dirname(path.resolve(process.cwd(), FILE_ARG)), "llms.txt");
    if (fs.existsSync(llmsPath)) {
      const llms = fs.readFileSync(llmsPath, "utf8");
      if (llms.includes("undefined")) failures.push('llms.txt contains literal string "undefined"');
      if (!/- Hours: Daily \d{2}:\d{2}–\d{2}:\d{2}/.test(llms)) {
        failures.push("llms.txt: missing valid daily hours line");
      }
      if (!/## FAQ/.test(llms)) failures.push("llms.txt: missing FAQ section");
    }
  }

  // 8. Amenities: each enabled label + its group title in raw HTML, and the
  // JSON-LD amenityFeature count + petsAllowed match the enabled list.
  const RC = seed.RenderCore || {};
  const enabledKeys = (seed.SEO_CONFIG && seed.SEO_CONFIG.amenities) || [];
  const catalog = RC.AMENITIES_CATALOG || [];
  const enabledRows = catalog.filter((a) => enabledKeys.indexOf(a.key) !== -1);
  if (enabledRows.length) {
    for (const a of enabledRows) {
      if (!html.includes(a.en)) failures.push(`amenity label missing from HTML: "${a.en}"`);
    }
    for (const g of RC.AMENITY_GROUPS || []) {
      if (enabledRows.some((a) => a.group === g.id) && !html.includes(g.en)) {
        failures.push(`amenity group title missing from HTML: "${g.en}"`);
      }
    }
    if (restaurant) {
      const af = restaurant.amenityFeature || [];
      if (af.length !== enabledRows.length) failures.push(`JSON-LD amenityFeature count ${af.length} != enabled ${enabledRows.length}`);
      const dogsEnabled = enabledKeys.indexOf("dogsWelcome") !== -1;
      if (dogsEnabled && restaurant.petsAllowed !== true) failures.push("JSON-LD petsAllowed should be true (dogsWelcome enabled)");
      if (!dogsEnabled && restaurant.petsAllowed === true) failures.push("JSON-LD petsAllowed should be absent (dogsWelcome not enabled)");
    }
  }

  // ---- report ----
  if (failures.length) {
    console.error(`\n❌ verify-crawlable FAILED (${failures.length}) for ${target}\n`);
    failures.forEach((f) => console.error("  - " + f));
    console.error("");
    process.exit(1);
  }
  console.log(`\n✅ verify-crawlable PASSED for ${target}`);
  console.log(`   ${items.length} dishes (name + price + description) in raw HTML`);
  console.log(`   1 valid JSON-LD graph with full Menu + aggregateRating`);
  console.log(`   canonical + og:url absolute`);
  console.log(`   ${enabledRows.length} amenities (labels + group titles in HTML, amenityFeature in JSON-LD)\n`);
}

main().catch((e) => {
  console.error("verify-crawlable error: " + e.message);
  process.exit(1);
});
