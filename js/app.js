/*
 * ============================================================
 *  LOCKED FILE — DO NOT EDIT
 * ------------------------------------------------------------
 *  This is shared template functionality (rendering, cart,
 *  POST-first ordering, reservations). It must stay identical
 *  across all restaurant sites built from this template.
 *  To change a site, edit CONTENT (js/config.js, js/data.js,
 *  i18n VALUES) and STYLE (css :root tokens) only.
 *  See TEMPLATE.md and AGENTS.md.
 * ============================================================
 */
/* Restaurant template — app logic: rendering, cart, reservations, ordering. */
(function () {
  "use strict";

  const cfg = window.SITE_CONFIG;
  const t = (k) => window.I18N.t(k);
  const lang = () => window.I18N.lang;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- currency ---------- */
  function money(n) {
    const c = cfg.currency;
    const num = Number(n).toLocaleString(lang() === "vi" ? "vi-VN" : "en-US", {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    });
    return c.position === "before" ? `${c.symbol}${num}` : `${num} ${c.symbol}`;
  }

  /* ---------- cart state ---------- */
  const CART_KEY = "gl_cart";
  let cart = {};
  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch (e) {
    cart = {};
  }
  const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const itemById = (id) => window.MENU_ITEMS.find((m) => m.id === id);
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const it = itemById(id);
      return sum + (it ? it.price * qty : 0);
    }, 0);

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    renderCart();
    const it = itemById(id);
    if (it) toast(`${it.name[lang()]} ${t("menu.added")}`);
  }
  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = qty;
    saveCart();
    renderCart();
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  /* ---------- tags ---------- */
  const TAG_LABELS = {
    veg: { en: "Vegetarian", vi: "Chay", cls: "tag--veg" },
    spicy: { en: "Spicy", vi: "Cay", cls: "tag--spicy" },
    popular: { en: "Popular", vi: "Phổ biến", cls: "tag--popular" },
    new: { en: "New", vi: "Mới", cls: "tag--new" },
  };

  /* ---------- render menu ---------- */
  let activeCat = "popular";

  // Shared, isomorphic markup lives in js/render-core.js so the browser
  // and the server-baked (crawlable) HTML never drift. app.js owns only
  // the DOM wiring (listeners) on top of that markup.
  const RC = window.RenderCore;
  const menuCtx = () => ({ lang: lang(), currency: cfg.currency, t });

  function renderTabs() {
    const wrap = $("#menuTabs");
    wrap.innerHTML = window.MENU_CATEGORIES.map((c) =>
      RC.menuTabHTML(c, activeCat, lang())
    ).join("");
    $$(".menu__tab", wrap).forEach((b) =>
      b.addEventListener("click", () => {
        activeCat = b.dataset.cat;
        renderTabs();
        renderMenu();
      })
    );
  }

  function renderMenu() {
    const grid = $("#menuGrid");
    const items =
      activeCat === "popular"
        ? window.MENU_ITEMS.filter((m) => m.tags.includes("popular"))
        : window.MENU_ITEMS.filter((m) => m.cat === activeCat);

    grid.innerHTML = items.map((it) => RC.dishCardHTML(it, menuCtx())).join("");
    $$(".dish", grid).forEach((card) => {
      const add = card.querySelector(".dish__add");
      if (add) add.addEventListener("click", () => addToCart(card.dataset.id));
    });
  }

  /* ---------- render gallery / reviews ---------- */
  function renderGallery() {
    const grid = $("#galleryGrid");
    grid.innerHTML = window.GALLERY.map((g) => RC.galleryItemHTML(g, lang())).join("");
  }

  function renderReviews() {
    const grid = $("#reviewsGrid");
    grid.innerHTML = window.REVIEWS.map((r) => RC.reviewCardHTML(r, lang())).join("");
  }

  /* ---------- render cart ---------- */
  function renderCart() {
    const count = cartCount();
    $("#cartCount").textContent = count;
    $("#cartCount").classList.toggle("is-empty", count === 0);

    const list = $("#cartItems");
    const empty = $("#cartEmpty");
    const foot = $("#cartFoot");
    list.innerHTML = "";

    const entries = Object.entries(cart).filter(([id]) => itemById(id));
    const orderConfirm = $("#orderConfirm");
    const keepFoot = orderConfirm && !orderConfirm.hidden;

    if (entries.length === 0 && !keepFoot) {
      empty.hidden = false;
      foot.hidden = true;
      return;
    }
    if (entries.length === 0 && keepFoot) {
      empty.hidden = true;
      foot.hidden = false;
      return;
    }
    empty.hidden = true;
    foot.hidden = false;

    entries.forEach(([id, qty]) => {
      const it = itemById(id);
      const row = document.createElement("div");
      row.className = "cart-item";
      const thumb = it.image
        ? `<span class="cart-item__emoji"><img src="${it.image}" alt="" style="width:1.6rem;height:1.6rem;object-fit:cover;border-radius:4px;display:block;"></span>`
        : `<span class="cart-item__emoji"></span>`;
      row.innerHTML = `
        ${thumb}
        <div class="cart-item__info">
          <span class="cart-item__name">${it.name[lang()]}</span>
          <span class="cart-item__price">${money(it.price)}</span>
        </div>
        <div class="qty">
          <button class="qty__btn" data-act="dec" aria-label="-">−</button>
          <span class="qty__num">${qty}</span>
          <button class="qty__btn" data-act="inc" aria-label="+">+</button>
        </div>`;
      row.querySelector('[data-act="dec"]').addEventListener("click", () => setQty(id, qty - 1));
      row.querySelector('[data-act="inc"]').addEventListener("click", () => setQty(id, qty + 1));
      list.appendChild(row);
    });

    $("#cartTotal").textContent = money(cartTotal());
  }

  /* ---------- cart drawer open/close ---------- */
  function openCart() {
    $("#cart").classList.add("is-open");
    $("#cart").setAttribute("aria-hidden", "false");
    $("#cartBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    $("#cart").classList.remove("is-open");
    $("#cart").setAttribute("aria-hidden", "true");
    $("#cartBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- gallery lightbox ---------- */
  let lightboxEl = null, lightboxImg = null, lightboxReturnFocus = null;
  function ensureLightbox() {
    if (lightboxEl) return;
    lightboxEl = document.createElement("div");
    lightboxEl.className = "lightbox";
    lightboxEl.id = "lightbox";
    lightboxEl.setAttribute("role", "dialog");
    lightboxEl.setAttribute("aria-modal", "true");
    lightboxEl.setAttribute("aria-hidden", "true");
    lightboxEl.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="' + t("gallery.close") + '">✕</button>' +
      '<img class="lightbox__img" alt="">';
    document.body.appendChild(lightboxEl);
    lightboxImg = lightboxEl.querySelector(".lightbox__img");
    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl || e.target.closest(".lightbox__close")) closeLightbox();
    });
  }
  function openLightbox(src, alt) {
    ensureLightbox();
    lightboxReturnFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightboxEl.classList.add("is-open");
    lightboxEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxEl.querySelector(".lightbox__close").focus();
  }
  function closeLightbox() {
    if (!lightboxEl || !lightboxEl.classList.contains("is-open")) return;
    lightboxEl.classList.remove("is-open");
    lightboxEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lightboxImg.src = "";
    if (lightboxReturnFocus && lightboxReturnFocus.focus) lightboxReturnFocus.focus();
  }

  /* ---------- build messages & send ---------- */
  function ti(key, vars = {}) {
    let s = t(key);
    Object.entries(vars).forEach(([k, v]) => {
      s = s.replace(`{${k}}`, v);
    });
    return s;
  }

  function generateOrderId() {
    const d = new Date();
    const ymd =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    // self-brands from SITE_CONFIG.shortName (first two letters). Template-level change; see TEMPLATE.md.
    const prefix =
      ((window.SITE_CONFIG && window.SITE_CONFIG.shortName) || "ORD")
        .replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "ORD";
    return `${prefix}-${ymd}-${rand}`;
  }

  function isValidContact(value, method) {
    const v = value.trim();
    if (method === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
    const digits = v.replace(/[\s\-().]/g, "");
    return /^\+?\d{8,15}$/.test(digits);
  }

  function isHoneypotTripped(honeypotEl) {
    return honeypotEl && honeypotEl.checked;
  }

  function prefillDateTime(dateEl, timeEl) {
    const now = new Date();
    if (dateEl) dateEl.value = now.toISOString().slice(0, 10);
    if (timeEl) {
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      timeEl.value = `${h}:${m}`;
    }
  }

  function openDeepLink(channel, text, subject) {
    const enc = encodeURIComponent(text);
    if (channel === "whatsapp") {
      window.open(`https://wa.me/${cfg.whatsapp}?text=${enc}`, "_blank", "noopener");
      return;
    }
    if (channel === "zalo") {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      window.open(`https://zalo.me/${cfg.zalo}`, "_blank", "noopener");
      toast(t("msg.zaloCopied"));
      return;
    }
    const sub = encodeURIComponent(subject || cfg.name);
    window.open(`mailto:${cfg.email}?subject=${sub}&body=${enc}`, "_blank");
  }

  async function submitToEndpoint(payload) {
    const url = cfg.endpoint || "https://api.web3forms.com/submit";
    try {
      if (typeof fetch === "function") {
        const res = await fetch(url, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        const json = await res.json().catch(() => ({}));
        return res.ok && json.success === true;
      }
    } catch (e) {
      /* fall through to sendBeacon */
    }
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      return navigator.sendBeacon(url, blob);
    }
    return false;
  }

  function getSelectedApp(pickerEl) {
    const active = pickerEl?.querySelector(".chan__btn.is-active");
    return active?.dataset.app || "whatsapp";
  }

  function resolveChannel(method, pickerEl) {
    if (method === "email") return "email";
    return getSelectedApp(pickerEl);
  }

  function renderFallbackButtons(container, text, channel, subject) {
    container.innerHTML = "";
    const hint = document.createElement("p");
    hint.className = "confirm__hint";
    hint.textContent = t("confirm.fallbackHint");
    container.appendChild(hint);

    const actions = document.createElement("div");
    actions.className = "confirm__actions";
    container.appendChild(actions);

    const addBtn = (label, cls, ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn--block " + (cls || "btn--outline");
      b.textContent = label;
      b.addEventListener("click", () => openDeepLink(ch, text, subject));
      actions.appendChild(b);
    };

    if (channel === "whatsapp") addBtn("WhatsApp", "btn--whatsapp", "whatsapp");
    else if (channel === "zalo") addBtn("Zalo", "", "zalo");
    else addBtn(t("contact.email"), "", "email");
  }

  function showConfirmState(confirmEls, state, orderId, successKey, text, channel, subject) {
    if (!confirmEls || !confirmEls.panel) return;
    const { panel, status, fallback } = confirmEls;
    panel.hidden = false;
    status.className = "confirm__status confirm__status--" + state;

    if (state === "sending") {
      status.innerHTML = `<span class="confirm__spinner" aria-hidden="true"></span>${t("confirm.sending")}`;
      if (fallback) fallback.hidden = true;
    } else if (state === "ok") {
      status.textContent = ti(successKey, { id: orderId });
      if (fallback) fallback.hidden = true;
    } else if (state === "err") {
      status.textContent = t("confirm.error");
      if (fallback) {
        fallback.hidden = false;
        renderFallbackButtons(fallback, text, channel, subject);
      }
    }
  }

  function buildOrderMessage(orderId) {
    const lines = [`*${cfg.name} — ${t("msg.orderTitle")}*`, ""];
    if (orderId) lines.push(`${t("msg.ref")}: ${orderId}`, "");
    const type = $("#orderType");
    const typeLabel = type.options[type.selectedIndex].textContent;
    lines.push(`${t("msg.type")}: ${typeLabel}`);
    const guests = $("#orderGuests").value;
    if (guests) lines.push(`${t("msg.guests")}: ${guests}`);
    const name = $("#orderName").value.trim();
    const contact = $("#orderContact").value.trim();
    const date = $("#orderDate").value;
    const time = $("#orderTime").value;
    if (name) lines.push(`${t("msg.for")}: ${name}`);
    if (contact) lines.push(`${t("msg.contact")}: ${contact}`);
    if (date) lines.push(`${t("msg.date")}: ${date}`);
    if (time) lines.push(`${t("msg.time")}: ${time}`);
    lines.push("", `${t("msg.items")}:`);
    Object.entries(cart).forEach(([id, qty]) => {
      const it = itemById(id);
      if (it) lines.push(`• ${qty}× ${it.name[lang()]} — ${money(it.price * qty)}`);
    });
    lines.push("", `${t("msg.total")}: ${money(cartTotal())}`);
    return lines.join("\n");
  }

  function buildOrderPayload(orderId, message, method, channel, contact, name) {
    const type = $("#orderType");
    const typeLabel = type.options[type.selectedIndex].textContent;
    const items = Object.entries(cart)
      .filter(([id]) => itemById(id))
      .map(([id, qty]) => {
        const it = itemById(id);
        return `${qty}× ${it.name[lang()]} — ${money(it.price * qty)}`;
      })
      .join("\n");

    return {
      access_key: cfg.web3formsKey,
      subject: `New order ${orderId} — ${name}`,
      from_name: name,
      type: "order",
      order_id: orderId,
      contact_method: method,
      channel,
      customer_name: name,
      customer_contact: contact,
      order_type: typeLabel,
      guests: $("#orderGuests").value,
      date: $("#orderDate").value,
      time: $("#orderTime").value,
      items,
      total: money(cartTotal()),
      message,
      botcheck: "",
    };
  }

  function buildReservationMessage(form, orderId) {
    const g = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");
    const lines = [`*${cfg.name} — ${t("msg.reservationTitle")}*`, ""];
    if (orderId) lines.push(`${t("msg.ref")}: ${orderId}`, "");
    lines.push(
      `${t("msg.for")}: ${g("name")}`,
      `${t("msg.contact")}: ${g("contact")}`,
      `${t("msg.date")}: ${g("date")}`,
      `${t("msg.time")}: ${g("time")}`,
      `${t("msg.guests")}: ${g("guests")}`
    );
    if (g("notes")) lines.push(`${t("msg.notes")}: ${g("notes")}`);
    return lines.join("\n");
  }

  function buildReservationPayload(form, orderId, message, method, channel) {
    const g = (n) => (form.elements[n] ? form.elements[n].value.trim() : "");
    return {
      access_key: cfg.web3formsKey,
      subject: `New reservation ${orderId} — ${g("name")}`,
      from_name: g("name"),
      type: "reservation",
      order_id: orderId,
      contact_method: method,
      channel,
      customer_name: g("name"),
      customer_contact: g("contact"),
      date: g("date"),
      time: g("time"),
      guests: g("guests"),
      notes: g("notes"),
      message,
      botcheck: "",
    };
  }

  function setupChannelPicker(contactInput, pickerEl, sendBtn, options = {}) {
    const {
      validateFn,
      subject = cfg.name,
      methodToggle,
      phonePhKey,
      emailPhKey,
      confirmEls,
      successKey = "confirm.successOrder",
      buildPayloadFn,
      buildMessageFn,
      honeypotEl,
      onSuccess,
    } = options;

    const emailIcon = sendBtn.querySelector(".btn__icon-email");
    let method = "phone";
    let submitting = false;

    function applyMethod() {
      const isEmail = method === "email";
      pickerEl.hidden = isEmail;
      if (emailIcon) emailIcon.hidden = !isEmail;
      const phKey = isEmail ? emailPhKey : phonePhKey;
      if (phKey) {
        contactInput.setAttribute("data-i18n-ph", phKey);
        contactInput.setAttribute("placeholder", t(phKey));
      }
      contactInput.type = isEmail ? "email" : "tel";
    }

    if (methodToggle) {
      $$(".contact-toggle__btn", methodToggle).forEach((btn) => {
        btn.addEventListener("click", () => {
          method = btn.dataset.method;
          $$(".contact-toggle__btn", methodToggle).forEach((b) =>
            b.classList.toggle("is-active", b === btn)
          );
          applyMethod();
        });
      });
    }

    $$(".chan__btn", pickerEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".chan__btn", pickerEl).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });

    sendBtn.addEventListener("click", () => {
      if (submitting) return;
      if (validateFn && !validateFn(method)) return;

      const contact = contactInput.value.trim();
      if (!contact) {
        toast(t("cart.needContact"));
        contactInput.focus();
        return;
      }
      if (!isValidContact(contact, method)) {
        toast(method === "email" ? t("validate.email") : t("validate.phone"));
        contactInput.focus();
        return;
      }
      if (isHoneypotTripped(honeypotEl)) return;

      const orderId = generateOrderId();
      const channel = resolveChannel(method, pickerEl);
      const text = buildMessageFn(orderId);
      const payload = buildPayloadFn(orderId, text, method, channel, contact);

      submitting = true;
      sendBtn.disabled = true;
      showConfirmState(confirmEls, "sending", orderId, successKey, text, channel, subject);

      const postPromise = submitToEndpoint(payload);
      openDeepLink(channel, text, subject);

      postPromise
        .then((ok) => {
          if (ok) {
            showConfirmState(confirmEls, "ok", orderId, successKey, text, channel, subject);
            if (onSuccess) onSuccess();
          } else {
            showConfirmState(confirmEls, "err", orderId, successKey, text, channel, subject);
          }
        })
        .catch(() => {
          showConfirmState(confirmEls, "err", orderId, successKey, text, channel, subject);
        })
        .finally(() => {
          submitting = false;
          sendBtn.disabled = false;
        });
    });

    applyMethod();
  }

  function validateOrder(method) {
    if (cartCount() === 0) return false;
    const name = $("#orderName").value.trim();
    const contact = $("#orderContact").value.trim();
    if (!name || !contact) {
      toast(t("cart.needContact"));
      ($("#orderName").value ? $("#orderContact") : $("#orderName")).focus();
      return false;
    }
    if (!isValidContact(contact, method || "phone")) {
      toast((method === "email" ? t("validate.email") : t("validate.phone")));
      ($("#orderContact")).focus();
      return false;
    }
    return true;
  }

  /* ---------- reservation ---------- */
  function initReservation() {
    const form = $("#reserveForm");
    const contactInput = $("#reserveContact");

    prefillDateTime(form.elements["date"], form.elements["time"]);

    setupChannelPicker(contactInput, $("#reserveChan"), $("#reserveNow"), {
      subject: `${cfg.name} — reservation`,
      methodToggle: $("#reserveMethod"),
      phonePhKey: "form.phonePh",
      emailPhKey: "form.emailPh",
      successKey: "confirm.successReservation",
      honeypotEl: form.querySelector('input[name="botcheck"]'),
      confirmEls: {
        panel: $("#reserveConfirm"),
        status: $("#reserveConfirmStatus"),
        fallback: $("#reserveConfirmFallback"),
      },
      buildMessageFn: (orderId) => buildReservationMessage(form, orderId),
      buildPayloadFn: (orderId, text, method, channel) =>
        buildReservationPayload(form, orderId, text, method, channel),
      validateFn: (method) => {
        const req = ["name", "contact", "date", "time"];
        const ok = req.every((n) => form.elements[n] && form.elements[n].value.trim());
        if (!ok) {
          toast(t("form.fillRequired"));
          return false;
        }
        const contact = contactInput.value.trim();
        if (!isValidContact(contact, method || "phone")) {
          toast(method === "email" ? t("validate.email") : t("validate.phone"));
          contactInput.focus();
          return false;
        }
        return true;
      },
    });

    form.addEventListener("submit", (e) => e.preventDefault());
  }

  /* ---------- nav ---------- */
  function initNav() {
    const header = $("#nav");
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = $("#navBurger");
    const links = $("#navLinks");
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    $$("#navLinks a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- language ---------- */
  function initLang() {
    $$(".lang__btn").forEach((b) =>
      b.addEventListener("click", () => window.I18N.set(b.dataset.lang))
    );
    document.addEventListener("languagechange", () => {
      renderTabs();
      renderMenu();
      renderReviews();
      renderCart();
    });
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("#year").textContent = new Date().getFullYear();

    window.I18N.apply();
    initLang();
    initNav();

    renderTabs();
    renderMenu();
    renderGallery();
    renderReviews();
    renderCart();
    initReservation();

    $("#galleryGrid").addEventListener("click", (e) => {
      const tile = e.target.closest(".gallery__item--photo");
      if (!tile) return;
      openLightbox(tile.getAttribute("data-full"), tile.getAttribute("data-alt"));
    });

    prefillDateTime($("#orderDate"), $("#orderTime"));
    setupChannelPicker($("#orderContact"), $("#orderChan"), $("#orderNow"), {
      subject: `${cfg.name} — order`,
      methodToggle: $("#orderMethod"),
      phonePhKey: "cart.contactPh",
      emailPhKey: "cart.emailPh",
      successKey: "confirm.successOrder",
      honeypotEl: $("#cartFoot").querySelector('input[name="botcheck"]'),
      confirmEls: {
        panel: $("#orderConfirm"),
        status: $("#orderConfirmStatus"),
        fallback: $("#orderConfirmFallback"),
      },
      buildMessageFn: (orderId) => buildOrderMessage(orderId),
      buildPayloadFn: (orderId, text, method, channel, contact) => {
        const name = $("#orderName").value.trim();
        return buildOrderPayload(orderId, text, method, channel, contact, name);
      },
      validateFn: validateOrder,
      onSuccess: () => {
        cart = {};
        saveCart();
        renderCart();
      },
    });

    $("#cartToggle").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    $("#cartBackdrop").addEventListener("click", closeCart);
    $("#cartClear").addEventListener("click", () => {
      cart = {};
      saveCart();
      renderCart();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeCart(); closeLightbox(); }
    });
  });
})();
