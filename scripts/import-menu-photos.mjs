#!/usr/bin/env node
/**
 * Copy mapped dish photos → assets/menu/*.webp and patch js/data.js.
 * Run from site root: node scripts/import-menu-photos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(
  ROOT,
  "..",
  "c-Users-Admin-cursor-projects-SEO-Website-Builder",
  "assets"
);
const DEST_DIR = path.join(ROOT, "assets", "menu");
const DATA_JS = path.join(ROOT, "js", "data.js");
const WIDTHS = [480, 960];

/** dish id → source PNG basename fragment (unique match under SRC_DIR) */
const MAP = {
  frenchfries: "WhatsApp_Image_2026-06-29_at_12.55.27",
  crispymushroom: "WhatsApp_Image_2026-06-29_at_12.55.26__3_",
  zoodleswithavopesto: "WhatsApp_Image_2026-06-29_at_12.55.26__1_",
  pumpkinsoup: "WhatsApp_Image_2026-06-29_at_12.55.25-53e2cec9",
  freshvegetablesdip: "WhatsApp_Image_2026-06-29_at_12.55.25__2_",
  noodleswithfalafeltofu: "WhatsApp_Image_2026-06-29_at_12.55.25__1_",
  specialveganpizza: "WhatsApp_Image_2026-06-29_at_12.55.26-88eb7ebd",
  noodleswithvegetables: "WhatsApp_Image_2026-06-29_at_12.55.26__2_",
  peanutbuttertoasts: "WhatsApp_Image_2026-06-29_at_12.47.25__3_",
  dipyourtortillas: "WhatsApp_Image_2026-06-29_at_12.47.25__1_",
  chickpeacurry: "WhatsApp_Image_2026-06-29_at_12.47.25-89eeee2f",
  falafelbowl: "WhatsApp_Image_2026-06-29_at_12.47.24__2_",
  beetroothummustoasts: "WhatsApp_Image_2026-06-29_at_12.47.24-869f90f1",
  veganspaghettiwithtomato: "WhatsApp_Image_2026-06-29_at_12.47.24__1_",
  specialofthefishermansta: "WhatsApp_Image_2026-06-29_at_12.47.20-cb74a387",
  avotoasts: "WhatsApp_Image_2026-06-29_at_12.47.20__1_",
  veganpancakes: "WhatsApp_Image_2026-06-29_at_12.47.20__2_",
  strawesomesmoothiebowl: "WhatsApp_Image_2026-06-29_at_12.47.20__3_",
  vegansandwich: "WhatsApp_Image_2026-06-29_at_12.47.21__1_",
  buddhabowl: "WhatsApp_Image_2026-06-29_at_12.47.21-cb09082d",
  brekkyburrito: "WhatsApp_Image_2026-06-29_at_12.47.22__3_",
  veganbibimbap: "WhatsApp_Image_2026-06-29_at_12.47.22-500e05d3",
  freshspringrolls6pcs: "WhatsApp_Image_2026-06-29_at_12.47.22__1_",
  spicychickpeatoast: "WhatsApp_Image_2026-06-29_at_12.47.22__2_",
  braisedtofuandmushroomin: "WhatsApp_Image_2026-06-29_at_12.47.23-6c51091e",
  morningglorywithmushroom: "WhatsApp_Image_2026-06-29_at_12.47.23__1_",
  veganquesadilla: "WhatsApp_Image_2026-06-29_at_12.47.23__2_",
  pinklovesmoothiebowl: "WhatsApp_Image_2026-06-29_at_12.47.23__3_",
  specialbowl: "WhatsApp_Image_2026-06-29_at_12.47.25__2_",
  tofuchips: "WhatsApp_Image_2026-06-29_at_12.46.55-4d8b72c9",
  mexicanwrap: "WhatsApp_Image_2026-06-29_at_12.46.55__1_",
  veganpho: "WhatsApp_Image_2026-06-29_at_12.46.56-66e68715",
  papayasaladwithgrilledto: "WhatsApp_Image_2026-06-29_at_12.46.56__1_",
  mushroomandtofupatties: "WhatsApp_Image_2026-06-29_at_12.46.56__2_",
  veganburger: "WhatsApp_Image_2026-06-29_at_12.46.56__3_",
  vegangoldenbag: "WhatsApp_Image_2026-06-29_at_12.47.26-ad302db3",
};

function findSrc(fragment) {
  const files = fs.readdirSync(SRC_DIR).filter(
    (f) => f.includes(fragment) && /\.(png|jpe?g|webp)$/i.test(f)
  );
  if (files.length !== 1) {
    throw new Error(`Expected 1 source for ${fragment}, found ${files.length}: ${files.join(", ")}`);
  }
  return path.join(SRC_DIR, files[0]);
}

async function generateWebpVariants(srcPath, destDir, baseName) {
  fs.mkdirSync(destDir, { recursive: true });
  const sharp = (await import("sharp")).default;
  const meta = await sharp(srcPath).metadata();
  for (const width of WIDTHS) {
    await sharp(srcPath)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(destDir, `${baseName}-${width}.webp`));
  }
  return {
    widths: WIDTHS,
    w: meta.width || WIDTHS[WIDTHS.length - 1],
    h: meta.height || Math.round((meta.width || 960) * 0.75),
  };
}

const photoMeta = {};

for (const [id, fragment] of Object.entries(MAP)) {
  const src = findSrc(fragment);
  const { widths, w, h } = await generateWebpVariants(src, DEST_DIR, id);
  photoMeta[id] = {
    base: `assets/menu/${id}`,
    widths,
    w,
    h,
    image: `assets/menu/${id}-960.webp`,
  };
  console.log("OK", id);
}

let data = fs.readFileSync(DATA_JS, "utf8");
for (const [id, meta] of Object.entries(photoMeta)) {
  const re = new RegExp(
    `(\\{\\s*"id":\\s*"${id}"[\\s\\S]*?"emoji":\\s*"[^"]*",)\\s*\\n`,
    "m"
  );
  const block =
    `\n    "base": "${meta.base}",\n    "widths": [${meta.widths.join(", ")}],\n    "w": ${meta.w},\n    "h": ${meta.h},\n    "image": "${meta.image}",\n`;
  if (!re.test(data)) {
    throw new Error(`Could not patch menu item ${id}`);
  }
  data = data.replace(re, `$1${block}`);
}
fs.writeFileSync(DATA_JS, data);
console.log(`Patched ${Object.keys(photoMeta).length} items in js/data.js`);

// Keep local Netlify blobs in sync so netlify dev shows photos immediately.
import { spawnSync } from "child_process";
const sync = spawnSync(process.execPath, ["scripts/sync-menu-to-blobs.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (sync.status !== 0) process.exit(sync.status || 1);
