/*
 * ============================================================
 *  SEO / AI-recommendation layer (GEO / AEO)
 * ------------------------------------------------------------
 *  EDITABLE: window.SEO_CONFIG values below (geo, hours, price
 *            range, cuisine, payments, social profiles, share
 *            image, canonical domain).
 *  LOCKED:   the generator engine at the bottom.
 *
 *  This file builds schema.org JSON-LD (Restaurant, Menu,
 *  Review + aggregateRating, FAQPage, WebSite) from the SAME
 *  live data the site renders (SITE_CONFIG, MENU_*, REVIEWS),
 *  so structured data never drifts from what visitors see and
 *  automatically reflects admin-published content.
 *
 *  It also fills runtime canonical / og:url / og:image tags.
 *  See TEMPLATE.md and Plans/seo-ai-recommendation-plan.md.
 * ============================================================
 */
// Facts below are pulled from js/config.js (the single source of truth) — config
// loads first, so window.SITE_CONFIG exists here. Do NOT re-type address/phone/
// geo/hours; edit them in config.js. Only the SEO-specific extras live here.
var _C = window.SITE_CONFIG || {};
var _DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

window.SEO_CONFIG = {
  // Absolute site URL, no trailing slash. Owner sets this per site.
  // Used for canonical, og:url, JSON-LD url and sitemap. Leave "" to
  // fall back to the current origin at runtime.
  baseUrl: "https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app",

  // Absolute URL to a share/hero image (≥1200×630 ideal). Drives
  // og:image and the Restaurant `image`. Leave "" to skip.
  ogImage: "https://the-fisherman-garden-vegan-restaurant-cafe.netlify.app/assets/research/hero-1440.webp",

  // Google "$"–"$$$$" style affordability band.
  priceRange: "$",

  // Cuisine type(s) the assistant can match on.
  servesCuisine: ["Vegan","Asian fusion","Cafe"],

  // Accepted payment methods (free text).
  acceptedPayments: ["Cash", "Credit Card"],

  // ── pulled from the SSOT (js/config.js) — do not re-type these ──
  geo:       _C.geo,
  address:   _C.address,
  telephone: _C.telephoneDisplay,
  openingHours: (_C.hours || []).map(function (h) {
    return { days: (h.days || []).map(function (d) { return _DAY[d] || d; }), opens: h.opens, closes: h.closes };
  }),

  // Alternate names for entity reconciliation across platforms.
  alternateNames: [
    "The Fisherman",
    "The Fisherman Vegan Restaurant",
    "The Fisherman Vegan Restaurant & Cafe",
  ],

  enableActions: true,

  // Optional override for ReserveAction JSON-LD (blank → submit-order URL at bake time).
  bookingApiUrl: "",

  // Keywords for answer-engine entity matching.
  keywords: "vegan restaurant, plant-based, An Bang Beach, Hoi An",

  // Authoritative external profiles (Google Business, Facebook,
  // Instagram, TripAdvisor, Yelp…). Strongly improves entity trust.
  sameAs: [
    "https://www.tripadvisor.com.vn/Restaurant_Review-g298082-d13861647-Reviews-The_Fisherman_Vegan_Restaurant-Hoi_An_Quang_Nam_Province.html",
    "https://www.google.com/maps/place/The+Fisherman+Vegan+Restaurant/@15.9122433,108.3416928,17z/data=!4m6!3m5!1s0x316f5df313f07615:0x9b489c6dad4a16aa!8m2!3d15.9122433!4d108.3416928",
    "https://www.instagram.com/thefisherman_vegan/",
    "https://www.facebook.com/theFishermanAnBang/?locale=vi_VN",
  ],

  // Amenities the assistant can match on ("family-friendly", "Wi-Fi café",
  // "dog-friendly"…). Keys come from AMENITIES_CATALOG (js/render-core.js);
  // unknown keys are ignored. Only list what is genuinely TRUE for this venue —
  // wrong amenity data harms trust and can violate attribute policy. Editable
  // here or via Admin → ✎ Edit AMENITIES.
  amenities: ["garden","freeWifi","familyFriendly","dogsWelcome"],

  // Owner-added amenities (admin). Each: { id, icon, group, en, vi }.
  // Enable by including id in amenities[] above.
  customAmenities: [],
};

/* ===== LOCKED ENGINE — DO NOT EDIT below this line ===== */
(function () {
  "use strict";

  var seo = window.SEO_CONFIG || {};
  var lang = function () { return window.I18N ? window.I18N.lang : "en"; };
  var origin = function () { return (seo.baseUrl || window.location.origin || "").replace(/\/$/, ""); };

  function text(sel) {
    var el = document.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }

  function pickLang(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj[lang()] || obj.en || "";
  }

  /* ---------- meta tags (canonical / og:url / og:image) ---------- */
  function setMeta(attr, key, value) {
    if (!value) return;
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  }

  function setLink(rel, href) {
    if (!href) return;
    var el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function applyMeta() {
    var url = origin() + window.location.pathname;
    var t = window.I18N ? window.I18N.t : function (k) { return k; };
    document.title = t("meta.title");
    setLink("canonical", url);
    setMeta("property", "og:url", url);
    // og/twitter title + description follow the i18n meta keys (and language).
    setMeta("property", "og:title", t("meta.title"));
    setMeta("property", "og:description", t("meta.description"));
    setMeta("name", "twitter:title", t("meta.title"));
    setMeta("name", "twitter:description", t("meta.description"));
    if (seo.ogImage) {
      setMeta("property", "og:image", seo.ogImage);
      setMeta("name", "twitter:image", seo.ogImage);
    }
  }

  /* ---------- JSON-LD graph (delegated to the shared render-core) ---------- */
  function buildGraph() {
    var cfg = window.SITE_CONFIG || {};
    var t = window.I18N ? window.I18N.t : function (k) { return k; };
    var visit = window._CONTENT_VISIT || {};
    var footer = window._CONTENT_FOOTER || {};
    var address = seo.address || text(".visit__list li:first-child span");
    var telephone = seo.telephone ||
      ((document.querySelector('.visit__list a[href^="tel:"]') || {}).textContent || "").trim();
    return window.RenderCore.buildJsonLd({
      origin: origin(),
      config: cfg,
      currency: cfg.currency,
      menuCategories: window.MENU_CATEGORIES,
      menuItems: window.MENU_ITEMS,
      reviews: window.REVIEWS,
      seoConfig: seo,
      faq: window.RenderCore.collectFaq(t),
      description: t("meta.description"),
      address: address,
      telephone: telephone,
      lang: lang(),
      emailVisible: visit.showEmail === true || footer.showEmail === true,
    });
  }

  function injectJsonLd() {
    var existing = document.getElementById("seo-jsonld");
    if (existing) existing.remove();
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "seo-jsonld";
    script.textContent = JSON.stringify(buildGraph());
    document.head.appendChild(script);
  }

  /* ---------- grouped amenities section (mirrors the baked markers) ---------- */
  function renderAmenities() {
    var host = document.getElementById("amenitiesBody");
    if (!host || !window.RenderCore || !window.RenderCore.amenitySectionHTML) return;
    host.innerHTML = window.RenderCore.amenitySectionHTML(seo.amenities || [], lang(), seo.customAmenities || []);
    var sec = document.getElementById("amenities");
    if (sec) sec.style.display = host.textContent.trim() ? "" : "none"; // hide if none enabled
  }
  // Exposed so the admin live preview can refresh the section on toggle.
  window.renderAmenities = renderAmenities;

  function renderSocial() {
    var host = document.getElementById("footerSocial");
    if (!host || !window.RenderCore || !window.RenderCore.socialLinksHTML) return;
    host.innerHTML = window.RenderCore.socialLinksHTML((window.SEO_CONFIG || {}).sameAs || []);
    host.style.display = host.firstChild ? "" : "none";
  }
  window.renderSocial = renderSocial;

  function run() {
    try { applyMeta(); } catch (e) { /* non-fatal */ }
    try { injectJsonLd(); } catch (e) { /* non-fatal */ }
    try { renderAmenities(); } catch (e) { /* non-fatal */ }
    try { renderSocial(); } catch (e) { /* non-fatal */ }
  }

  // Build after content-loader has merged published content and app.js
  // has rendered. Rebuild on language change so JSON-LD matches the
  // currently displayed language.
  document.addEventListener("DOMContentLoaded", run);
  document.addEventListener("languagechange", run);
})();
