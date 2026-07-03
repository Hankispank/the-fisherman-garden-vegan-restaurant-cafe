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
  makeShim, evalSeed, assertSeedComplete, effectiveBase, bakeHtml,
  buildRobots, buildSitemap, buildLlms, applyI18n, applyFacts,
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
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(base, builtAt));
  fs.writeFileSync(path.join(outDir, "llms.txt"), buildLlms(shim, base, { generatedAt: builtAt }));

  // admin/admin.html duplicates the Visit/footer/nav — fill its i18n text + facts
  // too (it has no menu markers, so no grid bake), so it carries no template data.
  const adminSrc = path.join(root, "admin", "admin.html");
  if (fs.existsSync(adminSrc)) {
    let adminHtml = readTextStrict(adminSrc);
    adminHtml = applyI18n(adminHtml, shim.TRANSLATIONS, "en");
    adminHtml = applyFacts(adminHtml, shim.SITE_CONFIG);
    const adminOut = path.join(outDir, "admin", "admin.html");
    fs.mkdirSync(path.dirname(adminOut), { recursive: true });
    fs.writeFileSync(adminOut, adminHtml);
    verifyWritten(adminOut, ['data-fact="name"']);
  }

  console.log("prebake: baked index.html (" + bakedCount + " dishes) + admin + robots/sitemap/llms for base " + (base || "(origin-relative)") + " → " + outDir);
}

main();
