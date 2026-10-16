"use strict";
/**
 * Vercel Node function that bakes the home page and crawl files the same way
 * the Netlify edge renderer does.
 */
const path = require("path");
const { pathToFileURL } = require("url");

function originOf(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = req.headers.host || process.env.VERCEL_URL || "localhost";
  return proto + "://" + host;
}

function text(res, body, type, sMaxAge) {
  res.setHeader("content-type", type + "; charset=utf-8");
  res.setHeader("cache-control", "public, s-maxage=" + (sMaxAge || 600) + ", stale-while-revalidate=86400");
  res.status(200).send(body);
}

module.exports = async function handler(req, res) {
  const origin = originOf(req);
  const url = new URL(req.url, origin);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const bake = await import(pathToFileURL(path.join(process.cwd(), "netlify/edge-functions/lib/bake-core.mjs")).href);

  async function loadSeed() {
    const files = ["config", "i18n", "data", "seo", "render-core"];
    const texts = [];
    for (const f of files) {
      const r = await fetch(origin + "/js/" + f + ".js");
      if (!r.ok) throw new Error("seed fetch failed: " + f);
      texts.push({ name: f, text: await r.text() });
    }
    const shim = bake.makeShim();
    bake.evalSeed(shim, texts);
    bake.assertSeedComplete(shim);
    return shim;
  }

  async function loadContent() {
    const shim = await loadSeed();
    let published = null;
    try {
      const bust = url.searchParams.has("_seocheck") ? "?_seocheck=" + Date.now() : "";
      const r = await fetch(origin + "/.netlify/functions/get-content" + bust);
      if (r.ok) published = await r.json();
    } catch (_) { /* seed only */ }
    if (published) {
      if (published.config) bake.deepMerge(shim.SITE_CONFIG, published.config);
      if (published.translations) bake.deepMerge(shim.TRANSLATIONS, published.translations);
      if (published.menuCategories && published.menuCategories.length) shim.MENU_CATEGORIES = published.menuCategories;
      if (published.menuItems && published.menuItems.length) shim.MENU_ITEMS = published.menuItems;
      if (published.gallery && published.gallery.length) shim.GALLERY = published.gallery;
      if (published.reviews && published.reviews.length) shim.REVIEWS = published.reviews;
      if (published.seo) bake.deepMerge(shim.SEO_CONFIG, published.seo);
      if (published.visit && published.visit.address && !shim.SEO_CONFIG.address) {
        shim.SEO_CONFIG.address = published.visit.address;
      }
      if (published.config && published.config.telephoneDisplay) {
        shim.SEO_CONFIG.telephone = published.config.telephoneDisplay;
      }
      shim._published = published;
    }
    return shim;
  }

  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt"
      || pathname === "/llms-full.txt" || pathname === "/.well-known/llms.txt") {
    try {
      const shim = await loadContent();
      const base = bake.effectiveBase(shim, origin);
      const lastmod = (shim._published && shim._published.publishedAt) || null;
      const generatedAt = lastmod || new Date().toISOString();
      if (pathname === "/robots.txt") return text(res, bake.buildRobots(base), "text/plain");
      if (pathname === "/sitemap.xml") {
        return text(res, bake.buildSitemap(base, { homeLastmod: lastmod, pageLastmod: generatedAt }), "application/xml");
      }
      if (pathname === "/llms-full.txt") {
        return text(res, bake.buildLlmsFull(shim, base, lastmod, { generatedAt: generatedAt }), "text/plain");
      }
      return text(res, bake.buildLlms(shim, base, { generatedAt: generatedAt, menuUpdated: lastmod }), "text/plain");
    } catch (_) {
      if (pathname === "/sitemap.xml") return text(res, bake.buildSitemap(origin), "application/xml");
      if (pathname === "/robots.txt") return text(res, bake.buildRobots(origin), "text/plain");
      return text(res, "# Restaurant\n", "text/plain");
    }
  }

  try {
    const shim = await loadContent();
    const page = await fetch(origin + "/index.html");
    const html = bake.bakeHtml(await page.text(), shim, { origin: origin, lang: "en" });
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).send(html);
  } catch (_) {
    const fallback = await fetch(origin + "/index.html");
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(await fallback.text());
  }
};
