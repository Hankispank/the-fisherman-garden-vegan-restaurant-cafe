"use strict";
/*
 * verify-no-template-data.js — scrub gate (Point 1) + fail-closed (Part B5).
 *
 * Fails the build if any template-seed data survives in a derived site's shipped
 * output, or if a REQUIRED field (order inbox / SEO baseUrl)
 * is still blank. Reads strictly (readTextStrict) and treats an unreadable /
 * incomplete file as a FAILURE, never a skip — a truncated read can never
 * cause a false pass. Code/markup comments are stripped before matching so a
 * stray comment can't block a deploy (real shipped strings are still scanned).
 *
 * Run after prebake (so the generated index.html / crawl files are scanned).
 * Usage:  node scripts/verify-no-template-data.js [--dir <baked-dir>]
 *
 * Template seed repo: auto-skips when js/config.js contains "Acme Bistro"
 * (the canonical template is allowed to ship its own seed). CI uses
 * scripts/verify-template-seed.js to assert the seed is present and that
 * this gate WOULD fail if run without the skip.
 */
const fs = require("fs");
const path = require("path");
const { readTextStrict } = require("./lib/safe-read.cjs");

// Optional --dir to scan a baked OUT_DIR instead of the working tree.
const argv = process.argv.slice(2);
const ALLOW_INCOMPLETE = argv.includes("--allow-incomplete");
const dirIdx = argv.indexOf("--dir");
const BASE = dirIdx !== -1 ? path.resolve(process.cwd(), argv[dirIdx + 1]) : process.cwd();
const R = (p) => path.join(BASE, p);

function isTemplateSeed() {
  try {
    const cfg = readTextStrict(R("js/config.js"));
    return /name:\s*"Acme Bistro"/.test(cfg);
  } catch {
    return false;
  }
}

// Tokens that must NOT appear in a tailored site's shipped output.
const FORBIDDEN = [
  "Acme", "Acme Bistro", "acmebistro",
  "123 Placeholder Street", "Sample City",
  "Restaurant Website Template",            // seed meta.title tail
];
const extra = (process.env.TEMPLATE_FORBIDDEN_TOKENS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
FORBIDDEN.push(...extra);

// Files/dirs to scan (the shipped surface). Plans/, docs/, node_modules/, .git/ are skipped.
const ROOTS = ["index.html", "admin", "js", "css", "llms.txt", "sitemap.xml", "robots.txt"];
// Also fail if a REQUIRED field is still blank/placeholder.
const REQUIRED_NONBLANK = {
  "js/config.js": [
    /email:\s*""/,
    /whatsapp:\s*"00000*/,
  ],
  "js/seo.js": [/baseUrl:\s*""/],
  // Block a half-tailored bundle: placeholder/unpriced dish, or untranslated VI.
  "js/data.js": [/Signature dish at /, /price:\s*0\b/],
  "js/i18n.js": [/\[VI — review\]/],
};

function walk(p, out) {
  const s = fs.statSync(p);
  if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f), out));
  else if (/\.(html|js|css|txt|xml|json)$/.test(p)) out.push(p);
}

// Strip comments so a stray comment can't block, while real shipped strings stay scanned.
function stripComments(file, txt) {
  if (/\.(js|css)$/.test(file)) {
    return txt.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  }
  if (/\.html?$/.test(file)) {
    return txt.replace(/<!--[\s\S]*?-->/g, " ");
  }
  return txt;
}

if (isTemplateSeed()) {
  console.log("✓ Template seed detected — scrub gate skipped (run verify:seed in CI).");
  process.exit(0);
}

const fail = [];
const files = [];
ROOTS.forEach((r) => { const p = R(r); if (fs.existsSync(p)) walk(p, files); });

for (const f of files) {
  let txt;
  try {
    txt = readTextStrict(f);
  } catch (e) {
    fail.push(`${path.relative(BASE, f)}: UNREADABLE/INCOMPLETE — ${e.message}`); // fail closed
    continue;
  }
  const scan = stripComments(f, txt);
  for (const tok of FORBIDDEN) {
    if (scan.includes(tok)) fail.push(`${path.relative(BASE, f)}: contains "${tok}"`);
  }
}

if (!ALLOW_INCOMPLETE) {
  for (const [rel, pats] of Object.entries(REQUIRED_NONBLANK)) {
    const f = R(rel);
    if (fs.existsSync(f)) {
      let txt;
      try {
        txt = readTextStrict(f);
      } catch (e) {
        fail.push(`${rel}: UNREADABLE/INCOMPLETE — ${e.message}`);
        continue;
      }
      pats.forEach((rx) => { if (rx.test(txt)) fail.push(`${rel}: required field still blank/placeholder (${rx})`); });
    }
  }
}

if (fail.length) {
  console.error("✗ Template data still present (" + fail.length + "):\n - " + fail.join("\n - "));
  console.error("\nFix: tailor js/config.js, js/i18n.js, js/data.js (+ js/seo.js baseUrl) to this restaurant — see docs/NEW_SITE_CHECKLIST.md.");
  process.exit(1);
}
console.log("✓ No template-restaurant data found.");
process.exit(0);
