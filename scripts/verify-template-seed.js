"use strict";
/*
 * verify-template-seed.js — CI guard for the canonical template repo.
 *
 * Asserts:
 *   1. js/config.js still contains the Acme seed (not accidentally tailored).
 *   2. The scrub gate WOULD fail if forced (proves derived-site protection).
 *   3. A minimal tailored copy passes scrub after owner fields are filled.
 *
 * Usage: node scripts/verify-template-seed.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { readTextStrict } = require("./lib/safe-read.cjs");

const ROOT = path.resolve(__dirname, "..");
const configJs = readTextStrict(path.join(ROOT, "js", "config.js"));

if (!/name:\s*"Acme Bistro"/.test(configJs)) {
  console.error("✗ verify-template-seed: js/config.js is not the Acme seed — template was tailored in-place.");
  process.exit(1);
}
if (!/123 Placeholder Street/.test(configJs)) {
  console.error("✗ verify-template-seed: seed address missing from js/config.js.");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-seed-"));
try {
  for (const rel of ["js/config.js", "js/seo.js", "js/data.js", "js/i18n.js", "index.html"]) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) {
      const dst = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
  fs.mkdirSync(path.join(tmp, "scripts", "lib"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts", "verify-no-template-data.js"), path.join(tmp, "scripts", "verify-no-template-data.js"));
  fs.copyFileSync(path.join(ROOT, "scripts", "lib", "safe-read.cjs"), path.join(tmp, "scripts", "lib", "safe-read.cjs"));

  // Force scrub (no template skip) by renaming Acme in the copy.
  let cfg = readTextStrict(path.join(tmp, "js", "config.js"));
  cfg = cfg.replace(/Acme Bistro/g, "Still Acme Seed");
  fs.writeFileSync(path.join(tmp, "js", "config.js"), cfg);

  const forced = spawnSync(process.execPath, [path.join(tmp, "scripts", "verify-no-template-data.js")], {
    cwd: tmp,
    encoding: "utf8",
    env: { ...process.env, TEMPLATE_FORBIDDEN_TOKENS: "Acme,Sample City" },
  });
  if (forced.status === 0) {
    console.error("✗ verify-template-seed: scrub should fail on seed tokens when forced.");
    process.exit(1);
  }

  // Tailored mini-site passes scrub.
  const tailored = path.join(tmp, "tailored");
  fs.mkdirSync(path.join(tailored, "scripts", "lib"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts", "verify-no-template-data.js"), path.join(tailored, "scripts", "verify-no-template-data.js"));
  fs.copyFileSync(path.join(ROOT, "scripts", "lib", "safe-read.cjs"), path.join(tailored, "scripts", "lib", "safe-read.cjs"));
  fs.mkdirSync(path.join(tailored, "js"), { recursive: true });
  fs.writeFileSync(path.join(tailored, "js", "config.js"), [
    'window.SITE_CONFIG = {',
    '  name: "River Kitchen", shortName: "River",',
    '  whatsapp: "84901112233", zalo: "",',
    '  email: "orders@river.app", web3formsKey: "real-key-abc",',
    '  currency: { code: "USD", symbol: "$", position: "before", decimals: 2 }',
    '};\n',
  ].join("\n"));
  fs.writeFileSync(path.join(tailored, "js", "seo.js"), 'window.SEO_CONFIG = { baseUrl: "https://river.app" };\n');
  fs.writeFileSync(path.join(tailored, "js", "data.js"), 'window.MENU_ITEMS = [{ name: { en: "Soup" }, price: 12, desc: { en: "Hot soup" } }];\n');
  fs.writeFileSync(path.join(tailored, "js", "i18n.js"), 'window.TRANSLATIONS = { en: { "meta.title": "River" }, vi: { "meta.title": "Sông" } };\n');

  const pass = spawnSync(process.execPath, [path.join(tailored, "scripts", "verify-no-template-data.js")], {
    cwd: tailored,
    encoding: "utf8",
  });
  if (pass.status !== 0) {
    console.error("✗ verify-template-seed: tailored fixture should pass scrub:\n", pass.stdout, pass.stderr);
    process.exit(1);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("✓ verify-template-seed: Acme seed intact; scrub rejects seed; tailored fixture passes.");
process.exit(0);
