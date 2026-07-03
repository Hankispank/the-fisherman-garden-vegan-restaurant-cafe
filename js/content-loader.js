/*
 * content-loader.js — public site content override layer
 *
 * Fetches published.json from the CDN/function and deep-merges it over the
 * default window.* seed values set by config.js / data.js / i18n.js.
 * app.js reads the (now-merged) globals and renders — its code is unchanged.
 *
 * Graceful degradation: if the fetch fails or returns no content the seed
 * values remain in place and the site renders normally.
 */
(function () {
  "use strict";

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      const sv = source[key];
      if (Array.isArray(sv)) {
        if (sv.length) target[key] = sv; // never replace with empty arrays
      } else if (sv && typeof sv === "object" && !Array.isArray(target[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], sv);
      } else {
        target[key] = sv;
      }
    });
    return target;
  }

  function renderAmenitiesSection() {
    var body = document.getElementById("amenitiesBody");
    var section = document.getElementById("amenities");
    if (!body || !window.RenderCore || !window.SEO_CONFIG) return;
    var lang = window.I18N && window.I18N.lang ? window.I18N.lang : "en";
    var html = window.RenderCore.amenitySectionHTML(
      window.SEO_CONFIG.amenities || [],
      lang,
      window.SEO_CONFIG.customAmenities
    );
    body.innerHTML = html;
    if (section) section.style.display = html ? "" : "none";
  }

  function applyContent(c) {
    if (!c) return;
    if (c.config)          deepMerge(window.SITE_CONFIG, c.config);
    if (c.translations)    deepMerge(window.TRANSLATIONS, c.translations);
    if (c.menuCategories && c.menuCategories.length) window.MENU_CATEGORIES = c.menuCategories;
    if (c.menuItems && c.menuItems.length)           window.MENU_ITEMS = c.menuItems;
    if (c.gallery && c.gallery.length)               window.GALLERY = c.gallery;
    if (c.reviews && c.reviews.length)               window.REVIEWS = c.reviews;
    // visit / nav static HTML overrides are applied via data attributes read by app.js
    // or directly via content-loader after DOMContentLoaded (see below)
    if (c.visit)           window._CONTENT_VISIT   = c.visit;
    if (c.nav)             window._CONTENT_NAV     = c.nav;
    if (c.footer)          window._CONTENT_FOOTER  = c.footer;
    // SEO/social facts (share image, profiles, etc.) → keep the in-browser
    // JSON-LD in sync with what the edge bakes from published.seo.
    if (c.seo && window.SEO_CONFIG) deepMerge(window.SEO_CONFIG, c.seo);
    if (c.config && c.config.telephoneDisplay && window.SEO_CONFIG) {
      window.SEO_CONFIG.telephone = c.config.telephoneDisplay;
    }
    applyTheme(c);
    renderAmenitiesSection();
    if (window.renderSocial) window.renderSocial();
  }

  function applyTheme(c) {
    if (!c || !c.theme || !Object.prototype.hasOwnProperty.call(c.theme, "heroUrl")) return;
    var url = c.theme.heroUrl;
    document.documentElement.style.setProperty(
      "--hero-media",
      url ? 'url("' + url + '")' : 'url("")'
    );
  }

  function applyContactFacts(c) {
    if (!c || !c.config) return;
    var cfg = c.config;
    var tel = cfg.telephoneDisplay || "";
    var mail = cfg.email_public || cfg.email || "";
    var hrefTel = cfg.telephoneHref ? "tel:+" + cfg.telephoneHref : "tel:+";
    var hrefMail = mail ? "mailto:" + mail : "mailto:";

    document.querySelectorAll('[data-fact="tel"]').forEach(function (el) {
      el.textContent = tel;
      if (el.tagName === "A") el.href = hrefTel;
    });
    document.querySelectorAll('[data-fact="email"]').forEach(function (el) {
      el.textContent = mail;
      if (el.tagName === "A") el.href = hrefMail;
    });
  }

  function applyContactVisibility(c) {
    if (!c) c = {};
    var v = c.visit || {}, f = c.footer || {};
    document.querySelectorAll("[data-area][data-contact]").forEach(function (el) {
      var area = el.getAttribute("data-area");
      var kind = el.getAttribute("data-contact");
      var show = true;
      if (kind === "email") show = (area === "visit" ? v.showEmail : f.showEmail) === true;
      if (kind === "phone") show = (area === "visit" ? v.showPhone : f.showPhone) !== false;
      el.style.display = show ? "" : "none";
    });
    var zaloBtn = document.querySelector('[data-area="visit"][data-chat="zalo"]');
    var waBtn = document.querySelector('[data-area="visit"][data-chat="whatsapp"]');
    if (zaloBtn) {
      zaloBtn.style.display = v.showZalo === false ? "none" : "";
      if (v.zaloHref) zaloBtn.href = v.zaloHref;
      else if (c.config && c.config.zalo) zaloBtn.href = "https://zalo.me/" + c.config.zalo;
    }
    if (waBtn) waBtn.style.display = v.showWhatsapp === false ? "none" : "";
  }

  function applyStaticDOM(c) {
    if (!c) return;
    applyContactFacts(c);
    applyContactVisibility(c);

    // Visit section — address / map are hardcoded in HTML, update them
    if (c.visit) {
      var addressEl = document.querySelector(".visit__list li:first-child span");
      if (addressEl && c.visit.address) addressEl.textContent = c.visit.address;

      var mapEl = document.querySelector(".visit__map iframe");
      if (mapEl && c.visit.mapEmbedSrc) mapEl.src = c.visit.mapEmbedSrc;

      var dirBtn = document.querySelector(".visit__actions .btn--primary");
      if (dirBtn && c.visit.directionsHref) dirBtn.href = c.visit.directionsHref;

      var waBtn = document.querySelector(".visit__actions .btn--whatsapp");
      if (waBtn && c.visit.whatsappHref) waBtn.href = c.visit.whatsappHref;

      var zaloBtn = document.querySelector(".visit__actions .btn--zalo");
      if (zaloBtn && c.visit.zaloHref) zaloBtn.href = c.visit.zaloHref;
    }

    // Nav logo text
    if (c.nav && c.nav.logoText) {
      var logoText = document.querySelector(".nav__logo-text");
      if (logoText) logoText.textContent = c.nav.logoText;
    }
    if (c.nav && c.nav.logoEmoji) {
      var logoMark = document.querySelector(".nav__logo-mark");
      if (logoMark) logoMark.textContent = c.nav.logoEmoji;
    }

    // Footer brand
    if (c.footer) {
      if (c.footer.brandName) {
        var fb = document.querySelector(".footer__brand strong");
        if (fb) fb.textContent = c.footer.brandName;
      }
      if (c.footer.address) {
        var fa = document.querySelector(".footer__col span");
        if (fa) fa.textContent = c.footer.address;
      }
    }
  }

  // Fetch published content before app.js renders.
  // We intercept the DOMContentLoaded event to ensure merge happens first.
  var _originalAddEventListener = document.addEventListener.bind(document);
  var _dclListeners = [];
  var _merged = false;

  document.addEventListener = function (type, handler, opts) {
    if (type === "DOMContentLoaded" && !_merged) {
      _dclListeners.push({ handler: handler, opts: opts });
    } else {
      _originalAddEventListener(type, handler, opts);
    }
  };

  function firePendingDCL() {
    _merged = true;
    document.addEventListener = _originalAddEventListener; // restore
    _dclListeners.forEach(function (item) {
      try { item.handler(new Event("DOMContentLoaded")); } catch (e) { /* ignore */ }
    });
    _dclListeners = [];
  }

  fetch("/.netlify/functions/get-content", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (content) {
      applyContent(content);
      // Apply static DOM overrides after DOM is ready
      if (content) {
        if (document.readyState === "loading") {
          _originalAddEventListener("DOMContentLoaded", function () {
            applyStaticDOM(content);
          });
        } else {
          applyStaticDOM(content);
        }
      } else if (document.readyState === "loading") {
        _originalAddEventListener("DOMContentLoaded", function () {
          applyContactVisibility({});
        });
      } else {
        applyContactVisibility({});
      }
    })
    .catch(function () { /* silently fall back to seed values */ })
    .finally(function () { firePendingDCL(); });

})();
