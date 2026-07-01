#!/usr/bin/env node
"use strict";
/**
 * new-site.mjs — fork the template into a derived restaurant site.
 *
 * Usage:
 *   node scripts/new-site.mjs "<maps-url>" --name "The Fisherman" --slug the-fisherman
 *     [--netlify-site-id …] [--github-repo owner/repo] [--dry-run] [--skip-research]
 *
 * Steps: copy template → run Researcher → pause for review → patch package.json +
 * netlify workflow → init git → optional Netlify/GitHub create.
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { copyTemplate } from "./lib/fork-template.mjs";
import { slimDerivedScripts } from "./lib/slim-package.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { mapsUrl: "", name: "", slug: "", netlifySiteId: "", githubRepo: "", dryRun: false, skipResearch: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-research") out.skipResearch = true;
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--netlify-site-id") out.netlifySiteId = argv[++i];
    else if (a === "--github-repo") out.githubRepo = argv[++i];
    else if (!a.startsWith("--")) positional.push(a);
  }
  out.mapsUrl = positional[0] || "";
  return out;
}

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

function patchPackageJson(dest, slug) {
  const p = path.join(dest, "package.json");
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.name = slug;
  pkg.scripts = slimDerivedScripts(pkg.scripts);
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function patchNetlifyWorkflow(dest, siteId) {
  const wf = path.join(dest, ".github", "workflows", "netlify-deploy.yml");
  let txt = fs.readFileSync(wf, "utf8");
  txt = txt.replace(
    /NETLIFY_SITE_ID:\s*[a-f0-9-]+/i,
    `NETLIFY_SITE_ID: ${siteId}  # SET BY new-site.mjs`
  );
  fs.writeFileSync(wf, txt, "utf8");
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
  return r;
}

function findLatestRunDir(root) {
  const runs = path.join(root, "Researcher", "runs");
  if (!fs.existsSync(runs)) return null;
  const dirs = fs.readdirSync(runs)
    .map((d) => path.join(runs, d))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

async function waitForEnter(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question(msg, () => { rl.close(); resolve(); }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug && !args.name && !args.dryRun) {
    console.error("Usage: node scripts/new-site.mjs \"<maps-url>\" --name \"Restaurant\" --slug my-slug [--dry-run]");
    process.exit(1);
  }
  const slug = args.slug || slugify(args.name);
  const dest = path.resolve(TEMPLATE_ROOT, "..", slug);

  const plan = [
    `Target: ${dest}`,
    `Restaurant: ${args.name || "(from Maps)"}`,
    `Maps URL: ${args.mapsUrl || "(skip — --skip-research)"}`,
    `Netlify site ID: ${args.netlifySiteId || "(create or set later)"}`,
    `GitHub repo: ${args.githubRepo || "(optional)"}`,
  ];
  console.log("new-site.mjs plan:\n - " + plan.join("\n - "));
  if (args.dryRun) {
    console.log("\n--dry-run: no files written.");
    return;
  }

  if (fs.existsSync(dest)) throw new Error(`Target already exists: ${dest}`);
  console.log("\nCopying template…");
  copyTemplate(TEMPLATE_ROOT, dest);
  fs.mkdirSync(path.join(dest, "assets", "research"), { recursive: true });

  let runDir = null;
  if (!args.skipResearch && args.mapsUrl) {
    console.log("\nRunning Researcher (from template repo)…");
    run("npm", ["run", "research", "--", args.mapsUrl], { cwd: TEMPLATE_ROOT });
    runDir = findLatestRunDir(TEMPLATE_ROOT);
  } else {
    console.log("\nSkipping research (--skip-research or no maps URL).");
  }

  if (runDir) {
    const checklist = path.join(runDir, "CHECKLIST.md");
    console.log(`\nReview research bundle:\n  ${checklist}`);
    console.log("Curate content.json / photos, then press Enter to continue (or Ctrl+C to abort)…");
    await waitForEnter("");
  }

  patchPackageJson(dest, slug);

  let siteId = args.netlifySiteId;
  if (!siteId) {
    const probe = spawnSync("netlify", ["sites:list", "--json"], { encoding: "utf8", shell: true });
    if (probe.status === 0) {
      const create = spawnSync("netlify", ["sites:create", "--name", slug], { encoding: "utf8", shell: true });
      const match = (create.stdout || create.stderr || "").match(/([a-f0-9-]{36})/i);
      if (match) siteId = match[1];
    }
  }
  if (siteId) patchNetlifyWorkflow(dest, siteId);
  else console.warn("WARN: no Netlify site ID — edit .github/workflows/netlify-deploy.yml manually.");

  console.log("\nInitializing git…");
  run("git", ["init"], { cwd: dest });
  run("git", ["add", "-A"], { cwd: dest });
  run("git", ["commit", "-m", `Initial site for ${args.name || slug}`], { cwd: dest });

  if (args.githubRepo) {
    console.log(`\nCreating GitHub repo ${args.githubRepo}…`);
    run("gh", ["repo", "create", args.githubRepo, "--public", "--source=.", "--push"], { cwd: dest });
  }

  console.log("\n✓ Derived site ready at:", dest);
  console.log("\nNext steps:");
  console.log(`  1. RESEARCH_RUN_DIR=${runDir || "<run-dir>"} TEMPLATE_ROOT=${dest} node ${path.join(TEMPLATE_ROOT, "Researcher", "scripts", "apply-to-template.mjs")} --photos owner`);
  console.log("  2. Owner fills js/config.js (email, web3formsKey, whatsapp, zalo) + js/seo.js (baseUrl, ogImage)");
  console.log("  3. Set GitHub secret NETLIFY_AUTH_TOKEN on the derived repo");
  console.log("  4. Set Netlify env ADMIN_PASSWORD + SESSION_SECRET");
  console.log("  5. npm run build && git push origin main");
}

main().catch((e) => {
  console.error("new-site.mjs failed:", e.message || e);
  process.exit(1);
});
