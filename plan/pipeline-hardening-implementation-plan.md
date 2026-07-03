# Pipeline Hardening — Implementation Plan

**Date:** 2026-07-01
**Scope:** The site-generation **pipeline** (template → Researcher apply → prebake/bake → verify gates → CI deploy), **not** the Fisherman output. Goal: make the classes of defect found in `plan/template-implementation-audit.md` **impossible to ship** on any future derived site, by fixing them at the source and adding fail-closed backstops.
**Applies to files:** `scripts/new-site.mjs`, `scripts/prebake.mjs`, `scripts/verify-crawlable.js`, `scripts/verify-no-template-data.js`, `scripts/verify-template-seed.js`, `scripts/lib/*`, `netlify/edge-functions/lib/bake-core.mjs`, `js/seo.js`, `js/render-core.js`, `package.json`, `.github/workflows/netlify-deploy.yml`, and the (external) `Researcher/scripts/apply-to-template.mjs`.

---

## 1. Guiding principle: shift-left + fail-closed

Every defect has two owners: the **producer** stage that should emit correct data (the Researcher apply step), and the **gate** stage that must refuse to deploy if it doesn't. Today the producer is unverified and the gates have blind spots, so bad data flows straight through. This plan fixes both:

- **Shift-left** — the apply step emits a canonical, schema-valid seed (correct hours shape, filtered reviews, real alts, translated VI).
- **Fail-closed** — the build gates independently re-derive and assert those properties, and the *unmodified template seed must fail every quality gate* (proving the gates actually bite).

The current gate chain is `npm run build` = `prebake → verify-crawlable --file index.html → verify-no-template-data`. We keep this shape and add checks + one new gate.

---

## 2. Defect taxonomy → pipeline root cause → owning stage

Each audit finding is a **class**, not a one-off. Mapping:

| # | Defect class (from audit) | Pipeline root cause | Producer fix | Gate that must catch it |
|---|---|---|---|---|
| D1 | Opening hours empty in JSON-LD + `llms.txt` "undefined" | Apply writes `hours:[{day,raw}]`; `js/seo.js` + `render-core` expect `{days,opens,closes}` — silent shape mismatch | Apply emits canonical hours | **new** schema gate + `verify-crawlable` hours assert + `buildLlms` guard |
| D2 | Ordering/reservations dead — `web3formsKey:""` shipped as "passed" | `--allow-incomplete` escape hatch (`build:demo`) skips required-field checks; `site-meta.scrubPassed` hand-set | Block deploy until owner sets key | `verify-no-template-data` required-field check, **not** bypassable in prod |
| D3 | First review says "business closed"; unfiltered scrape | Apply copies raw Google reviews with no quality filter | Apply filters reviews | **new** content-quality gate |
| D4 | VI menu ~unlocalized (143/149 names, 149/149 descs = EN) | Apply copies EN→VI as placeholder; scrub only checks a literal `[VI — review]` sentinel | Apply runs a translation pass | scrub `vi===en` ratio check |
| D5 | Gallery alt = raw "All (Google Maps)" ×12 | Scraper label passed through untouched | Apply generates descriptive alts | content-quality gate alt check |
| D6 | Hero "4.9" vs JSON-LD aggregate "5.0" | Two independent rating sources (hardcoded badge vs computed) | Single source: derive badge from reviews | schema/consistency gate |
| D7 | Title drops "Garden" vs config name | `meta.title` authored free-hand, not checked against `config.name` | Apply/lint aligns | scrub soft-check (warn) |

---

## 3. Workstream A — Canonicalize the data contract

**Problem:** there is no explicit, enforced schema for the seed. `assertSeedComplete()` (`bake-core.mjs` L46–55) only checks *presence* of top-level globals, not the *shape* of `hours`, the *completeness* of `name.vi`/`desc.vi`, or alt/reviews. A wrong-shaped field evaluates fine and dies silently downstream (exactly what happened with hours).

**A1 — Define & normalize the hours contract (fixes D1 at the root).**
- Decide one canonical shape and document it at the top of `js/config.js`:
  ```js
  hours: [{ days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], opens:"08:00", closes:"21:00" }]
  ```
- Add a tolerant normalizer so a legacy `{day,raw}` never silently zeroes out. New exported helper in `bake-core.mjs`, `normalizeHours(raw)`, that:
  - passes through the canonical `{days,opens,closes}` shape,
  - parses `{day,raw:"8 AM to 9 PM"}` → `{days:[<3-letter>], opens:"08:00", closes:"21:00"}`,
  - throws if it cannot produce `opens`/`closes` (fail-closed, not `undefined`).
- Call it in **one** place — `js/seo.js` `openingHours` mapper (currently L49–51) — so both browser and bake paths get normalized data. (Editing `js/seo.js` value-mapping is within the file's EDITABLE contract; the locked engine below is untouched.)

**A2 — Guard the generators against `undefined` (defense in depth for D1).**
- `bake-core.mjs` `buildLlms` L277 currently does `"- Hours: Daily " + opens + "–" + closes` with no guard. Change to only emit the line when both are present, and format from normalized data:
  ```js
  const h = (seo.openingHours || [])[0];
  if (h && h.opens && h.closes) lines.push("- Hours: Daily " + h.opens + "–" + h.closes);
  ```
- `js/render-core.js` `buildJsonLd` L341–345: skip specs whose `days` array is empty or whose `opens`/`closes` are missing, so a bad seed can never emit `{"dayOfWeek":[]}` noise into structured data.

**A3 — New schema gate `scripts/verify-seed-schema.js`.**
Runs first in `build`. Loads the seed via the existing shim (`makeShim/evalSeed`) and asserts the *shape*, not just presence:
- `SITE_CONFIG.hours[*]` has non-empty `days` + `HH:MM` `opens`/`closes`;
- every `MENU_ITEMS[*]` has `name.en`, `desc.en`, numeric `price>0`, valid `cat` in `MENU_CATEGORIES`;
- `GALLERY[*].alt.en` present;
- `REVIEWS[*]` has `stars∈1..5`, non-empty `text.en`.
Exit 1 on any violation. This is the single "is the seed well-formed" authority the other stages can trust.

---

## 4. Workstream B — Researcher apply-step correctness (source of truth)

The apply step (`Researcher/scripts/apply-to-template.mjs`, external to derived forks but referenced by `new-site.mjs` L153) is where scraped Maps data becomes `config.js`/`data.js`/`seo.js`. It is currently **unverified**. Harden it so it emits schema-valid, quality-filtered data.

**B1 — Emit canonical hours (D1).** Map Google "openingHours"/"periods" to `{days,opens,closes}` (24h `HH:MM`), collapsing identical days into ranges. Never write the `{day,raw}` free-text shape. If Maps hours are missing/ambiguous, leave `hours:[]` and flag in `CHECKLIST.md` for the owner — an empty list is honest; a malformed one is not.

**B2 — Review quality filter (D3).** Before writing `REVIEWS`, drop/queue-for-review any review that:
- mentions closure/permanently-closed (regex on `closed|permanently|out of business|shut down`),
- is < N chars or non-substantive,
- is rated below a configurable floor (default keep 4–5★ for the on-page carousel; the aggregate should still reflect the true Google rating, see B6),
- is not in a supported display language (EN/VI) unless a translation is provided (also fixes the German-review nit).
Cap at e.g. 6–8 and record what was dropped in `CHECKLIST.md`.

**B3 — Generate descriptive alts (D5).** Replace the scraper's `"All (Google Maps)"` label. Minimum: derive from photo category ("Interior", "Dish", "Garden") + restaurant name; better: a vision/caption pass. Never ship the literal harvest label; the gate in C3 will reject it.

**B4 — VI translation pass (D4).** After building `MENU_ITEMS`, run names + descriptions through a translation step to fill `name.vi`/`desc.vi`. Where translation is deferred, do **not** copy EN into VI (that defeats the gate and misleads); leave `vi` absent so `render-core.pick()` falls back to EN visibly and the completeness metric is honest.

**B5 — Honest completeness metadata (D2/D4).** `site-meta.json` `completeness`/`scrubPassed` must be written **by the gates**, not asserted by the apply step. Have apply write `completeness` from measured counts (e.g. `viMenuTranslatedPct`), and leave `scrubPassed` for the scrub gate to stamp (Workstream D2).

**B6 — Rating single-source (D6).** Apply computes the hero badge rating from the same review set that feeds `aggregateRating` (or from the true Google rating) and writes it once; the hero `<li>⭐ …</li>` should read from a fact, not a hardcoded literal. If keeping it hardcoded for now, the consistency check in C1 must fail on mismatch.

---

## 5. Workstream C — Harden the verify gates (backstops)

These run in every build and are the last line before deploy. Extend the two existing gates and add one.

**C1 — `scripts/verify-crawlable.js` (add machine-data asserts).**
Currently checks menu name/price/desc, JSON-LD Menu count, `aggregateRating` presence, canonical/og absolute, amenities (L73–136). Add:
- **Hours present & valid:** the JSON-LD `Restaurant.openingHoursSpecification` must be non-empty and every entry must have a non-empty `dayOfWeek` and `opens`/`closes`. (Would have caught D1.)
- **No literal `undefined`** anywhere in `index.html` or `llms.txt` (cheap `includes("undefined")` guard). (Would have caught D1 in `llms.txt`.)
- **Rating consistency:** parse the hero badge number and assert it equals `aggregateRating.ratingValue` within 0.1. (D6.)

**C2 — `scripts/verify-no-template-data.js` (close the escape hatch + add content checks).**
- **Remove the blanket `--allow-incomplete` bypass for production.** Today `build:demo` passes `--allow-incomplete` (package.json) which skips ALL `REQUIRED_NONBLANK` checks (L108) — this is the most likely reason a blank `web3formsKey` shipped as "passed". Options (pick one):
  - (preferred) scope the flag so it only relaxes the *template-seed demo*, never a derived site (detect via `isTemplateSeed()` already present, L31–38); a real slug always enforces required fields.
  - or split into `--allow-incomplete-content` (VI/alt) vs required-secrets which are *never* skippable.
- **Add `vi===en` menu ratio check (D4):** load the seed, compute the fraction of `MENU_ITEMS` where `name.vi===name.en` or `desc.vi===desc.en`; fail if above a threshold (e.g. >20%). Replaces the toothless `[VI — review]` sentinel (L66) with a real measure.
- **Keep `web3formsKey:""` required (D2)** — it's already in `REQUIRED_NONBLANK` (L55–61); the only reason it didn't fire is the bypass above. Once C2 closes the bypass, this is enforced.

**C3 — New gate `scripts/verify-content-quality.js` (D3/D5).**
Loads the seed and fails on:
- **Placeholder/harvest alts:** any `GALLERY[*].alt.en` matching `/(google maps|^all$|^photo$|^image$)/i` or duplicated across >2 tiles.
- **Bad reviews:** any `REVIEWS[*].text` matching the closure/negation regex from B2, or a review whose `stars` contradicts its text sentiment (min: closure-keyword check).
- **Rating sanity:** `aggregateRating` not a suspicious all-5.0 from a hand-picked set below a min count (warn), and hero/aggregate agreement (shared with C1).

**C4 — Wire the new gates into `package.json`.**
```
"build": "node scripts/verify-seed-schema.js && node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html && node scripts/verify-content-quality.js && node scripts/verify-no-template-data.js"
```
`build:demo` keeps `--allow-incomplete` **only** via the template-seed scoping from C2.

---

## 6. Workstream D — CI / process wiring

**D1 — CI runs the enforcing build, not the demo build.** In `.github/workflows/netlify-deploy.yml`, the derived-site deploy job must run `npm run build` (full gate chain), and the deploy step must be **gated on its exit code** so a red gate blocks publish. Confirm the workflow doesn't fall back to `build:demo`.

**D2 — `site-meta.json` is gate-authored, not hand-set.** The scrub gate (or a small `scripts/stamp-meta.mjs` run *after* all gates pass) writes `scrubPassed:true` and the measured `completeness`. Nothing upstream may set `scrubPassed`. This removes the false-green we saw (`scrubPassed:true` with a blank key).

**D3 — Post-deploy live verification.** After the Netlify deploy is `ready`, run `node scripts/verify-crawlable.js https://<site>/` against the **live** URL (the tool already supports a URL arg, L20/66) and treat failure as a deploy failure/alert. Catches edge-render drift that the `--file` check can't.

**D4 — Golden-master "gates must bite" test (regression insurance).** Extend `scripts/verify-template-seed.js` (already asserts the scrub *would* fail on the unmodified seed) to also assert the **new** gates fail on the seed: seed has no VI, placeholder alts, and (intentionally) demo content, so `verify-content-quality.js` and the `vi===en` check must exit 1. If a future refactor guts a gate, this test goes red. Run it in CI on the template repo.

---

## 7. Workstream E — Owner-handoff safety

`new-site.mjs` "Next steps" (L152–157) currently *tells* the owner to fill `web3formsKey`, `baseUrl`, secrets — but nothing enforces it. Convert advice into gates:
- **E1 — Pre-deploy checklist gate:** a `scripts/verify-owner-fields.js` (or fold into scrub) that fails if `web3formsKey`, `email`, `SEO_CONFIG.baseUrl`, `whatsapp`/`zalo` are blank/placeholder. This is the required-secrets subset that is **never** skippable (ties to C2).
- **E2 — Netlify env presence:** CI checks `ADMIN_PASSWORD`/`SESSION_SECRET` are set before enabling the admin function, so a half-configured site doesn't deploy an open admin.

---

## 8. Rollout sequence

Ordered so each phase is independently shippable and lower-risk first:

1. **Phase 1 — Backstops (highest ROI, no producer changes).** C1 (hours + `undefined` asserts), C2 (close `--allow-incomplete` bypass + `vi===en` check), A2 (`buildLlms`/`render-core` guards), C4 wiring. *Effect: the exact Fisherman defects can no longer pass a build.*
2. **Phase 2 — Data contract.** A1 (`normalizeHours` + canonical shape), A3 (`verify-seed-schema.js`), D4 (golden-master). *Effect: shape errors caught before bake, with regression insurance.*
3. **Phase 3 — Content quality gate.** C3 (`verify-content-quality.js`) + D2 (gate-authored meta). *Effect: reviews/alts quality enforced.*
4. **Phase 4 — Producer fixes.** B1–B6 in the Researcher apply step. *Effect: sites are *born* correct; gates become rarely-triggered safety nets.*
5. **Phase 5 — CI/process.** D1, D3, E1, E2. *Effect: process can't route around the gates.*

Phases 1–3 touch only in-repo files and are the priority. Phase 4 requires the (external) Researcher module.

---

## 9. Definition of done / acceptance criteria

- Re-running the pipeline on a fresh Maps link produces a site where: JSON-LD `openingHoursSpecification` is populated; `llms.txt` shows real hours (no `undefined`); `web3formsKey` blank **blocks** deploy; `vi===en` menu ratio is under threshold; no gallery alt is a harvest label; no featured review mentions closure; hero rating == aggregate rating.
- The **unmodified template seed fails** `verify-seed-schema` (no—seed is valid shape), `verify-content-quality`, and the scrub gate — proven by `verify-template-seed.js` in CI. (Seed is allowed to be demo content, but must not be able to *deploy*.)
- `npm run build` exits non-zero on any injected instance of D1–D6; CI blocks the Netlify publish on that non-zero.
- `site-meta.json.scrubPassed` is only ever written by a gate after all gates pass.

---

## 10. Risks & mitigations

- **Over-strict gates block legitimate edge cases** (e.g. a genuinely one-language venue, a venue with irregular hours). → Make thresholds configurable via env (mirror the existing `TEMPLATE_FORBIDDEN_TOKENS` pattern, `verify-no-template-data.js` L47) and allow an explicit, logged waiver file rather than a blanket bypass.
- **Translation/vision passes add cost/latency to apply.** → Run them in the apply step (offline, human-reviewed) not at deploy; gates only *measure*, they don't translate.
- **Closing `--allow-incomplete` breaks the template's own demo deploy.** → Scope the relaxation to `isTemplateSeed()` only (C2), which the codebase already detects.
- **Editing `js/seo.js`/`render-core.js`** — stay within each file's EDITABLE contract (values/mappers, not the locked engine). A1's `render-core` guard is a template-level change that all sites inherit (sanctioned by `TEMPLATE.md`'s "fix belongs in the template" rule), not a per-site edit.

---

## 11. File-by-file change summary

| File | Change | Workstream |
|---|---|---|
| `js/config.js` | Canonical `hours:{days,opens,closes}`; document schema | A1 |
| `js/seo.js` | Call `normalizeHours` in the `openingHours` mapper | A1 |
| `js/render-core.js` | `buildJsonLd`: skip empty/invalid opening-hours specs | A2 |
| `netlify/edge-functions/lib/bake-core.mjs` | Add `normalizeHours`; guard `buildLlms` hours line; extend `assertSeedComplete` | A1/A2 |
| `scripts/verify-seed-schema.js` *(new)* | Shape validation of the seed | A3 |
| `scripts/verify-crawlable.js` | Assert hours populated; no literal `undefined`; hero/aggregate rating match | C1 |
| `scripts/verify-no-template-data.js` | Scope `--allow-incomplete` to template seed only; add `vi===en` ratio check | C2 |
| `scripts/verify-content-quality.js` *(new)* | Alt-text + review-quality + rating-sanity gate | C3 |
| `scripts/verify-owner-fields.js` *(new, or fold into scrub)* | Required secrets non-blank, never skippable | E1 |
| `scripts/verify-template-seed.js` | Assert new gates also fail on the seed | D4 |
| `scripts/stamp-meta.mjs` *(new)* | Gate-authored `site-meta.json` | D2 |
| `package.json` | New gate order in `build`; scope `build:demo` | C4 |
| `.github/workflows/netlify-deploy.yml` | Run full `build`; gate publish on exit; post-deploy live verify; env presence | D1/D3/E2 |
| `Researcher/scripts/apply-to-template.mjs` *(external)* | Canonical hours, review filter, alt generation, VI translation, honest meta, single-source rating | B1–B6 |

---

*This plan changes the pipeline, not any single site. Once Phases 1–3 land, the specific defects catalogued in `plan/template-implementation-audit.md` are structurally un-shippable; Phase 4 makes new sites correct at birth.*
