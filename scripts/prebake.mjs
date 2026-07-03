/*
 * prebake.mjs — build-time static baseline (P2) + truncation-hardened (Part B).
 *
 * Bakes the SEED/default menu, reviews, gallery, and JSON-LD into index.html
 * (and fills admin/admin.html facts) and regenerates robots.txt / sitemap.xml /
 * llms.txt with the real base URL, using the SAME shared module the edge uses
 * (bake-core.mjs) so they cannot drift. Runs at deploy time (netlify.toml).
 *
 * Fail-closed: every read goes through readTextStrict (throws on truncated/
 * NUL-padded/changing reads), the seed is integrity-checked after eval, and
 * every output is re-read and asserted — so a bad read/write can never produce
 * a silent half-baked page.
 *
 * Base URL precedence: SEO_CONFIG.baseUrl → $URL → $DEPLOY_PRIME_URL.
 * Optional OUT_DIR env writes outputs elsewhere (used for safe local testing).
 *
 * Usage: node scripts/prebake.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import {
  makeShim, evalSeed, assertSeedComplete, effectiveBase, bakeHtml, bakeStaticPage,
  buildRobots, buildSitemap, buildLlms, buildLlmsFull, applyI18n, applyFacts, applyContactVisibility,
} from "../netlify/edge-functions/lib/bake-core.mjs";

const require = createRequire(import.meta.url);
const { readTextStrict } = require("./lib/safe-read.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = process.env.OUT_DIR ? path.resolve(process.cwd(), process.env.OUT_DIR) : root;

function readSeed() {
  const files = ["config", "i18n", "data", "seo", "render-core"];
  const texts = files.map((f) => ({ name: f, text: readTextStrict(path.join(root, "js", f + ".js")) }));
  const shim = makeShim();
  evalSeed(shim, texts);
  assertSeedComplete(shim); // throw on a truncated-but-parseable seed
  return shim;
}

// Re-read a freshly-written output and assert sentinels — catches a truncated WRITE.
function verifyWritten(file, mustContain) {
  const txt = readTextStrict(file);
  for (const s of mustContain) {
    if (!txt.includes(s)) throw new Error(`prebake output ${file} missing "${s}" (incomplete write/bake)`);
  }
  return txt;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const shim = readSeed();

  let origin = (shim.SEO_CONFIG.baseUrl || process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  if (!origin && /Acme Bistro/.test(shim.SITE_CONFIG?.name || "")) {
    origin = "https://acme-bistro-template.example";
  }
  if (!origin) {
    console.warn("prebake: WARNING — no base URL (set SEO_CONFIG.baseUrl or $URL). canonical/og will be origin-relative.");
  }

  const indexHtml = readTextStrict(path.join(root, "index.html"));
  const baked = bakeHtml(indexHtml, shim, { origin: origin, lang: "en" });
  const indexOut = path.join(outDir, "index.html");
  fs.writeFileSync(indexOut, baked);

  // Write-then-verify: JSON-LD + markers + at least one dish made it in.
  const bakedBack = verifyWritten(indexOut, ['id="seo-jsonld"', "<!--MENU_START-->", 'class="dish"']);
  const bakedCount = (bakedBack.match(/class="dish"/g) || []).length;
  if (bakedCount !== shim.MENU_ITEMS.length) {
    throw new Error(`baked dish count ${bakedCount} != data ${shim.MENU_ITEMS.length} (truncated bake)`);
  }

  const base = effectiveBase(shim, origin);
  const builtAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "robots.txt"), buildRobots(base));
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(base, { homeLastmod: builtAt, pageLastmod: builtAt }));
  fs.writeFileSync(path.join(outDir, "llms.txt"), buildLlms(shim, base, { generatedAt: builtAt, menuUpdated: builtAt }));
  fs.writeFileSync(path.join(outDir, "llms-full.txt"), buildLlmsFull(shim, base, builtAt, { generatedAt: builtAt }));
  const wellKnownDir = path.join(outDir, ".well-known");
  fs.mkdirSync(wellKnownDir, { recursive: true });
  fs.writeFileSync(path.join(wellKnownDir, "llms.txt"), buildLlms(shim, base, { generatedAt: builtAt, menuUpdated: builtAt }));

  const STATIC_PAGES = [
    { file: "about.html", slug: "about", titleKey: "meta.about.title", descKey: "meta.about.description" },
    { file: "contact.html", slug: "contact", titleKey: "meta.contact.title", descKey: "meta.contact.description" },
    { file: "privacy.html", slug: "privacy", titleKey: "meta.privacy.title", descKey: "meta.privacy.description" },
    { file: "terms.html", slug: "terms", titleKey: "meta.terms.title", descKey: "meta.terms.description" },
    { file: "api.html", slug: "api", titleKey: "meta.api.title", descKey: "meta.api.description" },
  ];
  for (const page of STATIC_PAGES) {
    const src = path.join(root, page.file);
    if (!fs.existsSync(src)) continue;
    const bakedPage = bakeStaticPage(readTextStrict(src), shim, {
      origin: origin,
      lang: "en",
      slug: page.slug,
      titleKey: page.titleKey,
      descKey: page.descKey,
    });
    fs.writeFileSync(path.join(outDir, page.file), bakedPage);
  }

  const openapiSrc = path.join(root, "openapi.json");
  if (fs.existsSync(openapiSrc)) {
    const openapi = readTextStrict(openapiSrc).replace(/__BASE_URL__/g, base || origin || "");
    fs.writeFileSync(path.join(outDir, "openapi.json"), openapi);
  }

  // admin/admin.html duplicates the Visit/footer/nav — fill its i18n text + facts
  // too (it has no menu markers, so no grid bake), so it carries no template data.
  const adminSrc = path.join(root, "admin", "admin.html");
  if (fs.existsSync(adminSrc)) {
    let adminHtml = readTextStrict(adminSrc);
    adminHtml = applyI18n(adminHtml, shim.TRANSLATIONS, "en");
    adminHtml = applyFacts(adminHtml, shim.SITE_CONFIG);
    adminHtml = applyContactVisibility(adminHtml, null);
    const adminOut = path.join(outDir, "admin", "admin.html");
    fs.mkdirSync(path.dirname(adminOut), { recursive: true });
    fs.writeFileSync(adminOut, adminHtml);
    verifyWritten(adminOut, ['data-fact="name"']);
  }

  console.log("prebake: baked index.html (" + bakedCount + " dishes) + admin + robots/sitemap/llms for base " + (base || "(origin-relative)") + " → " + outDir);
}

main();
