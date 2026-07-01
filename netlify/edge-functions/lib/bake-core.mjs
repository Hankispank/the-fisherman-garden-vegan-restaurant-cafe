/*
 * bake-core.mjs — shared bake logic for BOTH the Netlify Edge Function
 * (netlify/edge-functions/render.js, Deno) and the build-time prebake
 * (scripts/prebake.mjs, Node). Pure: no fetch / fs / Deno / Node APIs in
 * here, only data → string transforms, so the two callers can never drift.
 *
 * Injection is marker-based (HTML comments), so baking is idempotent:
 * an already-baked index.html can be re-baked (the edge overlays admin-
 * published content on top of the prebaked static baseline).
 *
 * See Plans/seo-ai-followup-plan.md (P2).
 */

/* ---------- browser shim so the seed window.* files eval outside a browser ---------- */
export function makeShim() {
  const noop = () => {};
  const elStub = () => ({ setAttribute: noop, appendChild: noop, style: {}, classList: { add: noop, remove: noop, toggle: noop } });
  const doc = {
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    documentElement: {}, title: "",
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: elStub,
    head: { querySelector: () => null, appendChild: noop },
    body: {},
  };
  const win = {
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { language: "en" },
    document: doc,
    location: { origin: "", pathname: "/", href: "" },
  };
  win.window = win;
  return win;
}

// texts: [{ name, text }] in load order: config, i18n, data, seo, render-core
export function evalSeed(shim, texts) {
  for (const { text } of texts) {
    const fn = new Function("window", "localStorage", "navigator", "document", "console", text);
    fn(shim, shim.localStorage, shim.navigator, shim.document, console);
  }
}

// Prove the seed evaluated into a COMPLETE set of globals — second net against a
// truncated-but-parseable seed read (the byte-level guard is readTextStrict).
export function assertSeedComplete(shim) {
  const e = [];
  if (!shim.SITE_CONFIG || !shim.SITE_CONFIG.name) e.push("SITE_CONFIG.name");
  if (!Array.isArray(shim.MENU_CATEGORIES) || !shim.MENU_CATEGORIES.length) e.push("MENU_CATEGORIES");
  if (!Array.isArray(shim.MENU_ITEMS) || !shim.MENU_ITEMS.length) e.push("MENU_ITEMS");
  if (!shim.TRANSLATIONS || !shim.TRANSLATIONS.en || !shim.TRANSLATIONS.en["meta.title"]) e.push("TRANSLATIONS.en");
  if (!shim.SEO_CONFIG) e.push("SEO_CONFIG");
  if (!shim.RenderCore || typeof shim.RenderCore.dishCardHTML !== "function" || typeof shim.RenderCore.buildJsonLd !== "function") e.push("RenderCore");
  if (e.length) throw new Error("Seed integrity check failed (possible truncated read): missing/empty " + e.join(", "));
}

export function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (Array.isArray(sv)) target[key] = sv;
    else if (sv && typeof sv === "object" && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) deepMerge(target[key], sv);
    else target[key] = sv;
  }
  return target;
}

export function makeT(shim, lang) {
  const T = shim.TRANSLATIONS || { en: {}, vi: {} };
  return (k) => (T[lang] && T[lang][k] != null ? T[lang][k] : (T.en && T.en[k] != null ? T.en[k] : k));
}

export function effectiveBase(shim, origin) {
  const seo = shim.SEO_CONFIG || {};
  return (seo.baseUrl || origin || "").replace(/\/$/, "");
}

// Share image: explicit ogImage, else first uploaded gallery/menu photo.
export function ogImageFor(shim) {
  const seo = shim.SEO_CONFIG || {};
  if (seo.ogImage) return seo.ogImage;
  const g = (shim.GALLERY || []).find((x) => x.type === "image" && x.url);
  if (g) return g.url;
  const m = (shim.MENU_ITEMS || []).find((x) => x.image);
  if (m) return m.image;
  return "";
}

function absolutize(url, base) {
  if (!url) return "";
  return url.charAt(0) === "/" ? base + url : url;
}

function escAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------- fill data-i18n text + data-fact facts into static HTML ---------- */
// Replace the inner text of every element carrying data-i18n with its translation,
// and fill data-i18n-ph placeholders. Assumes a data-i18n element has no nested
// same-named tag (true for this template; the scrub gate is the backstop).
export function applyI18n(html, T, lang) {
  T = T || {};
  var dict = Object.assign({}, T.en || {}, T[lang] || {});
  html = html.replace(
    /(<([a-zA-Z0-9]+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>)([\s\S]*?)(<\/\2>)/g,
    function (m, open, tag, pre, key, post, inner, close) {
      return dict[key] == null ? m : open + escHtml(dict[key]) + close;
    }
  );
  html = html.replace(/data-i18n-ph="([^"]+)"(\s+placeholder="[^"]*")?/g, function (m, key) {
    return dict[key] == null ? m : 'data-i18n-ph="' + key + '" placeholder="' + escAttr(dict[key]) + '"';
  });
  return html;
}

// Fill data-fact elements (inner text + the relevant href/src) and the favicon
// emoji from SITE_CONFIG, so contact facts/links/logo come from the one source.
export function applyFacts(html, cfg) {
  cfg = cfg || {};
  var text = {
    name: cfg.name,
    address: cfg.address,
    logo: cfg.logo,
    tel: cfg.telephoneDisplay,
    email: cfg.email_public,
  };
  html = html.replace(
    /(<([a-zA-Z0-9]+)([^>]*?)\sdata-fact="([^"]+)"([^>]*)>)([\s\S]*?)(<\/\2>)/g,
    function (m, open, tag, pre, name, post, inner, close) {
      return text[name] == null ? m : open + escHtml(text[name]) + close;
    }
  );
  var digits = cfg.telephoneHref || "";
  html = html.replace(/(<a[^>]*\sdata-fact="tel"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + "tel:+" + escAttr(digits) + b; });
  html = html.replace(/(<a[^>]*\sdata-fact="email"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + "mailto:" + escAttr(cfg.email_public) + b; });
  html = html.replace(/(<a[^>]*\sdata-fact="whatsapp"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + "https://wa.me/" + escAttr(digits) + b; });
  html = html.replace(/(<a[^>]*\sdata-fact="directions"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + escAttr(cfg.directionsHref) + b; });
  html = html.replace(/(<iframe[^>]*\sdata-fact="mapSrc"[^>]*\ssrc=")[^"]*(")/g, function (m, a, b) { return a + escAttr(cfg.mapEmbedSrc) + b; });
  // Favicon emoji (the inline SVG data-URI in <link rel="icon">).
  if (cfg.logo) {
    html = html.replace(/(<text y='\.9em' font-size='90'>)[^<]*(<\/text>)/, function (m, a, b) { return a + cfg.logo + b; });
  }
  return html;
}

/* ---------- bake the home page (marker-based, idempotent) ---------- */
export function bakeHtml(indexHtml, shim, opts) {
  opts = opts || {};
  const origin = opts.origin || "";
  const lang = opts.lang || "en";
  const RC = shim.RenderCore;
  const cfg = shim.SITE_CONFIG || {};
  const currency = cfg.currency || {};
  const t = makeT(shim, lang);
  const ctx = { lang: lang, currency: currency, t: t };

  const cats = shim.MENU_CATEGORIES || [];
  const items = shim.MENU_ITEMS || [];

  const tabsHTML = cats.map((c) => RC.menuTabHTML(c, "popular", lang)).join("");
  const menuHTML = items.map((it) => RC.dishCardHTML(it, ctx)).join(""); // ALL items so crawlers see every dish
  const galleryHTML = (shim.GALLERY || []).map((g) => RC.galleryItemHTML(g, lang)).join("");
  const reviewsHTML = (shim.REVIEWS || []).map((r) => RC.reviewCardHTML(r, lang)).join("");

  const seo = shim.SEO_CONFIG || {};
  const amenitiesHTML = RC.amenitySectionHTML
    ? RC.amenitySectionHTML(seo.amenities, lang, seo.customAmenities)
    : "";
  const base = effectiveBase(shim, origin);
  const ogImg = absolutize(ogImageFor(shim), base);
  const seoForLd = ogImg ? Object.assign({}, seo, { ogImage: ogImg }) : seo;
  const pub = shim._published;

  const graph = RC.buildJsonLd({
    origin: base,
    config: cfg,
    currency: currency,
    menuCategories: cats,
    menuItems: items,
    reviews: shim.REVIEWS,
    seoConfig: seoForLd,
    faq: RC.collectFaq(t),
    description: t("meta.description"),
    address: seo.address || (pub && pub.visit && pub.visit.address),
    telephone: seo.telephone,
    lang: lang,
  });

  // Title + description drive the page title AND all social tags, sourced from
  // the i18n meta keys — so a new restaurant only edits meta.title/meta.description
  // (in js/i18n.js) and the title, og:*, and twitter:* all follow automatically.
  const title = t("meta.title");
  const desc = t("meta.description");

  const canonical = base + "/";
  let head =
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:title" content="' + escAttr(title) + '">' +
    '<meta property="og:description" content="' + escAttr(desc) + '">' +
    '<meta name="twitter:title" content="' + escAttr(title) + '">' +
    '<meta name="twitter:description" content="' + escAttr(desc) + '">';
  if (ogImg) {
    head += '<meta property="og:image" content="' + ogImg + '">' + '<meta name="twitter:image" content="' + ogImg + '">';
  }
  if (pub && pub.theme && Object.prototype.hasOwnProperty.call(pub.theme, "heroUrl")) {
    head += '<style id="admin-theme-hero">.hero__bg{--hero-media:url("' + escAttr(pub.theme.heroUrl || "") + '")}</style>';
  }
  head += '<script type="application/ld+json" id="seo-jsonld">' + JSON.stringify(graph) + "</script>";

  // Function replacers so '$' inside content (e.g. "$" currency) is not
  // treated as a replacement pattern by String.prototype.replace.
  const region = (html, start, end, inner) =>
    html.replace(new RegExp("<!--" + start + "-->[\\s\\S]*?<!--" + end + "-->"), () => "<!--" + start + "-->" + inner + "<!--" + end + "-->");

  let out = indexHtml;
  out = region(out, "TABS_START", "TABS_END", tabsHTML);
  out = region(out, "MENU_START", "MENU_END", menuHTML);
  out = region(out, "GALLERY_START", "GALLERY_END", galleryHTML);
  out = region(out, "REVIEWS_START", "REVIEWS_END", reviewsHTML);
  out = region(out, "AMENITIES_START", "AMENITIES_END", amenitiesHTML);
  out = region(out, "SEO_HEAD_START", "SEO_HEAD_END", head);
  // Bake <title> and <meta description> from the i18n meta keys too, so the
  // no-JS title/description match the language and the restaurant.
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => '<title data-i18n="meta.title">' + escAttr(title) + "</title>");
  out = out.replace(/<meta\s+name="description"[^>]*>/i, () => '<meta name="description" data-i18n="meta.description" content="' + escAttr(desc) + '" />');

  // Fill all data-i18n text + data-fact contact facts/links/logo from the data
  // files, so the crawlable page reflects i18n.js / config.js for every node.
  out = applyI18n(out, shim.TRANSLATIONS, lang);
  out = applyFacts(out, cfg);
  return out;
}

/* ---------- generated crawl files ---------- */
export function buildRobots(base) {
  return [
    "# robots.txt (generated)",
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "",
    "Sitemap: " + base + "/sitemap.xml",
    "",
  ].join("\n");
}

export function buildSitemap(base) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "  <url>\n    <loc>" + base + "/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n" +
    "</urlset>\n"
  );
}

export function buildLlms(shim, base) {
  const cfg = shim.SITE_CONFIG || {};
  const seo = shim.SEO_CONFIG || {};
  const t = makeT(shim, "en");
  const RC = shim.RenderCore;
  const cur = cfg.currency || {};
  const lines = [];
  lines.push("# " + (cfg.name || "Restaurant"));
  lines.push("");
  lines.push("> " + t("meta.description"));
  lines.push("");
  lines.push("## Key facts");
  lines.push("");
  if (seo.servesCuisine && seo.servesCuisine.length) lines.push("- Cuisine: " + seo.servesCuisine.join(", "));
  if (seo.address) lines.push("- Location: " + seo.address);
  if (seo.openingHours && seo.openingHours[0]) lines.push("- Hours: Daily " + seo.openingHours[0].opens + "–" + seo.openingHours[0].closes);
  if (seo.priceRange) lines.push("- Price range: " + seo.priceRange);
  if (seo.telephone) lines.push("- Phone: " + seo.telephone);
  lines.push("- Reservations: Yes");
  if (base) lines.push("- Website: " + base + "/");
  if (seo.sameAs && seo.sameAs.length) {
    lines.push("");
    lines.push("## Profiles");
    lines.push("");
    seo.sameAs.forEach((u) => lines.push("- " + u));
  }
  if (RC && seo.amenities && seo.amenities.length) {
    const rows = RC.amenityRows
      ? RC.amenityRows(seo.amenities, seo.customAmenities)
      : (RC.AMENITIES_CATALOG || []).filter((a) => seo.amenities.indexOf(a.key) !== -1);
    if (rows.length) {
      lines.push("");
      lines.push("## Good to know");
      lines.push("");
      rows.forEach((a) => lines.push("- " + a.en));
    }
  }
  lines.push("");
  lines.push("## Full menu");
  lines.push("");
  for (const m of shim.MENU_ITEMS || []) {
    const name = (m.name && (m.name.en || m.name.vi)) || "";
    const price = RC ? RC.money(m.price, cur, "en") : String(m.price);
    const desc = (m.desc && (m.desc.en || m.desc.vi)) || "";
    lines.push("- " + name + " — " + price + (desc ? " — " + desc : ""));
  }
  lines.push("");
  return lines.join("\n");
}
