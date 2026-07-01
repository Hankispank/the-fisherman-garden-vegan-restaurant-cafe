"use strict";

const KEEP = ["prebake", "verify", "verify:scrub", "build", "build:demo"];

/** Strip factory-only npm scripts from a derived site's package.json. */
export function slimDerivedScripts(scripts = {}) {
  const out = {};
  for (const key of KEEP) {
    if (scripts[key]) out[key] = scripts[key];
  }
  return out;
}
