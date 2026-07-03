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
    shortName: cfg.shortName || cfg.name,
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
  html = html.replace(/(<a[^>]*\sdata-fact="zalo"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + "https://zalo.me/" + escAttr(cfg.zalo || digits) + b; });
  html = html.replace(/(<a[^>]*\sdata-fact="directions"[^>]*\shref=")[^"]*(")/g, function (m, a, b) { return a + escAttr(cfg.directionsHref) + b; });
  html = html.replace(/(<iframe[^>]*\sdata-fact="mapSrc"[^>]*\ssrc=")[^"]*(")/g, function (m, a, b) { return a + escAttr(cfg.mapEmbedSrc) + b; });
  // Favicon emoji (the inline SVG data-URI in <link rel="icon">).
  if (cfg.logo) {
    html = html.replace(/(<text y='\.9em' font-size='90'>)[^<]*(<\/text>)/, function (m, a, b) { return a + cfg.logo + b; });
  }
  return html;
}

function emailVisibleFromPublished(pub) {
  if (!pub) return false;
  var v = pub.visit || {}, f = pub.footer || {};
  return v.showEmail === true || f.showEmail === true;
}

export function applyContactVisibility(html, pub) {
  const v = (pub && pub.visit) || {}, f = (pub && pub.footer) || {};
  const hide = [];
  if (v.showEmail !== true) hide.push(["visit", "email"]);
  if (f.showEmail !== true) hide.push(["footer", "email"]);
  if (v.showPhone === false) hide.push(["visit", "phone"]);
  if (f.showPhone === false) hide.push(["footer", "phone"]);
  for (const [area, kind] of hide) {
    html = html.replace(new RegExp(
      '<(li|a)([^>]*data-area="' + area + '"[^>]*data-contact="' + kind + '"[^>]*)>[\\s\\S]*?<\\/\\1>', "g"), "");
  }
  if (v.showZalo === false) {
    html = html.replace(/<a[^>]*data-area="visit"[^>]*data-chat="zalo"[^>]*>[\s\S]*?<\/a>/g, "");
  }
  if (v.showWhatsapp === false) {
    html = html.replace(/<a[^>]*data-area="visit"[^>]*data-chat="whatsapp"[^>]*>[\s\S]*?<\/a>/g, "");
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
  const socialHTML = RC.socialLinksHTML ? RC.socialLinksHTML(seo.sameAs) : "";
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
    emailVisible: emailVisibleFromPublished(pub),
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
  out = region(out, "SOCIAL_START", "SOCIAL_END", socialHTML);
  out = region(out, "SEO_HEAD_START", "SEO_HEAD_END", head);
  // Bake <title> and <meta description> from the i18n meta keys too, so the
  // no-JS title/description match the language and the restaurant.
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => "<title>" + escAttr(title) + "</title>");
  out = out.replace(/<meta\s+name="description"[^>]*>/i, () => '<meta name="description" content="' + escAttr(desc) + '" data-i18n="meta.description" />');

  // Fill all data-i18n text + data-fact contact facts/links/logo from the data
  // files, so the crawlable page reflects i18n.js / config.js for every node.
  out = applyI18n(out, shim.TRANSLATIONS, lang);
  out = applyFacts(out, cfg);
  out = applyContactVisibility(out, pub);
  return out;
}

/* ---------- generated crawl files ---------- */
export function llmsKeyFacts(shim, base, opts) {
  opts = opts || {};
  const cfg = shim.SITE_CONFIG || {};
  const seo = shim.SEO_CONFIG || {};
  const cur = cfg.currency || {};
  const lines = [];
  if (seo.servesCuisine && seo.servesCuisine.length) lines.push("- Cuisine: " + seo.servesCuisine.join(", "));
  if (seo.address) lines.push("- Location: " + seo.address);
  const oh = (seo.openingHours || []).filter(function (h) { return h.opens && h.closes; });
  if (oh.length === 1 && (oh[0].days || []).length === 7) {
    lines.push("- Hours: Daily " + oh[0].opens + "–" + oh[0].closes);
  } else {
    oh.forEach(function (h) {
      lines.push("- Hours: " + (h.days || []).join(", ") + " " + h.opens + "–" + h.closes);
    });
  }
  if (seo.priceRange) lines.push("- Price range: " + seo.priceRange);
  lines.push("- Pricing: all menu prices in " + (cur.code || "VND") + ", tax included; most mains 60,000–140,000 " + (cur.symbol || "₫"));
  if (seo.telephone) lines.push("- Phone: " + seo.telephone);
  lines.push("- Reservations: " + (cfg.whatsapp || cfg.email ? "Yes" : "Contact venue"));
  if (emailVisibleFromPublished(shim._published) && (cfg.email_public || cfg.email)) {
    lines.push("- Email: " + (cfg.email_public || cfg.email));
  }
  if (cfg.whatsapp) lines.push("- WhatsApp: +" + cfg.whatsapp);
  lines.push("- Order/booking: WhatsApp, Zalo, email, or on-page form");
  if (base) {
    lines.push("- Website: " + base + "/");
    lines.push("- Pages: " + base + "/about · " + base + "/contact · " + base + "/privacy · " + base + "/terms");
    lines.push("- Programmatic booking: " + base + "/api (OpenAPI: " + base + "/openapi.json)");
  }
  const updated = opts.menuUpdated || (shim._published && shim._published.publishedAt);
  if (updated) lines.push("- Menu last updated: " + String(updated).slice(0, 10));
  return lines;
}

export function buildRobots(base) {
  return [
    "# robots.txt (generated)",
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "",
    "# AI agents: structured summary at /llms.txt",
    "# llms: " + base + "/llms.txt · llms-full: " + base + "/llms-full.txt",
    "",
    "Sitemap: " + base + "/sitemap.xml",
    "",
  ].join("\n");
}

export function buildSitemap(base, opts) {
  opts = opts || {};
  const homeLastmod = (opts.homeLastmod || opts.lastmod || "").slice(0, 10);
  const pageLastmod = (opts.pageLastmod || opts.lastmod || "").slice(0, 10);
  const paths = [
    { loc: base + "/", changefreq: "weekly", priority: "1.0", lastmod: homeLastmod },
    { loc: base + "/about", changefreq: "monthly", priority: "0.8", lastmod: pageLastmod },
    { loc: base + "/contact", changefreq: "monthly", priority: "0.8", lastmod: pageLastmod },
    { loc: base + "/privacy", changefreq: "yearly", priority: "0.5", lastmod: pageLastmod },
    { loc: base + "/terms", changefreq: "yearly", priority: "0.5", lastmod: pageLastmod },
    { loc: base + "/api", changefreq: "monthly", priority: "0.6", lastmod: pageLastmod },
  ];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const p of paths) {
    xml += "  <url>\n    <loc>" + p.loc + "</loc>\n";
    if (p.lastmod) xml += "    <lastmod>" + p.lastmod + "</lastmod>\n";
    xml += "    <changefreq>" + p.changefreq + "</changefreq>\n    <priority>" + p.priority + "</priority>\n  </url>\n";
  }
  return xml + "</urlset>\n";
}

export function buildLlms(shim, base, opts) {
  opts = opts || {};
  const cfg = shim.SITE_CONFIG || {};
  const seo = shim.SEO_CONFIG || {};
  const t = makeT(shim, "en");
  const RC = shim.RenderCore;
  const cur = cfg.currency || {};
  const menuUpdated = opts.menuUpdated || opts.generatedAt || (shim._published && shim._published.publishedAt);
  const lines = [];
  lines.push("# " + (cfg.name || "Restaurant"));
  lines.push("");
  lines.push("> " + t("meta.description"));
  lines.push("");
  lines.push("## Key facts");
  lines.push("");
  lines.push(...llmsKeyFacts(shim, base, { menuUpdated: menuUpdated }));
  if (seo.sameAs && seo.sameAs.length) {
    lines.push("");
    lines.push("## Profiles");
    lines.push("");
    seo.sameAs.forEach(function (u) { lines.push("- " + u); });
  }
  if (RC && seo.amenities && seo.amenities.length) {
    const rows = RC.amenityRows
      ? RC.amenityRows(seo.amenities, seo.customAmenities)
      : (RC.AMENITIES_CATALOG || []).filter(function (a) { return seo.amenities.indexOf(a.key) !== -1; });
    if (rows.length) {
      lines.push("");
      lines.push("## Good to know");
      lines.push("");
      rows.forEach(function (a) { lines.push("- " + a.en); });
    }
  }
  const faq = RC && RC.collectFaq ? RC.collectFaq(t) : [];
  if (faq.length) {
    lines.push("");
    lines.push("## FAQ");
    lines.push("");
    faq.forEach(function (qa) { lines.push("- **" + qa.q + "** — " + qa.a); });
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
  if (opts.generatedAt) lines.push("_Generated: " + opts.generatedAt + "_");
  lines.push("");
  return lines.join("\n");
}

export function buildLlmsFull(shim, base, publishedAt, opts) {
  opts = opts || {};
  const t = makeT(shim, "en");
  const cfg = shim.SITE_CONFIG || {};
  const RC = shim.RenderCore;
  const cur = cfg.currency || {};
  const L = [];
  L.push("# " + cfg.name, "", "> " + t("meta.description"), "");
  L.push("## About", "", t("about.p1"), "", t("about.p2"), "", t("about.p3"), "");
  L.push("## Key facts", "");
  L.push(...llmsKeyFacts(shim, base, { menuUpdated: publishedAt }));
  L.push("", "## Frequently asked questions", "");
  for (const qa of RC.collectFaq(t)) L.push("### " + qa.q, "", qa.a, "");
  L.push("## Full menu (prices in " + (cur.code || "VND") + ", tax included)", "");
  for (const c of shim.MENU_CATEGORIES || []) {
    L.push("### " + ((c.name && c.name.en) || ""), "");
    for (const m of (shim.MENU_ITEMS || []).filter((x) => x.cat === c.id)) {
      L.push("- " + ((m.name && m.name.en) || "") + " — " + RC.money(m.price, cur, "en") +
             (m.desc && m.desc.en ? " — " + m.desc.en : ""));
    }
    L.push("");
  }
  L.push("## Guest reviews", "");
  for (const r of shim.REVIEWS || []) {
    L.push("- " + "★".repeat(r.stars || 5) + " " + ((r.text && r.text.en) || "") + " — " + (r.name || ""));
  }
  L.push("", "_Last updated: " + (publishedAt || new Date().toISOString().slice(0, 10)) + "_", "");
  return L.join("\n");
}

/** Bake a static subpage (about/contact/legal/api) at deploy time. */
export function bakeStaticPage(pageHtml, shim, opts) {
  opts = opts || {};
  const lang = opts.lang || "en";
  const t = makeT(shim, lang);
  const base = effectiveBase(shim, opts.origin || "");
  const slug = opts.slug || "";
  const title = t(opts.titleKey || "meta.title");
  const desc = t(opts.descKey || "meta.description");
  const canonical = base + (slug ? "/" + slug : "/");

  let out = pageHtml;
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => "<title>" + escAttr(title) + "</title>");
  out = out.replace(/<meta\s+name="description"[^>]*>/i, () => '<meta name="description" content="' + escAttr(desc) + '" />');
  out = out.replace(/<!--CANONICAL-->/, '<link rel="canonical" href="' + canonical + '">');

  const RC = shim.RenderCore;
  if (RC && RC.socialRows && /<!--SOCIAL_TEXT_START-->/.test(out)) {
    const socialText = (RC.socialRows((shim.SEO_CONFIG || {}).sameAs) || [])
      .map(function (p) {
        return '<a href="' + escAttr(p.url) + '" title="' + escAttr(p.label) + '" target="_blank" rel="noopener">' + escHtml(p.label) + "</a>";
      })
      .join(" · ");
    out = out.replace(/<!--SOCIAL_TEXT_START-->[\s\S]*?<!--SOCIAL_TEXT_END-->/,
      "<!--SOCIAL_TEXT_START-->" + socialText + "<!--SOCIAL_TEXT_END-->");
  }

  out = applyI18n(out, shim.TRANSLATIONS, lang);
  out = applyFacts(out, shim.SITE_CONFIG || {});
  out = applyContactVisibility(out, shim._published);
  if (base) out = out.replace(/__BASE_URL__/g, base);
  return out;
}
