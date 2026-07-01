#!/usr/bin/env node
/**
 * Merge MENU_ITEMS from js/data.js into local Netlify draft + published blobs.
 * Needed because get-content replaces seed menuItems and hides new dish photos.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { makeShim, evalSeed } from "../netlify/edge-functions/lib/bake-core.mjs";

const require = createRequire(import.meta.url);
const { readTextStrict } = require("./lib/safe-read.cjs");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOB_DIR = path.join(ROOT, ".netlify", "blobs-local", "content");

const shim = makeShim();
evalSeed(shim, [{ name: "data", text: readTextStrict(path.join(ROOT, "js", "data.js")) }]);
const menuItems = shim.MENU_ITEMS;
if (!Array.isArray(menuItems)) {
  throw new Error("Could not load MENU_ITEMS from js/data.js");
}

for (const key of ["draft", "published"]) {
  const file = path.join(BLOB_DIR, key);
  if (!fs.existsSync(file)) {
    console.log("skip (missing):", key);
    continue;
  }
  const blob = JSON.parse(fs.readFileSync(file, "utf8"));
  blob.menuItems = menuItems;
  blob.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(blob, null, 2));
  console.log("updated", key, "→", menuItems.length, "items");
}
