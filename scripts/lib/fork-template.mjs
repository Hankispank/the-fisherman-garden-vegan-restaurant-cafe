"use strict";

import fs from "fs";

import path from "path";



export const EXCLUDE = new Set([

  ".git",

  "node_modules",

  ".netlify",

  ".env",

  ".claude",

  "Researcher",

  "pipeline",

  "Plans",

  "docs",

  "scripts/test",

  "assets/research",

  "secrets.local.json",

]);



const PREFIX_EXCLUDE = [

  "Researcher/",

  "pipeline/",

  "Plans/",

  "docs/",

  "scripts/test/",

  "assets/research/",

];



export function shouldExclude(rel) {

  const norm = rel.replace(/\\/g, "/");

  if (EXCLUDE.has(norm)) return true;

  return PREFIX_EXCLUDE.some((p) => norm.startsWith(p));

}



/** Copy template tree from templateRoot to dest, honoring EXCLUDE. */

export function copyTemplate(templateRoot, dest) {

  function walk(src, base = "") {

    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {

      const rel = base ? `${base}/${ent.name}` : ent.name;

      if (shouldExclude(rel)) continue;

      const from = path.join(src, ent.name);

      const to = path.join(dest, rel);

      if (ent.isDirectory()) {

        fs.mkdirSync(to, { recursive: true });

        walk(from, rel);

      } else {

        fs.mkdirSync(path.dirname(to), { recursive: true });

        fs.copyFileSync(from, to);

      }

    }

  }

  fs.mkdirSync(dest, { recursive: true });

  walk(templateRoot);

}


