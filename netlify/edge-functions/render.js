/*
 * render.js — Netlify Edge Function (Deno).
 *
 * Server-side bakes the home page so AI crawlers that do NOT run JavaScript
 * still receive the full menu, reviews, gallery, and inline JSON-LD before
 * any JS. Reuses the shared, isomorphic bake logic in ./lib/bake-core.mjs
 * (also used by scripts/prebake.mjs) so the static baseline, the edge
 * overlay, and the browser never drift.
 *
 * See Plans/seo-ai-remediation-plan.md and Plans/seo-ai-followup-plan.md.
 */
import {
  makeShim, evalSeed, assertSeedComplete, deepMerge, effectiveBase,
  bakeHtml, buildRobots, buildSitemap, buildLlms, buildLlmsFull,
} from "./lib/bake-core.mjs";

async function loadSeed(origin) {
  const files = ["config", "i18n", "data", "seo", "render-core"];
  const texts = [];
  for (const f of files) {
    const res = await fetch(origin + "/js/" + f + ".js");
    if (!res.ok) throw new Error("seed fetch failed: " + f);
    texts.push({ name: f, text: await res.text() });
  }
  const shim = makeShim();
  evalSeed(shim, texts);
  assertSeedComplete(shim); // fail closed on a partial/incomplete seed fetch
  return shim;
}

async function loadContent(origin) {
  const shim = await loadSeed(origin);
  // Merge admin-published content (if any) over the seed defaults.
  let published = null;
  try {
    const r = await fetch(origin + "/.netlify/functions/get-content");
    if (r.ok) published = await r.json();
  } catch (_) { /* no published content yet → seed only */ }

  if (published) {
    if (published.config) deepMerge(shim.SITE_CONFIG, published.config);
    if (published.translations) deepMerge(shim.TRANSLATIONS, published.translations);
    if (published.menuCategories && published.menuCategories.length) shim.MENU_CATEGORIES = published.menuCategories;
    if (published.menuItems && published.menuItems.length) shim.MENU_ITEMS = published.menuItems;
    if (published.gallery && published.gallery.length) shim.GALLERY = published.gallery;
    if (published.reviews && published.reviews.length) shim.REVIEWS = published.reviews;
    // P1: apply admin-edited SEO/social fields + auto-fill schema address.
    if (published.seo) deepMerge(shim.SEO_CONFIG, published.seo);
    if (published.visit && published.visit.address && !shim.SEO_CONFIG.address) {
      shim.SEO_CONFIG.address = published.visit.address;
    }
    // Sync schema telephone from published contact config when set in admin.
    if (published.config && published.config.telephoneDisplay) {
      shim.SEO_CONFIG.telephone = published.config.telephoneDisplay;
    }
    shim._published = published;
  }
  return shim;
}

function textResponse(body, type, sMaxAge) {
  return new Response(body, {
    headers: { "content-type": type + "; charset=utf-8", "cache-control": "public, s-maxage=" + (sMaxAge || 600) + ", stale-while-revalidate=86400" },
  });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Generated crawl files (reflect admin-published SEO, e.g. baseUrl + profiles).
  if (path === "/robots.txt" || path === "/sitemap.xml" || path === "/llms.txt"
      || path === "/llms-full.txt" || path === "/.well-known/llms.txt") {
    try {
      const shim = await loadContent(origin);
      const base = effectiveBase(shim, origin);
      const lastmod = (shim._published && shim._published.publishedAt) || null;
      const generatedAt = lastmod || new Date().toISOString();
      if (path === "/robots.txt") return textResponse(buildRobots(base), "text/plain");
      if (path === "/sitemap.xml") {
        return textResponse(buildSitemap(base, { homeLastmod: lastmod, pageLastmod: generatedAt }), "application/xml");
      }
      if (path === "/llms-full.txt") {
        return textResponse(buildLlmsFull(shim, base, lastmod, { generatedAt: generatedAt }), "text/plain");
      }
      if (path === "/.well-known/llms.txt") {
        return textResponse(buildLlms(shim, base, { generatedAt: generatedAt, menuUpdated: lastmod }), "text/plain");
      }
      return textResponse(buildLlms(shim, base, { generatedAt: generatedAt, menuUpdated: lastmod }), "text/plain");
    } catch (_) {
      if (path === "/sitemap.xml") return textResponse(buildSitemap(origin), "application/xml");
      if (path === "/robots.txt") return textResponse(buildRobots(origin), "text/plain");
      return textResponse("# Restaurant\n", "text/plain");
    }
  }

  // Home page: bake content + JSON-LD into the served HTML.
  try {
    const shim = await loadContent(origin);
    const res = await fetch(origin + "/index.html");
    const indexHtml = await res.text();
    const html = bakeHtml(indexHtml, shim, { origin: origin, lang: "en" });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (_) {
    // Never hard-fail: fall through to the (prebaked) static page so humans
    // and crawlers still get the full menu + JSON-LD baseline.
    const fallback = await fetch(origin + "/index.html");
    return new Response(await fallback.text(), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}
