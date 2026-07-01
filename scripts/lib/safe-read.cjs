"use strict";
/*
 * safe-read.cjs — strict, fail-closed file read for the build pipeline.
 *
 * Guards against truncated/short reads, NUL-padding corruption, and a file
 * changing mid-read (flaky mount / concurrent write). On any incomplete read
 * it THROWS (stops the build) rather than returning partial data — so a bad
 * read can never cause a silent wrong bake or a false-pass scrub.
 *
 * See Plans/template-scrub-and-pipeline-hardening-plan.md (Part B1).
 */
const fs = require("fs");

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    // SharedArrayBuffer/Atomics unavailable — skip the sleep, retry immediately.
  }
}

// Read a text file and PROVE it is complete and stable, or throw.
function readTextStrict(file, opts) {
  const retries = (opts && opts.retries) || 5;
  const delayMs = (opts && opts.delayMs) || 60;
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const size = fs.statSync(file).size;
      const buf = fs.readFileSync(file);
      if (buf.length !== size) throw new Error(`short read ${buf.length}/${size} bytes`);
      const nul = buf.indexOf(0);
      if (nul !== -1) throw new Error(`NUL byte at offset ${nul} (corrupt/padded read)`);
      const buf2 = fs.readFileSync(file); // stability re-read
      if (!buf.equals(buf2)) throw new Error("content changed between reads");
      return buf.toString("utf8");
    } catch (e) {
      last = e;
      sleepSync(delayMs);
    }
  }
  throw new Error(`readTextStrict: could not get a clean read of ${file}: ${last && last.message}`);
}

module.exports = { readTextStrict };
