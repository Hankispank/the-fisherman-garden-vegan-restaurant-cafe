# Mobile Order Drawer ("Your Order") — Slim Layout Implementation Plan

**Date:** 2026-07-03 · reviewed against HEAD `1d75687` (see Precondition)
**Issue:** on mobile the drawer's footer (total + order form) fills the whole screen; the picked items are squeezed to zero height and "Order now" / "Clear order" are clipped off-screen and unreachable.
**Chosen design (owner-confirmed):** single scrollable drawer + slim sticky "Total + Order now" bar pinned at the bottom.

---

## ⚠️ Precondition — repair the truncated working tree first

The uncommitted `index.html` in the working tree is **truncated at 467 lines** (ends mid-`#orderChan`); HEAD's version (501 lines) contains the rest of the cart: honeypot `botcheck` → `#orderNow` → `#orderConfirm` → privacy note → `#cartClear` → drawer close. The working copy is missing all of these — deployed as-is, checkout is broken, and `scripts/verify-crawlable.js` would NOT catch it (it gates menu/JSON-LD only).

1. Diff working tree vs HEAD (`git diff index.html`); if the truncation is not an intentional in-flight edit, restore: `git checkout -- index.html` (or re-apply the intended changes fully).
2. Optional hardening (recommended): add a gate to `verify-crawlable.js` — baked HTML must contain `id="orderNow"`, `id="cartClear"`, and `id="orderConfirm"`.
3. Implement this plan on top of the complete (HEAD-shaped) markup.

## 1. Root cause (verified)

- `.cart` is a fixed, full-height flex column (`css/styles.css:388–394`, `height: 100%`) where **only** `.cart__items` scrolls (`overflow-y: auto`, line 398). 
- `.cart__foot` (`index.html`, cart block) is a **non-scrollable** grid stacking ~11 controls: total, order-type+guests row, date+time row, name, contact toggle, contact input, Zalo/WhatsApp picker, honeypot, Order now, confirm panel, privacy note, Clear order — ≈500–540px tall at current paddings (inputs `0.7rem` padding, foot `gap: 0.7rem`, `padding: 1.1rem 1.4rem 1.4rem`, styles.css:412).
- On a 568–667px-tall phone viewport: head (~64px) + foot (~540px) ≥ viewport → flex squeezes `.cart__items` to ~0 (items invisible) **and** the foot's own overflow is clipped (`Order now`/`Clear order` below the fold, unreachable — exactly the reported symptom).
- `height: 100%` ignores mobile browser chrome; with the on-screen keyboard open the visual viewport shrinks to ~350px and the situation degrades further (no `dvh`, no scroll escape).

## 2. Target behaviour

Mobile (≤880px): the drawer is one naturally scrolling column — sticky slim header, items list (always visible first), compact form — with a slim pinned bottom bar showing **Total + Order now**. Everything is reachable by scroll; the keyboard pushes focused inputs into view natively. Desktop keeps its current layout except the total row moves next to the button (visual improvement, no functional change).

---

## 3. Implementation

### 3.1 `index.html` — one structural change inside the cart block

The cart block is marked `LOCK: … DOM structure`, so record this as a deliberate template amendment. All IDs are preserved; `js/app.js` references `#cartTotal`, `#cartFoot`, `#orderNow` by ID and queries the honeypot inside `#cartFoot` (`app.js:138, 181, 687, 693`) — verified safe.

Move the total row and the Order now button into a wrapper placed as the **last child** of `#cartFoot` (nothing after it → clean sticky behaviour; confirm/status messages appear above the bar):

```html
<footer class="cart__foot" id="cartFoot" hidden>
  <!-- (cart__total removed from here) -->
  … form rows / name / contact / chan picker / botcheck … (unchanged)
  <div class="confirm" id="orderConfirm" hidden>…</div>
  <p class="form__hint" data-i18n="privacy.note">…</p>
  <button class="cart__clear" id="cartClear" …>Clear order</button>

  <div class="cart__cta">
    <div class="cart__total">
      <span data-i18n="cart.total">Total</span>
      <strong id="cartTotal">0</strong>
    </div>
    <button class="btn btn--primary cart__cta-btn" id="orderNow" type="button">
      <span data-i18n="cart.orderNow">Order now</span>
    </button>
  </div>
</footer>
```

(`#orderNow` loses `btn--block` — the CTA bar controls its width now; keep the class if desktop should stay full-width and override width in `.cart__cta` instead.)

### 3.2 `css/styles.css` — scroll model + sticky bar + compaction

**Global (all widths):**

```css
.cart { height: 100dvh; }                 /* after the existing height:100%; older browsers keep 100% */
.cart__cta { display: grid; gap: 0.7rem; }/* desktop: total row above full-width button, as today */
.cart__cta .btn { width: 100%; }
```

**Inside `@media (max-width: 880px)` (styles.css:482ff):**

```css
/* one scroll region: the drawer itself */
.cart { overflow-y: auto; }
.cart__items { flex: none; overflow: visible; padding: 0.8rem 1rem; }
.cart__empty { flex: none; padding: 3rem 1.5rem; }
.cart__head { position: sticky; top: 0; z-index: 3; background: var(--c-bg); padding: 0.85rem 1rem; }

/* compact form */
.cart__foot { padding: 0.8rem 1rem 0; gap: 0.5rem; }
.cart__foot input, .cart__foot select { padding: 0.55rem 0.7rem; }
.cart__foot .form__row { gap: 0.6rem; }
.cart__foot input { scroll-margin-bottom: 92px; }   /* focus scroll clears the sticky bar */

/* slim pinned CTA bar */
.cart__cta {
  position: sticky; bottom: 0; z-index: 3;
  display: flex; align-items: center; gap: 0.8rem;
  margin: 0.5rem -1rem 0;                 /* bleed to drawer edges past foot padding */
  padding: 0.65rem 1rem calc(0.65rem + env(safe-area-inset-bottom));
  background: var(--c-surface-alt); border-top: 1px solid var(--c-line);
}
.cart__cta .cart__total { flex: 1; font-size: 0.95rem; }
.cart__cta .cart__total strong { font-size: 1.15rem; }
.cart__cta .btn { flex: 0 1 auto; width: auto; white-space: nowrap; }
```

Why this works: `position: sticky` resolves against the nearest scrolling ancestor — now `.cart` itself — so the header pins at top and the CTA at bottom while items + form scroll between them. Since `.cart__cta` is the last node in the drawer, it never un-pins mid-scroll. `100dvh` + `env(safe-area-inset-bottom)` handle mobile browser chrome and iPhone home-indicator overlap.

**Optional (recommended):** apply the same block under `@media (max-height: 700px)` as well, so short landscape/laptop windows get the scrollable drawer too.

### 3.3 `js/app.js` — no changes required

Verified: cart open/close, `hidden` toggling of `#cartFoot`, total updates (`#cartTotal`), channel picker wiring (`#orderNow`), and the honeypot lookup all use IDs or containment in `#cartFoot`, which are unchanged. The confirm-state renderer writes into `#orderConfirm*` nodes that now sit above the CTA — visible when shown, no code impact.

### 3.4 No bake/admin impact

The drawer is client-side UI: `bake-core.mjs` only fills `data-i18n`/`data-fact` text (labels unchanged), and admin edits cart labels via i18n keys only. `applyI18n` handles the moved nodes identically. No changes to `bake-core.mjs`, `content-loader.js`, or `admin.js`.

## 4. Acceptance checklist

1. iPhone SE-class viewport (375×667, and 320px width): open cart with 3+ items → items visible under the header, form scrolls, slim Total+Order now bar always pinned at bottom; Clear order reachable by scroll; nothing clipped.
2. Tap the name field → keyboard opens → focused input scrolls above the CTA bar (`scroll-margin-bottom`); Order now still tappable after dismissing keyboard.
3. Submit flow: confirm status/fallback (`#orderConfirm`) renders above the bar and is fully visible; Zalo-first picker unaffected.
4. Empty cart: `#cartFoot` hidden (JS unchanged) → no stray sticky bar; empty state centered.
5. Desktop ≥881px: drawer visually identical except total sits directly above Order now at the foot's end; internal items scroll still works with long orders.
6. iOS Safari + Android Chrome spot-check for the known sticky-plus-keyboard quirk (bar may float mid-screen while the keyboard is open on iOS — acceptable; it re-pins on blur).
7. Precondition gate: `verify-crawlable.js` now fails if `orderNow`/`cartClear`/`orderConfirm` are missing from baked HTML; run `node scripts/prebake.mjs && node scripts/verify-crawlable.js --file index.html`.

**Effort:** ~1.5–2 h + device testing. Files: `index.html` (one wrapper move inside the cart block), `css/styles.css` (~30 lines), `scripts/verify-crawlable.js` (precondition gate). No JS, bake, or admin changes.
