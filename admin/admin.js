/*
 * admin.js — admin editing layer for the restaurant template.
 *
 * Loaded after app.js has rendered the site from seed values.
 * Flow:
 *   1. Check auth (GET /auth)
 *   2. If unauthed → show login overlay
 *   3. After auth → fetch draft, merge into window.*, re-render, inject ✎ buttons
 *   4. ✎ → side panel → field editors → auto-save draft
 *   5. Publish button → promote draft to live
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════════════ */
  var draft       = null;   // current in-memory draft content object
  var saveTimer   = null;   // debounce handle for auto-save
  var isDirty     = false;
  var LANG        = function () { return window.I18N ? window.I18N.lang : "en"; };

  var FN = "/.netlify/functions";

  // Admin is served from /admin/*; seed asset paths like "assets/..." must be root-relative.
  function rootAssetUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (/^(https?:|\/|data:|#|blob:)/.test(url)) return url;
    return "/" + url.replace(/^\.\//, "");
  }

  function fixRenderedAssetUrls() {
    document.querySelectorAll("img[src]").forEach(function (img) {
      var src = img.getAttribute("src");
      if (src && !/^(https?:|\/|data:|blob:)/.test(src)) img.src = rootAssetUrl(src);
      var ss = img.getAttribute("srcset");
      if (ss) {
        img.setAttribute("srcset", ss.split(",").map(function (part) {
          var bits = part.trim().split(/\s+/);
          if (bits[0] && !/^(https?:|\/|data:|blob:)/.test(bits[0])) bits[0] = rootAssetUrl(bits[0]);
          return bits.join(" ");
        }).join(", "));
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     BOOTSTRAP
  ═══════════════════════════════════════════════════════════════ */
  document.addEventListener("DOMContentLoaded", function () {
    checkAuth();
  });

  function checkAuth() {
    fetch(FN + "/auth", { credentials: "include" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok && res.body.ok) {
          loadDraftAndInit();
        } else {
          showLogin();
        }
      })
      .catch(function () { showLogin(); });
  }

  /* ═══════════════════════════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════════════════════════ */
  function showLogin() {
    hide("adminLoading");
    show("adminLoginOverlay");
    var input  = el("adminPassword");
    var btn    = el("adminLoginBtn");
    var errEl  = el("adminLoginError");

    input.focus();
    function doLogin() {
      errEl.textContent = "";
      btn.disabled = true;
      btn.textContent = "Signing in…";
      fetch(FN + "/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: input.value }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body.ok) {
            hide("adminLoginOverlay");
            show("adminLoading");
            loadDraftAndInit();
          } else {
            errEl.textContent = res.body.error || "Invalid password.";
            input.value = "";
            input.focus();
          }
        })
        .catch(function () { errEl.textContent = "Network error. Try again."; })
        .finally(function () { btn.disabled = false; btn.textContent = "Sign in"; });
    }

    btn.addEventListener("click", doLogin);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
  }

  /* ═══════════════════════════════════════════════════════════════
     LOAD DRAFT + INITIALISE EDITOR
  ═══════════════════════════════════════════════════════════════ */
  function loadDraftAndInit() {
    fetch(FN + "/get-content?draft=1", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (content) {
        if (content) {
          draft = content;
          mergeDraftIntoGlobals(draft);
          ensureDraftComplete();
        } else {
          // No draft yet — seed one from current globals
          draft = buildDraftFromGlobals();
        }
        reRenderSite();
        showAdminChrome();
      })
      .catch(function () {
        draft = buildDraftFromGlobals();
        reRenderSite();
        showAdminChrome();
      });
  }

  /* Deep-merge draft content into window.* globals */
  function mergeDraftIntoGlobals(c) {
    if (!c) return;
    if (c.config)         deepMerge(window.SITE_CONFIG, c.config);
    if (c.translations)   deepMerge(window.TRANSLATIONS, c.translations);
    if (c.menuCategories) window.MENU_CATEGORIES = c.menuCategories;
    if (c.menuItems)      window.MENU_ITEMS       = c.menuItems;
    if (c.gallery)        window.GALLERY          = c.gallery;
    if (c.reviews)        window.REVIEWS          = c.reviews;
    if (c.seo && window.SEO_CONFIG) deepMerge(window.SEO_CONFIG, c.seo);
  }

  /* Build an initial draft snapshot from the current live globals */
  function buildDraftFromGlobals() {
    return {
      version:      0,
      updatedAt:    new Date().toISOString(),
      config:       JSON.parse(JSON.stringify(window.SITE_CONFIG)),
      translations: JSON.parse(JSON.stringify(window.TRANSLATIONS)),
      menuCategories: JSON.parse(JSON.stringify(window.MENU_CATEGORIES)),
      menuItems:    JSON.parse(JSON.stringify(window.MENU_ITEMS)),
      gallery:      JSON.parse(JSON.stringify(window.GALLERY)),
      reviews:      JSON.parse(JSON.stringify(window.REVIEWS)),
      seo:          window.SEO_CONFIG ? JSON.parse(JSON.stringify(window.SEO_CONFIG)) : {},
      nav: {
        logoEmoji: document.querySelector(".nav__logo-mark")
          ? document.querySelector(".nav__logo-mark").textContent.trim()
          : ((window.SITE_CONFIG && window.SITE_CONFIG.logo) || "🏠"),
        logoText:  document.querySelector(".nav__logo-text")
          ? document.querySelector(".nav__logo-text").textContent.trim()
          : ((window.SITE_CONFIG && window.SITE_CONFIG.name) || "Restaurant"),
      },
      visit: {
        address:       (document.querySelector(".visit__list li:first-child span") || {}).textContent || "",
        mapEmbedSrc:   (document.querySelector(".visit__map iframe") || {}).src || "",
        directionsHref:(document.querySelector(".visit__actions .btn--primary") || {}).href || "",
        whatsappHref:  (document.querySelector(".visit__actions .btn--whatsapp") || {}).href || "",
      },
      footer: {
        brandName: (document.querySelector(".footer__brand strong") || {}).textContent || "",
        address:   (document.querySelector(".footer__col span") || {}).textContent || "",
      },
      theme: readThemeFromPage(),
    };
  }

  /** Keep blob drafts complete when only a subsection (e.g. amenities) changed. */
  function ensureDraftComplete() {
    if (!draft) return;
    if (!draft.menuItems || !draft.menuItems.length) {
      draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS || []));
    }
    if (!draft.menuCategories || !draft.menuCategories.length) {
      draft.menuCategories = JSON.parse(JSON.stringify(window.MENU_CATEGORIES || []));
    }
    if (!draft.gallery || !draft.gallery.length) {
      draft.gallery = JSON.parse(JSON.stringify(window.GALLERY || []));
    }
    if (!draft.reviews || !draft.reviews.length) {
      draft.reviews = JSON.parse(JSON.stringify(window.REVIEWS || []));
    }
    if (!draft.config) {
      draft.config = JSON.parse(JSON.stringify(window.SITE_CONFIG || {}));
    }
    if (!draft.translations) {
      draft.translations = JSON.parse(JSON.stringify(window.TRANSLATIONS || {}));
    }
    if (!draft.seo && window.SEO_CONFIG) {
      draft.seo = JSON.parse(JSON.stringify(window.SEO_CONFIG));
    }
  }

  function readThemeFromPage() {
    var heroMedia = getComputedStyle(document.documentElement).getPropertyValue("--hero-media").trim();
    if (!heroMedia || heroMedia === 'url("")') return {};
    var matches = heroMedia.match(/url\(\s*["']?([^"')]+)["']?\s*\)/g);
    if (!matches || !matches.length) return {};
    var last = matches[matches.length - 1].match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
    return last && last[1] ? { heroUrl: last[1] } : {};
  }

  function setDraftTheme(key, value) {
    if (!draft.theme) draft.theme = {};
    draft.theme[key] = value;
    scheduleSave();
  }

  function applyHeroFromDraft() {
    if (!draft || !draft.theme || !Object.prototype.hasOwnProperty.call(draft.theme, "heroUrl")) return;
    var url = draft.theme.heroUrl;
    document.documentElement.style.setProperty(
      "--hero-media",
      url ? 'url("' + rootAssetUrl(url) + '")' : 'url("")'
    );
  }

  /** Sync phone + email from SITE_CONFIG to every data-fact node (visit + footer). */
  function applyContactFacts() {
    var cfg = window.SITE_CONFIG || {};
    var tel = cfg.telephoneDisplay || "";
    var mail = cfg.email_public || "";
    var hrefTel = cfg.telephoneHref ? "tel:+" + cfg.telephoneHref : "tel:+";
    var hrefMail = mail ? "mailto:" + mail : "mailto:";

    $$('[data-fact="tel"]').forEach(function (el) {
      el.textContent = tel;
      if (el.tagName === "A") el.href = hrefTel;
    });
    $$('[data-fact="email"]').forEach(function (el) {
      el.textContent = mail;
      if (el.tagName === "A") el.href = hrefMail;
    });
    if (window.SEO_CONFIG && tel) window.SEO_CONFIG.telephone = tel;
  }

  function setContactPhone(display) {
    var digits = display.replace(/\D/g, "");
    setDraftConfig("telephoneDisplay", display);
    setDraftConfig("telephoneHref", digits);
    window.SITE_CONFIG.telephoneDisplay = display;
    window.SITE_CONFIG.telephoneHref = digits;
    setDraftSeo("telephone", display);
    if (window.SEO_CONFIG) window.SEO_CONFIG.telephone = display;
    applyContactFacts();
  }

  function setContactEmail(email) {
    setDraftConfig("email", email);
    setDraftConfig("email_public", email);
    window.SITE_CONFIG.email = email;
    window.SITE_CONFIG.email_public = email;
    applyContactFacts();
  }

  /* Trigger app.js to re-render dynamic sections using merged globals */
  function reRenderSite() {
    if (window.I18N) window.I18N.apply();
    // languagechange event triggers renderTabs/renderMenu/renderReviews/renderCart in app.js
    document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
    // Gallery is not re-rendered by languagechange — handle separately
    renderGalleryAdmin();
    // Apply static DOM overrides from draft
    applyStaticDOMFromDraft();
    applyHeroFromDraft();
    applyContactFacts();
    if (window.renderAmenities) window.renderAmenities();
    fixRenderedAssetUrls();
  }

  function applyStaticDOMFromDraft() {
    if (!draft) return;
    if (draft.nav) {
      var logoMark = document.querySelector(".nav__logo-mark");
      var logoText = document.querySelector(".nav__logo-text");
      if (logoMark && draft.nav.logoEmoji) logoMark.textContent = draft.nav.logoEmoji;
      if (logoText && draft.nav.logoText)  logoText.textContent = draft.nav.logoText;
    }
    if (draft.visit) {
      var addrEl = document.querySelector(".visit__list li:first-child span");
      if (addrEl && draft.visit.address) addrEl.textContent = draft.visit.address;
      var mapEl  = document.querySelector(".visit__map iframe");
      if (mapEl && draft.visit.mapEmbedSrc) mapEl.src = draft.visit.mapEmbedSrc;
      var dirBtn = document.querySelector(".visit__actions .btn--primary");
      if (dirBtn && draft.visit.directionsHref) dirBtn.href = draft.visit.directionsHref;
      var waBtn  = document.querySelector(".visit__actions .btn--whatsapp");
      if (waBtn && draft.visit.whatsappHref) waBtn.href = draft.visit.whatsappHref;
    }
    if (draft.footer) {
      var fb = document.querySelector(".footer__brand strong");
      if (fb && draft.footer.brandName) fb.textContent = draft.footer.brandName;
      var fs = document.querySelector(".footer__col span");
      if (fs && draft.footer.address) fs.textContent = draft.footer.address;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     GALLERY RE-RENDER (app.js renderGallery is not accessible)
  ═══════════════════════════════════════════════════════════════ */
  function renderGalleryAdmin() {
    var grid = document.getElementById("galleryGrid");
    if (!grid) return;
    grid.innerHTML = "";
    (window.GALLERY || []).forEach(function (tile, i) {
      var div = document.createElement("div");
      div.className = "gallery__item";
      div.setAttribute("data-admin-item", "gallery-" + i);
      if (tile.type === "image" && tile.url) {
        div.innerHTML = '<img src="' + escHtml(rootAssetUrl(tile.url)) + '" alt="' + escHtml((tile.alt && tile.alt[LANG()]) || "") + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">';
      } else {
        div.style.background = "var(--c-surface-alt)";
      }
      grid.appendChild(div);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ADMIN CHROME
  ═══════════════════════════════════════════════════════════════ */
  function showAdminChrome() {
    hide("adminLoading");
    show("adminBar");
    injectEditButtons();
    bindAdminBar();
    setStatus("Draft loaded — click ✎ to edit any section");
  }

  function bindAdminBar() {
    el("adminPublishBtn").addEventListener("click", doPublish);
    el("adminDiscardBtn").addEventListener("click", doDiscard);
    el("adminPreviewBtn").addEventListener("click", function () { window.open("/", "_blank"); });
    el("adminLogoutBtn").addEventListener("click", doLogout);
    el("adminPanelClose").addEventListener("click", closePanel);
    el("adminPanelOverlay").addEventListener("click", closePanel);
  }

  /* ═══════════════════════════════════════════════════════════════
     INJECT EDIT BUTTONS
  ═══════════════════════════════════════════════════════════════ */
  var SECTIONS = [
    { attr: "nav",        label: "✎ Edit NAV",        handler: openNavEditor },
    { attr: "hero",       label: "✎ Edit HERO",       handler: openHeroEditor },
    { attr: "highlights", label: "✎ Edit HIGHLIGHTS", handler: openHighlightsEditor },
    { attr: "menu",       label: "✎ Edit MENU",       handler: openMenuEditor },
    { attr: "gallery",    label: "✎ Edit GALLERY",    handler: openGalleryEditor },
    { attr: "amenities",  label: "✎ Edit AMENITIES",  handler: openAmenitiesEditor },
    { attr: "reviews",    label: "✎ Edit REVIEWS",    handler: openReviewsEditor },
    { attr: "reserve",    label: "✎ Edit RESERVE",    handler: openReserveEditor },
    { attr: "visit",      label: "✎ Edit VISIT",      handler: openVisitEditor },
    { attr: "footer",     label: "✎ Edit FOOTER",     handler: openFooterEditor },
  ];

  var _globalSettingsBtn = null;

  function injectEditButtons() {
    // Section-level ✎ buttons
    SECTIONS.forEach(function (s) {
      var sectionEl = document.querySelector('[data-admin-section="' + s.attr + '"]');
      if (!sectionEl) return;
      // Remove any existing button
      var old = sectionEl.querySelector(".edit-trigger--section");
      if (old) old.remove();

      var btn = document.createElement("button");
      btn.className   = "edit-trigger edit-trigger--section";
      btn.textContent = s.label;
      btn.type        = "button";
      btn.addEventListener("click", function (e) { e.stopPropagation(); s.handler(); });
      sectionEl.appendChild(btn);
    });

    // Global Settings button in the admin bar
    if (!_globalSettingsBtn) {
      _globalSettingsBtn = document.createElement("button");
      _globalSettingsBtn.className   = "admin-bar__btn admin-bar__btn--discard";
      _globalSettingsBtn.textContent = "⚙ Settings";
      _globalSettingsBtn.addEventListener("click", openSettingsEditor);
      el("adminBar").insertBefore(_globalSettingsBtn, el("adminPreviewBtn"));
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PANEL SYSTEM
  ═══════════════════════════════════════════════════════════════ */
  function openPanel(title, bodyHtml, footerHtml) {
    el("adminPanelTitle").textContent = title;
    el("adminPanelBody").innerHTML    = bodyHtml;
    el("adminPanelFooter").innerHTML  = footerHtml || "";
    el("adminPanel").classList.add("is-open");
    el("adminPanelOverlay").classList.add("is-open");
  }

  function closePanel() {
    el("adminPanel").classList.remove("is-open");
    el("adminPanelOverlay").classList.remove("is-open");
  }

  /* ═══════════════════════════════════════════════════════════════
     HELPERS: BILINGUAL FIELD
  ═══════════════════════════════════════════════════════════════ */
  function bilingualField(labelText, keyEn, keyVi, currentEn, currentVi, onChangeEn, onChangeVi) {
    var id = "bf_" + Math.random().toString(36).slice(2);
    return '<div class="admin-field"><label>' + escHtml(labelText) + '</label>'
      + '<div class="admin-field--bilingual">'
      + '<div class="admin-field"><span class="admin-lang-label">EN</span>'
      + '<textarea id="' + id + '_en" rows="2">' + escHtml(currentEn || "") + '</textarea></div>'
      + '<div class="admin-field"><span class="admin-lang-label">VI</span>'
      + '<textarea id="' + id + '_vi" rows="2">' + escHtml(currentVi || "") + '</textarea></div>'
      + '</div></div>';
  }

  function bindBilingual(id, onChangeEn, onChangeVi) {
    var enEl = document.getElementById(id + "_en");
    var viEl = document.getElementById(id + "_vi");
    if (enEl) enEl.addEventListener("input", function () { onChangeEn(enEl.value); });
    if (viEl) viEl.addEventListener("input", function () { onChangeVi(viEl.value); });
  }

  /* Shorthand for a single bilingual i18n key pair */
  function i18nField(label, key, bodyEl) {
    var id = "i18n_" + key.replace(/\./g, "_");
    var enVal = (draft.translations || {}).en && draft.translations.en[key] !== undefined
      ? draft.translations.en[key] : (window.TRANSLATIONS.en[key] || "");
    var viVal = (draft.translations || {}).vi && draft.translations.vi[key] !== undefined
      ? draft.translations.vi[key] : (window.TRANSLATIONS.vi[key] || "");

    var html = '<div class="admin-field"><label>' + escHtml(label) + '</label>'
      + '<div class="admin-field--bilingual">'
      + '<div class="admin-field"><span class="admin-lang-label">EN</span>'
      + '<textarea id="' + id + '_en" rows="2">' + escHtml(enVal) + '</textarea></div>'
      + '<div class="admin-field"><span class="admin-lang-label">VI</span>'
      + '<textarea id="' + id + '_vi" rows="2">' + escHtml(viVal) + '</textarea></div>'
      + '</div></div>';

    bodyEl.insertAdjacentHTML("beforeend", html);

    document.getElementById(id + "_en").addEventListener("input", function () {
      setDraftI18n("en", key, this.value);
      window.TRANSLATIONS.en[key] = this.value;
      if (window.I18N) window.I18N.apply();
    });
    document.getElementById(id + "_vi").addEventListener("input", function () {
      setDraftI18n("vi", key, this.value);
      window.TRANSLATIONS.vi[key] = this.value;
      if (window.I18N) window.I18N.apply();
    });
  }

  function setDraftI18n(lang, key, value) {
    if (!draft.translations) draft.translations = { en: {}, vi: {} };
    if (!draft.translations[lang]) draft.translations[lang] = {};
    draft.translations[lang][key] = value;
    scheduleSave();
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION EDITORS
  ═══════════════════════════════════════════════════════════════ */

  /* ── Global Settings ──────────────────────────────────────────── */
  function openSettingsEditor() {
    var cfg = draft.config || {};
    var cur = draft.config && draft.config.currency ? draft.config.currency : (window.SITE_CONFIG.currency || {});

    openPanel("⚙️ Global Settings", "", "");
    var body = el("adminPanelBody");

    // Business info
    addDivider(body, "Business Info");
    addTextField(body, "Restaurant name", cfg.name || window.SITE_CONFIG.name, function (v) {
      setDraftConfig("name", v);
      window.SITE_CONFIG.name = v;
      var fb = document.querySelector(".footer__brand strong");
      if (fb) fb.textContent = v;
    });

    addDivider(body, "Contact — site-wide");
    addTextField(body, "Phone number (shown on Visit + footer)", cfg.telephoneDisplay || window.SITE_CONFIG.telephoneDisplay || "", function (v) {
      setContactPhone(v);
    });
    addTextField(body, "Email (bookings, orders + shown on site)", cfg.email || window.SITE_CONFIG.email || cfg.email_public || window.SITE_CONFIG.email_public || "", function (v) {
      setContactEmail(v.trim());
    });
    var contactNote = document.createElement("div");
    contactNote.className = "admin-note admin-note--info";
    contactNote.textContent = "Phone and email update everywhere at once — Visit section, footer, and order/reservation notifications (Web3Forms).";
    body.appendChild(contactNote);

    addTextField(body, "WhatsApp (digits only)", cfg.whatsapp || window.SITE_CONFIG.whatsapp, function (v) {
      setDraftConfig("whatsapp", v.replace(/\D/g, ""));
    });
    addTextField(body, "Zalo (digits only)", cfg.zalo || window.SITE_CONFIG.zalo, function (v) {
      setDraftConfig("zalo", v.replace(/\D/g, ""));
    });

    // Currency
    addDivider(body, "Currency");
    addTextField(body, "Currency code (e.g. VND, USD)", cur.code || "VND", function (v) {
      setDraftCurrency("code", v);
    });
    addTextField(body, "Symbol (e.g. ₫, $, €)", cur.symbol || "₫", function (v) {
      setDraftCurrency("symbol", v);
      window.SITE_CONFIG.currency.symbol = v;
      refreshPreviews();
    });
    addSelectField(body, "Symbol position", [["after","After number (50,000 ₫)"],["before","Before number ($50)"]], cur.position || "after", function (v) {
      setDraftCurrency("position", v);
      window.SITE_CONFIG.currency.position = v;
      refreshPreviews();
    });
    addNumberField(body, "Decimal places (0–3)", cur.decimals !== undefined ? cur.decimals : 0, 0, 3, function (v) {
      setDraftCurrency("decimals", parseInt(v, 10));
      window.SITE_CONFIG.currency.decimals = parseInt(v, 10);
      refreshPreviews();
    });

    // Live currency preview
    var prev = document.createElement("div");
    prev.id = "currencyPreview";
    prev.className = "admin-note admin-note--info";
    prev.textContent = "Preview: " + money(99000);
    body.appendChild(prev);

    // SEO & Social — powers the Google/AI listing + share previews.
    addDivider(body, "SEO & Social");
    var seoCur = draft.seo || {};
    var liveSeo = window.SEO_CONFIG || {};

    // Share image (og:image / schema image)
    var curOg = seoCur.ogImage || liveSeo.ogImage || "";
    var imgWrap = document.createElement("div");
    imgWrap.className = "admin-image-field";
    imgWrap.innerHTML = '<label>Share image (Google / social / AI)</label>' +
      (curOg
        ? '<div class="admin-image-preview"><img src="' + escHtml(rootAssetUrl(curOg)) + '" alt="share"></div>'
        : '<div class="admin-image-preview" style="font-size:13px;color:#94a3b8">No share image yet</div>') +
      '<div class="admin-image-actions"><label class="admin-btn admin-btn--primary">' +
      (curOg ? "Replace image" : "Upload image") +
      '<input type="file" id="seoOgFile" accept="image/*"></label></div>' +
      '<div class="admin-image-progress" id="seoOgProgress"></div>';
    body.appendChild(imgWrap);
    var ogFile = document.getElementById("seoOgFile");
    if (ogFile) ogFile.addEventListener("change", function () {
      if (!ogFile.files[0]) return;
      uploadImage(ogFile.files[0], "seoOgProgress", function (url) {
        setDraftSeo("ogImage", url);
        if (window.SEO_CONFIG) window.SEO_CONFIG.ogImage = url;
        openSettingsEditor();
      });
    });

    // Profiles (sameAs) — one URL per line
    var profWrap = document.createElement("div");
    profWrap.className = "admin-field";
    var sameAs = (seoCur.sameAs && seoCur.sameAs.length ? seoCur.sameAs : (liveSeo.sameAs || [])).join("\n");
    profWrap.innerHTML = '<label>Profiles — one URL per line (Google Business, TripAdvisor, Yelp, Facebook, Instagram)</label>' +
      '<textarea id="seoSameAs" rows="4" placeholder="https://www.google.com/maps/place/...">' + escHtml(sameAs) + "</textarea>";
    body.appendChild(profWrap);
    document.getElementById("seoSameAs").addEventListener("input", function () {
      var arr = this.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      setDraftSeo("sameAs", arr);
      if (window.SEO_CONFIG) window.SEO_CONFIG.sameAs = arr;
    });

    addTextField(body, "Price range (e.g. $, $$, $$$)", seoCur.priceRange || liveSeo.priceRange || "", function (v) {
      setDraftSeo("priceRange", v);
      if (window.SEO_CONFIG) window.SEO_CONFIG.priceRange = v;
    });

    var seoNote = document.createElement("div");
    seoNote.className = "admin-note admin-note--info";
    seoNote.textContent = "These power your Google/AI listing. Amenities are edited under ✎ Edit AMENITIES on the page.";
    body.appendChild(seoNote);
  }

  function setDraftSeo(key, value) {
    if (!draft.seo) draft.seo = {};
    draft.seo[key] = value;
    scheduleSave();
  }

  /* ── AMENITIES ─────────────────────────────────────────────────── */
  var AMENITY_ICON_PRESETS = [
    "🍽️", "☕", "🍺", "🍷", "🎵", "📺", "🎂", "🌿", "♿", "🅿️", "🛵", "🐕",
    "📶", "💻", "🔌", "🌳", "❄️", "🚿", "👨‍👩‍👧", "🛝", "🪑", "🍼", "🏊", "🚭",
    "🎉", "🎤", "🖼️", "📷", "💳", "🚻", "⭐", "✨",
  ];

  function getEnabledAmenityKeys() {
    var seoCur = draft.seo || {};
    var live = window.SEO_CONFIG || {};
    return (seoCur.amenities && seoCur.amenities.length ? seoCur.amenities : (live.amenities || [])).slice();
  }

  function getCustomAmenities() {
    var seoCur = draft.seo || {};
    var live = window.SEO_CONFIG || {};
    return (seoCur.customAmenities && seoCur.customAmenities.length
      ? seoCur.customAmenities
      : (live.customAmenities || [])).slice();
  }

  function normalizeAmenityKeys(enabled) {
    var catalog = (window.RenderCore && window.RenderCore.AMENITIES_CATALOG) || [];
    var custom = getCustomAmenities();
    var catKeys = catalog.filter(function (c) { return enabled.indexOf(c.key) !== -1; }).map(function (c) { return c.key; });
    var customKeys = custom.filter(function (c) { return enabled.indexOf(c.id) !== -1; }).map(function (c) { return c.id; });
    return catKeys.concat(customKeys);
  }

  function persistAmenities(enabledKeys) {
    var next = normalizeAmenityKeys(enabledKeys);
    setDraftSeo("amenities", next);
    if (!draft.seo.customAmenities) {
      draft.seo.customAmenities = getCustomAmenities().slice();
    }
    if (window.SEO_CONFIG) {
      window.SEO_CONFIG.amenities = next;
      window.SEO_CONFIG.customAmenities = getCustomAmenities().slice();
    }
    if (window.renderAmenities) window.renderAmenities();
  }

  function setCustomAmenities(list) {
    if (!draft.seo) draft.seo = {};
    draft.seo.customAmenities = list;
    if (window.SEO_CONFIG) window.SEO_CONFIG.customAmenities = list.slice();
    scheduleSave();
  }

  function toggleCatalogAmenity(key, checked) {
    var enabled = getEnabledAmenityKeys();
    var i = enabled.indexOf(key);
    if (checked && i === -1) enabled.push(key);
    else if (!checked && i !== -1) enabled.splice(i, 1);
    persistAmenities(enabled);
  }

  function openAmenitiesEditor() {
    openPanel("AMENITIES — Good to know", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Section headings");
    i18nField("Eyebrow", "amenities.eyebrow", body);
    i18nField("Title", "amenities.title", body);

    var catalog = (window.RenderCore && window.RenderCore.AMENITIES_CATALOG) || [];
    var groups = (window.RenderCore && window.RenderCore.AMENITY_GROUPS) || [];
    var enabled = getEnabledAmenityKeys();

    if (catalog.length) {
      addDivider(body, "Standard amenities");
      var stdNote = document.createElement("div");
      stdNote.className = "admin-note admin-note--info";
      stdNote.textContent = "Tick only what is genuinely true for your venue. These appear on the site, in Google structured data, and in AI listings.";
      body.appendChild(stdNote);

      groups.forEach(function (g) {
        var inGroup = catalog.filter(function (a) { return a.group === g.id; });
        if (!inGroup.length) return;
        var gTitle = document.createElement("div");
        gTitle.className = "admin-amenity-group-title";
        gTitle.textContent = LANG() === "vi" ? g.vi : g.en;
        body.appendChild(gTitle);

        var amWrap = document.createElement("div");
        amWrap.className = "admin-field admin-amenities";
        inGroup.forEach(function (a) {
          var id = "amen_" + a.key;
          var lab = document.createElement("label");
          lab.className = "admin-amenity";
          lab.setAttribute("for", id);
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.id = id;
          cb.checked = enabled.indexOf(a.key) !== -1;
          cb.addEventListener("change", function () {
            toggleCatalogAmenity(a.key, cb.checked);
          });
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(" " + a.icon + " " + (LANG() === "vi" ? a.vi : a.en)));
          amWrap.appendChild(lab);
        });
        body.appendChild(amWrap);
      });
    }

    addDivider(body, "Custom amenities");
    var customNote = document.createElement("div");
    customNote.className = "admin-note admin-note--info";
    customNote.textContent = "Add anything not in the list above — pick an icon, name it, and choose a category.";
    body.appendChild(customNote);
    renderCustomAmenityList(body);

    var addBtn = document.createElement("button");
    addBtn.className = "admin-btn admin-btn--ghost";
    addBtn.textContent = "+ Add custom amenity";
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { openCustomAmenityEditor(null, body); });
    body.appendChild(addBtn);
  }

  function renderCustomAmenityList(body) {
    var listId = "adminCustomAmenityList";
    var existing = document.getElementById(listId);
    if (existing) existing.remove();

    var custom = getCustomAmenities();
    if (!custom.length) return;

    var wrap = document.createElement("div");
    wrap.id = listId;
    wrap.className = "admin-list";
    custom.forEach(function (item, i) {
      var groupLabel = "";
      var groups = (window.RenderCore && window.RenderCore.AMENITY_GROUPS) || [];
      var g = groups.find(function (x) { return x.id === item.group; });
      if (g) groupLabel = LANG() === "vi" ? g.vi : g.en;

      var row = document.createElement("div");
      row.className = "admin-list-item";
      row.innerHTML = '<span style="font-size:18px;flex-shrink:0">' + escHtml(item.icon || "✨") + "</span>"
        + '<span class="admin-list-item__label">' + escHtml(item.en || item.id)
        + (groupLabel ? ' <span style="color:#94a3b8;font-size:11px">(' + escHtml(groupLabel) + ")</span>" : "")
        + "</span>"
        + '<div class="admin-list-item__actions">'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" title="Edit" data-ei="' + i + '">✎</button>'
        + '<button class="admin-btn admin-btn--danger admin-btn--icon" title="Delete" data-di="' + i + '">🗑</button>'
        + "</div>";
      row.querySelector("[data-ei]").addEventListener("click", function (e) {
        e.stopPropagation();
        openCustomAmenityEditor(i, body);
      });
      row.querySelector("[data-di]").addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("Remove custom amenity \"" + (item.en || item.id) + "\"?")) return;
        var nextCustom = getCustomAmenities().filter(function (_, j) { return j !== i; });
        var enabled = getEnabledAmenityKeys().filter(function (k) { return k !== item.id; });
        setCustomAmenities(nextCustom);
        persistAmenities(enabled);
        openAmenitiesEditor();
      });
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  }

  function openCustomAmenityEditor(index, listBody) {
    var custom = getCustomAmenities();
    var item = index != null ? custom[index] : null;
    var isNew = item == null;
    var selectedIcon = (item && item.icon) || "✨";

    var groupOptions = (window.RenderCore && window.RenderCore.AMENITY_GROUPS) || [];
    var groupSelect = groupOptions.map(function (g) {
      var sel = item && item.group === g.id ? " selected" : "";
      return '<option value="' + escHtml(g.id) + '"' + sel + ">" + escHtml(g.en) + "</option>";
    }).join("");

    var iconBtns = AMENITY_ICON_PRESETS.map(function (ic) {
      var sel = ic === selectedIcon ? " is-selected" : "";
      return '<button type="button" class="admin-icon-pick' + sel + '" data-icon="' + escHtml(ic) + '">' + ic + "</button>";
    }).join("");

    openPanel(isNew ? "New custom amenity" : "Edit custom amenity",
      '<div class="admin-section-divider">Icon</div>'
      + '<div class="admin-icon-picker" id="customAmenIconPick">' + iconBtns + "</div>"
      + '<div class="admin-field"><label>Name (English)</label>'
      + '<input type="text" id="customAmenEn" value="' + escHtml(item ? item.en : "") + '"></div>'
      + '<div class="admin-field"><label>Name (Vietnamese)</label>'
      + '<input type="text" id="customAmenVi" value="' + escHtml(item ? (item.vi || "") : "") + '"></div>'
      + '<div class="admin-field"><label>Category</label>'
      + '<select id="customAmenGroup">' + groupSelect + "</select></div>",
      "");

    $$("#customAmenIconPick .admin-icon-pick").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedIcon = btn.getAttribute("data-icon");
        $$("#customAmenIconPick .admin-icon-pick").forEach(function (b) {
          b.classList.toggle("is-selected", b === btn);
        });
      });
    });

    var footer = el("adminPanelFooter");
    footer.innerHTML = '<button type="button" class="admin-btn admin-btn--primary" id="customAmenSave">Save amenity</button>';
    document.getElementById("customAmenSave").addEventListener("click", function () {
      var en = val("customAmenEn").trim();
      if (!en) {
        alert("Please enter a name for the amenity.");
        return;
      }
      var vi = val("customAmenVi").trim() || en;
      var group = val("customAmenGroup") || (groupOptions[0] && groupOptions[0].id) || "comfort";
      var entry = {
        id: item ? item.id : ("custom_" + Date.now()),
        icon: selectedIcon,
        group: group,
        en: en,
        vi: vi,
      };
      var nextCustom = getCustomAmenities().slice();
      if (isNew) {
        nextCustom.push(entry);
      } else {
        nextCustom[index] = entry;
      }
      setCustomAmenities(nextCustom);
      var enabled = getEnabledAmenityKeys();
      if (enabled.indexOf(entry.id) === -1) enabled.push(entry.id);
      persistAmenities(enabled);
      closePanel();
      openAmenitiesEditor();
    });
  }

  function setDraftConfig(key, value) {
    if (!draft.config) draft.config = {};
    draft.config[key] = value;
    scheduleSave();
  }

  function setDraftCurrency(key, value) {
    if (!draft.config) draft.config = {};
    if (!draft.config.currency) draft.config.currency = Object.assign({}, window.SITE_CONFIG.currency);
    draft.config.currency[key] = value;
    scheduleSave();
  }

  function refreshPreviews() {
    var prev = document.getElementById("currencyPreview");
    if (prev) prev.textContent = "Preview: " + money(99000);
    // Trigger menu re-render to show new currency
    document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
  }

  /* ── NAV ─────────────────────────────────────────────────────── */
  function openNavEditor() {
    openPanel("NAV — Logo & Links", "", "");
    var body = el("adminPanelBody");
    var nav = draft.nav || {};

    addDivider(body, "Logo");
    addTextField(body, "Logo emoji", nav.logoEmoji || (window.SITE_CONFIG && window.SITE_CONFIG.logo) || "🏠", function (v) {
      if (!draft.nav) draft.nav = {};
      draft.nav.logoEmoji = v;
      var m = document.querySelector(".nav__logo-mark");
      if (m) m.textContent = v;
      scheduleSave();
    });
    addTextField(body, "Logo text", nav.logoText || (window.SITE_CONFIG && window.SITE_CONFIG.name) || "Restaurant", function (v) {
      if (!draft.nav) draft.nav = {};
      draft.nav.logoText = v;
      var t = document.querySelector(".nav__logo-text");
      if (t) t.textContent = v;
      scheduleSave();
    });

    addDivider(body, "Nav link labels");
    i18nField("Menu link", "nav.menu", body);
    i18nField("Gallery link", "nav.gallery", body);
    i18nField("Visit link", "nav.visit", body);
    i18nField("Reserve button", "nav.reserve", body);
  }

  /* ── HERO ────────────────────────────────────────────────────── */
  function openHeroEditor() {
    openPanel("HERO — Banner Section", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Text");
    i18nField("Eyebrow (small text above title)", "hero.eyebrow", body);
    i18nField("Title (H1)", "hero.title", body);
    i18nField("Subtitle", "hero.subtitle", body);
    addDivider(body, "CTA Buttons");
    i18nField("Primary button (View menu)", "hero.viewMenu", body);
    i18nField("Secondary button (Book a table)", "hero.book", body);
    addDivider(body, "Badges");
    i18nField("Reviews badge", "hero.badgeReviews", body);
    i18nField("Vegetarian badge", "hero.badgeVeg", body);
    i18nField("Hours badge", "hero.badgeOpen", body);

    addDivider(body, "Hero background photo");
    var curHero = (draft.theme && draft.theme.heroUrl) || "";
    var heroWrap = document.createElement("div");
    heroWrap.className = "admin-image-field";
    heroWrap.innerHTML = "<label>Banner image</label>"
      + (curHero
        ? '<div class="admin-image-preview"><img src="' + escHtml(rootAssetUrl(curHero)) + '" alt="hero"></div>'
        : '<div class="admin-image-preview" style="font-size:13px;color:#94a3b8">No hero photo — gradient only</div>')
      + '<div class="admin-image-actions"><label class="admin-btn admin-btn--primary">'
      + (curHero ? "Replace photo" : "Upload photo")
      + '<input type="file" id="heroImageFile" accept="image/*"></label>'
      + (curHero ? '<button type="button" class="admin-btn admin-btn--danger" id="heroImageRemove">Remove</button>' : "")
      + "</div>"
      + '<p class="admin-note admin-note--info" style="margin-top:6px">Recommended: <strong>1920 × 1080 px (16:9)</strong> · Auto-compressed · Max 3 MB</p>'
      + '<div class="admin-image-progress" id="heroImageProgress"></div>';
    body.appendChild(heroWrap);

    var heroFile = document.getElementById("heroImageFile");
    if (heroFile) heroFile.addEventListener("change", function () {
      if (!heroFile.files[0]) return;
      uploadImage(heroFile.files[0], "heroImageProgress", function (url) {
        setDraftTheme("heroUrl", url);
        applyHeroFromDraft();
        openHeroEditor();
      });
    });
    var heroRemove = document.getElementById("heroImageRemove");
    if (heroRemove) heroRemove.addEventListener("click", function () {
      if (!draft.theme) draft.theme = {};
      draft.theme.heroUrl = "";
      applyHeroFromDraft();
      scheduleSave();
      openHeroEditor();
    });
  }

  /* ── HIGHLIGHTS ──────────────────────────────────────────────── */
  function openHighlightsEditor() {
    openPanel("HIGHLIGHTS — 3 Feature Cards", "", "");
    var body = el("adminPanelBody");
    var cards = [
      { icon: "highlight__icon", emojiKey: "highlight-icon-0", titleKey: "highlight.fresh.title", textKey: "highlight.fresh.text", label: "Card 1" },
      { icon: "highlight__icon", emojiKey: "highlight-icon-1", titleKey: "highlight.recipes.title", textKey: "highlight.recipes.text", label: "Card 2" },
      { icon: "highlight__icon", emojiKey: "highlight-icon-2", titleKey: "highlight.friendly.title", textKey: "highlight.friendly.text", label: "Card 3" },
    ];
    var icons = Array.from(document.querySelectorAll(".highlight__icon"));
    var dnav = draft.nav || {};

    cards.forEach(function (c, i) {
      addDivider(body, c.label);
      var currentEmoji = icons[i] ? icons[i].textContent.trim() : "✨";
      addTextField(body, "Icon emoji", currentEmoji, function (v) {
        if (icons[i]) icons[i].textContent = v;
        if (!draft.highlights) draft.highlights = [{},{},{}];
        draft.highlights[i] = draft.highlights[i] || {};
        draft.highlights[i].emoji = v;
        scheduleSave();
      });
      i18nField("Title", c.titleKey, body);
      i18nField("Text", c.textKey, body);
    });
  }

  /* ── MENU ────────────────────────────────────────────────────── */
  function openMenuEditor() {
    openPanel("MENU — Categories & Dishes", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Section headings");
    i18nField("Eyebrow", "menu.eyebrow", body);
    i18nField("Title", "menu.title", body);
    i18nField("Lead text", "menu.lead", body);

    addDivider(body, "Categories");
    renderCategoryList(body);

    addDivider(body, "Dishes");
    renderDishList(body);
  }

  function renderCategoryList(body) {
    var listId = "adminCatList";
    var existing = document.getElementById(listId);
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.id = listId;

    var addBtn = document.createElement("button");
    addBtn.className = "admin-btn admin-btn--ghost";
    addBtn.textContent = "+ Add category";
    addBtn.style.marginBottom = "8px";
    addBtn.addEventListener("click", function () {
      var id = prompt("Category ID (no spaces, e.g. desserts):");
      if (!id || !id.trim()) return;
      id = id.trim().toLowerCase().replace(/\s+/g, "-");
      if (window.MENU_CATEGORIES.find(function (c) { return c.id === id; })) {
        alert("Category ID already exists.");
        return;
      }
      var nameEn = prompt("Category name (English):");
      var nameVi = prompt("Category name (Vietnamese):");
      var newCat = { id: id, name: { en: nameEn || id, vi: nameVi || id } };
      window.MENU_CATEGORIES.push(newCat);
      draft.menuCategories = JSON.parse(JSON.stringify(window.MENU_CATEGORIES));
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      scheduleSave();
      renderCategoryList(body);
    });
    wrap.appendChild(addBtn);

    var list = document.createElement("div");
    list.className = "admin-list";
    window.MENU_CATEGORIES.forEach(function (cat, i) {
      var item = document.createElement("div");
      item.className = "admin-list-item";
      item.innerHTML = '<span class="admin-list-item__label">' + escHtml(cat.name[LANG()] || cat.name.en) + '</span>'
        + '<span style="font-size:11px;color:#94a3b8;margin-right:4px;">' + escHtml(cat.id) + '</span>'
        + '<div class="admin-list-item__actions">'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" title="Edit" data-ci="' + i + '">✎</button>'
        + '<button class="admin-btn admin-btn--danger admin-btn--icon" title="Delete" data-di="' + i + '">🗑</button>'
        + '</div>';
      item.querySelector('[data-ci]').addEventListener("click", function (e) { e.stopPropagation(); editCategory(i); });
      item.querySelector('[data-di]').addEventListener("click", function (e) {
        e.stopPropagation();
        var usedBy = (window.MENU_ITEMS || []).filter(function (m) { return m.cat === cat.id; }).length;
        if (usedBy > 0 && !confirm("This category has " + usedBy + " dish(es). Delete anyway?")) return;
        window.MENU_CATEGORIES.splice(i, 1);
        draft.menuCategories = JSON.parse(JSON.stringify(window.MENU_CATEGORIES));
        document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
        scheduleSave();
        renderCategoryList(body);
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  function editCategory(i) {
    var cat    = window.MENU_CATEGORIES[i];
    var nameEn = prompt("Category name (English):", cat.name.en);
    if (nameEn === null) return;
    var nameVi = prompt("Category name (Vietnamese):", cat.name.vi || "");
    window.MENU_CATEGORIES[i].name.en = nameEn;
    window.MENU_CATEGORIES[i].name.vi = nameVi || nameEn;
    draft.menuCategories = JSON.parse(JSON.stringify(window.MENU_CATEGORIES));
    document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
    scheduleSave();
  }

  function renderDishList(body) {
    var listId = "adminDishList";
    var existing = document.getElementById(listId);
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.id = listId;

    var addBtn = document.createElement("button");
    addBtn.className = "admin-btn admin-btn--ghost";
    addBtn.textContent = "+ Add dish";
    addBtn.style.marginBottom = "8px";
    addBtn.addEventListener("click", function () {
      var newDish = {
        id:    "dish-" + Date.now(),
        cat:   window.MENU_CATEGORIES[0] ? window.MENU_CATEGORIES[0].id : "popular",
        price: 0,
        emoji: "🍽️",
        tags:  [],
        name:  { en: "New dish", vi: "Món mới" },
        desc:  { en: "", vi: "" },
      };
      window.MENU_ITEMS.push(newDish);
      draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      scheduleSave();
      renderDishList(body);
      openDishEditor(window.MENU_ITEMS.length - 1);
    });
    wrap.appendChild(addBtn);

    var list = document.createElement("div");
    list.className = "admin-list";
    (window.MENU_ITEMS || []).forEach(function (dish, i) {
      var item = document.createElement("div");
      item.className = "admin-list-item";
      item.innerHTML = '<span style="font-size:18px;flex-shrink:0">' + escHtml(dish.emoji || "🍽️") + '</span>'
        + '<span class="admin-list-item__label">' + escHtml((dish.name && dish.name[LANG()]) || dish.name.en) + '</span>'
        + '<span class="admin-list-item__price">' + money(dish.price) + '</span>'
        + '<div class="admin-list-item__actions">'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" title="Edit" data-ei="' + i + '">✎</button>'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" title="Duplicate" data-dupi="' + i + '">⧉</button>'
        + '<button class="admin-btn admin-btn--danger admin-btn--icon" title="Delete" data-deli="' + i + '">🗑</button>'
        + '</div>';
      item.querySelector('[data-ei]').addEventListener("click",   function (e) { e.stopPropagation(); openDishEditor(i); });
      item.querySelector('[data-dupi]').addEventListener("click", function (e) {
        e.stopPropagation();
        var copy = JSON.parse(JSON.stringify(dish));
        copy.id  = dish.id + "-copy-" + Date.now();
        copy.name = { en: copy.name.en + " (copy)", vi: copy.name.vi + " (bản sao)" };
        window.MENU_ITEMS.splice(i + 1, 0, copy);
        draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
        document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
        scheduleSave();
        renderDishList(body);
      });
      item.querySelector('[data-deli]').addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("Delete \"" + (dish.name.en) + "\"?")) return;
        window.MENU_ITEMS.splice(i, 1);
        draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
        document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
        scheduleSave();
        renderDishList(body);
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  function openDishEditor(i) {
    var dish = window.MENU_ITEMS[i];
    if (!dish) return;

    openPanel("Dish: " + (dish.name.en || ""), buildDishEditorHTML(dish, i), "");
    bindDishEditor(i);
  }

  var ALL_TAGS = ["veg","spicy","popular","new"];

  function buildDishEditorHTML(dish, i) {
    var html = "";

    // Name (bilingual)
    html += '<div class="admin-section-divider">Name</div>'
      + bilingual2("Name EN", dish.name.en, "dishNameEn", "Name VI", dish.name.vi, "dishNameVi");

    // Description (bilingual)
    html += '<div class="admin-section-divider">Description</div>'
      + bilingual2("Desc EN", dish.desc ? dish.desc.en : "", "dishDescEn", "Desc VI", dish.desc ? dish.desc.vi : "", "dishDescVi");

    // Price
    html += '<div class="admin-section-divider">Price</div>'
      + '<div class="admin-price-row">'
      + '<div class="admin-field"><label>Price (number only)</label>'
      + '<input type="number" id="dishPrice" value="' + (dish.price || 0) + '" min="0" step="1000"></div>'
      + '<div class="admin-price-preview" id="dishPricePreview">' + money(dish.price) + '</div>'
      + '</div>';

    // Category
    var catOptions = (window.MENU_CATEGORIES || []).map(function (c) {
      return '<option value="' + escHtml(c.id) + '"' + (c.id === dish.cat ? " selected" : "") + '>'
        + escHtml(c.name.en) + '</option>';
    }).join("");
    html += '<div class="admin-field"><label>Category</label>'
      + '<select id="dishCat">' + catOptions + '</select></div>';

    // Tags
    html += '<div class="admin-section-divider">Tags</div><div class="admin-tags" id="dishTags">';
    ALL_TAGS.forEach(function (tag) {
      var checked = (dish.tags || []).indexOf(tag) !== -1;
      html += '<label class="admin-tag-option' + (checked ? " is-checked" : "") + '">'
        + '<input type="checkbox" value="' + tag + '"' + (checked ? " checked" : "") + '> '
        + tag + '</label>';
    });
    html += '</div>';

    // Photo
    html += '<div class="admin-section-divider">Photo</div>';
    if (dish.image) {
      html += '<div class="admin-image-preview"><img src="' + escHtml(rootAssetUrl(dish.image)) + '" alt="dish"></div>';
    } else {
      html += '<div class="admin-image-preview" style="font-size:13px;color:#94a3b8">No photo yet</div>';
    }
    html += '<div class="admin-image-actions">'
      + '<label class="admin-btn admin-btn--primary">' + (dish.image ? "Replace photo" : "Upload photo") + '<input type="file" id="dishImageFile" accept="image/*"></label>';
    if (dish.image) {
      html += '<button class="admin-btn admin-btn--danger" id="dishImageRemove">Remove</button>';
    }
    html += '</div>'
      + '<p class="admin-note admin-note--info" style="margin-top:6px">Recommended: <strong>800 × 600 px (4:3)</strong> · Auto-converted to WebP · Max 3 MB</p>'
      + '<div class="admin-image-progress" id="dishImageProgress"></div>';
    if (dish.image) {
      html += '<div class="admin-field"><label>Image alt text</label>'
        + '<div class="admin-field--bilingual">'
        + '<div class="admin-field"><span class="admin-lang-label">EN</span>'
        + '<input type="text" id="dishAltEn" value="' + escHtml((dish.alt && dish.alt.en) || "") + '"></div>'
        + '<div class="admin-field"><span class="admin-lang-label">VI</span>'
        + '<input type="text" id="dishAltVi" value="' + escHtml((dish.alt && dish.alt.vi) || "") + '"></div>'
        + '</div></div>';
    }

    return html;
  }

  function bilingual2(labelEn, valEn, idEn, labelVi, valVi, idVi) {
    return '<div class="admin-field--bilingual">'
      + '<div class="admin-field"><span class="admin-lang-label">EN</span>'
      + '<textarea id="' + idEn + '" rows="2">' + escHtml(valEn || "") + '</textarea></div>'
      + '<div class="admin-field"><span class="admin-lang-label">VI</span>'
      + '<textarea id="' + idVi + '" rows="2">' + escHtml(valVi || "") + '</textarea></div>'
      + '</div>';
  }

  function bindDishEditor(i) {
    function update() {
      var dish = window.MENU_ITEMS[i];
      if (!dish) return;
      var nameEn = val("dishNameEn"); var nameVi = val("dishNameVi");
      var descEn = val("dishDescEn"); var descVi = val("dishDescVi");
      var price  = parseFloat(val("dishPrice")) || 0;
      var cat    = val("dishCat");
      var tags   = Array.from(document.querySelectorAll("#dishTags input:checked")).map(function (cb) { return cb.value; });

      dish.name  = { en: nameEn, vi: nameVi };
      dish.desc  = { en: descEn, vi: descVi };
      dish.price = price;
      dish.cat   = cat;
      dish.tags  = tags;

      var prev = document.getElementById("dishPricePreview");
      if (prev) prev.textContent = money(price);

      draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      scheduleSave();
    }

    ["dishNameEn","dishNameVi","dishDescEn","dishDescVi"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("input", update);
    });
    ["dishPrice","dishCat"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("change", update);
    });
    var tagsWrap = document.getElementById("dishTags");
    if (tagsWrap) tagsWrap.querySelectorAll("input").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var lbl = cb.closest(".admin-tag-option");
        if (lbl) lbl.classList.toggle("is-checked", cb.checked);
        update();
      });
    });

    // Image upload
    var fileInput = document.getElementById("dishImageFile");
    if (fileInput) fileInput.addEventListener("change", function () {
      if (!fileInput.files[0]) return;
      uploadImage(fileInput.files[0], "dishImageProgress", function (url) {
        window.MENU_ITEMS[i].image = url;
        draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
        scheduleSave();
        document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
        openDishEditor(i); // refresh panel to show new image
      });
    });

    var removeBtn = document.getElementById("dishImageRemove");
    if (removeBtn) removeBtn.addEventListener("click", function () {
      delete window.MENU_ITEMS[i].image;
      delete window.MENU_ITEMS[i].alt;
      draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
      scheduleSave();
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      openDishEditor(i);
    });

    ["dishAltEn","dishAltVi"].forEach(function (id) {
      var e = document.getElementById(id);
      if (!e) return;
      e.addEventListener("input", function () {
        if (!window.MENU_ITEMS[i].alt) window.MENU_ITEMS[i].alt = {};
        window.MENU_ITEMS[i].alt[id === "dishAltEn" ? "en" : "vi"] = e.value;
        draft.menuItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
        scheduleSave();
      });
    });
  }

  /* ── GALLERY (photos only) ───────────────────────────────────── */
  function openGalleryEditor() {
    openPanel("GALLERY — Photos", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Section headings");
    i18nField("Eyebrow", "gallery.eyebrow", body);
    i18nField("Title", "gallery.title", body);

    addDivider(body, "Gallery photos");
    renderGalleryList(body);
  }

  function renderGalleryList(body) {
    var listId = "adminGalleryList";
    var existing = document.getElementById(listId);
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.id = listId;

    // "+ Add photo" opens the editor immediately. The tile is committed to the
    // gallery only once a photo has actually been uploaded.
    var addBtn = document.createElement("button");
    addBtn.className = "admin-btn admin-btn--primary";
    addBtn.textContent = "+ Add photo";
    addBtn.style.marginBottom = "8px";
    addBtn.addEventListener("click", function () {
      openNewTileEditor(body);
    });
    wrap.appendChild(addBtn);

    var list = document.createElement("div");
    list.className = "admin-list";
    (window.GALLERY || []).forEach(function (tile, i) {
      var item = document.createElement("div");
      item.className = "admin-list-item";

      var hasImg = tile.type === "image" && tile.url;
      var thumbHtml = hasImg
        ? '<img src="' + escHtml(rootAssetUrl(tile.url)) + '" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0">'
        : '<span style="width:40px;height:40px;flex-shrink:0;background:#f1f5f9;border-radius:4px;display:inline-block"></span>';
      var label = hasImg ? "Photo #" + (i + 1) : "Empty #" + (i + 1);

      item.innerHTML = thumbHtml
        + '<span class="admin-list-item__label">' + label + '</span>'
        + '<div class="admin-list-item__actions">'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" title="Edit" data-ei="' + i + '">✎</button>'
        + '<button class="admin-btn admin-btn--danger admin-btn--icon" title="Delete" data-di="' + i + '">🗑</button>'
        + '</div>';
      item.querySelector('[data-ei]').addEventListener("click", function (e) { e.stopPropagation(); openTileEditor(i, body); });
      item.querySelector('[data-di]').addEventListener("click", function (e) {
        e.stopPropagation();
        window.GALLERY.splice(i, 1);
        draft.gallery = JSON.parse(JSON.stringify(window.GALLERY));
        renderGalleryAdmin();
        scheduleSave();
        renderGalleryList(body);
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  // Opens an editor for a NEW photo (not yet in window.GALLERY).
  // The tile is appended only once a photo is uploaded.
  function openNewTileEditor(listBody) {
    openPanel("New Gallery Photo", buildTileEditorHTML({}, null), "");
    bindNewTileEditor(listBody);
  }

  function openTileEditor(i, listBody) {
    var tile = window.GALLERY[i];
    if (!tile) return;
    openPanel("Gallery Photo #" + (i + 1), buildTileEditorHTML(tile, i), "");
    bindTileEditor(i, listBody);
  }

  function buildTileEditorHTML(tile, i) {
    var html = "";
    var hasImg = tile.type === "image" && tile.url;

    // Preview
    if (hasImg) {
      html += '<div class="admin-image-preview"><img src="' + escHtml(rootAssetUrl(tile.url)) + '" alt="tile"></div>';
    } else {
      html += '<div class="admin-image-preview" style="font-size:13px;color:#94a3b8">No photo yet</div>';
    }

    // Upload photo — the only display option
    html += '<div class="admin-section-divider">Photo</div>'
      + '<div class="admin-image-actions">'
      + '<label class="admin-btn admin-btn--primary">' + (hasImg ? "Replace photo" : "Upload photo") + '<input type="file" id="tileImageFile" accept="image/*"></label>';
    if (hasImg) {
      html += '<button class="admin-btn admin-btn--danger" id="tileImageRemove">Remove photo</button>';
    }
    html += '</div>'
      + '<p class="admin-note admin-note--info" style="margin-top:6px">Recommended: <strong>800 × 800 px (1:1 square)</strong> · Auto-converted to WebP · Max 3 MB</p>'
      + '<div class="admin-image-progress" id="tileImageProgress"></div>';

    // Alt text (always shown so it's ready when a photo is uploaded)
    html += '<div class="admin-section-divider">Photo description (alt text)</div>'
      + '<div class="admin-field--bilingual">'
      + '<div class="admin-field"><span class="admin-lang-label">EN</span>'
      + '<input type="text" id="tileAltEn" value="' + escHtml((tile.alt && tile.alt.en) || "") + '" placeholder="e.g. Phở Bò bowl"></div>'
      + '<div class="admin-field"><span class="admin-lang-label">VI</span>'
      + '<input type="text" id="tileAltVi" value="' + escHtml((tile.alt && tile.alt.vi) || "") + '" placeholder="e.g. Tô phở bò"></div>'
      + '</div>';

    return html;
  }

  // Bind events for editing an EXISTING photo at index i.
  function bindTileEditor(i, listBody) {
    var fileInput = document.getElementById("tileImageFile");
    if (fileInput) fileInput.addEventListener("change", function () {
      if (!fileInput.files[0]) return;
      uploadImage(fileInput.files[0], "tileImageProgress", function (url) {
        window.GALLERY[i] = {
          type: "image",
          url:  url,
          alt:  { en: val("tileAltEn"), vi: val("tileAltVi") },
        };
        draft.gallery = JSON.parse(JSON.stringify(window.GALLERY));
        scheduleSave();
        renderGalleryAdmin();
        if (listBody) renderGalleryList(listBody);
        openTileEditor(i, listBody);
      });
    });

    var removeBtn = document.getElementById("tileImageRemove");
    if (removeBtn) removeBtn.addEventListener("click", function () {
      window.GALLERY.splice(i, 1); // photos only — removing the photo removes the tile
      draft.gallery = JSON.parse(JSON.stringify(window.GALLERY));
      scheduleSave();
      renderGalleryAdmin();
      if (listBody) renderGalleryList(listBody);
      closePanel();
    });

    ["tileAltEn", "tileAltVi"].forEach(function (id) {
      var e = document.getElementById(id);
      if (!e) return;
      e.addEventListener("input", function () {
        if (!window.GALLERY[i].alt) window.GALLERY[i].alt = {};
        window.GALLERY[i].alt[id === "tileAltEn" ? "en" : "vi"] = e.value;
        draft.gallery = JSON.parse(JSON.stringify(window.GALLERY));
        scheduleSave();
      });
    });
  }

  // Bind events for a NEW photo (not yet in GALLERY). Committed on upload.
  function bindNewTileEditor(listBody) {
    var fileInput = document.getElementById("tileImageFile");
    if (fileInput) fileInput.addEventListener("change", function () {
      if (!fileInput.files[0]) return;
      uploadImage(fileInput.files[0], "tileImageProgress", function (url) {
        window.GALLERY.push({
          type: "image",
          url:  url,
          alt:  { en: val("tileAltEn"), vi: val("tileAltVi") },
        });
        draft.gallery = JSON.parse(JSON.stringify(window.GALLERY));
        renderGalleryAdmin();
        scheduleSave();
        if (listBody) renderGalleryList(listBody);
        openTileEditor(window.GALLERY.length - 1, listBody);
      });
    });
  }

  /* ── REVIEWS ─────────────────────────────────────────────────── */
  function openReviewsEditor() {
    openPanel("REVIEWS", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Section headings");
    i18nField("Eyebrow", "reviews.eyebrow", body);
    i18nField("Title", "reviews.title", body);

    addDivider(body, "Guest review links");
    var linkNote = document.createElement("div");
    linkNote.className = "admin-note admin-note--info";
    linkNote.textContent = "Each review can link to Google, TripAdvisor, Facebook, etc. Edit a review below to set its source name and URL — linked cards show “Read on …” and open in a new tab.";
    body.appendChild(linkNote);

    addDivider(body, "Reviews");
    renderReviewList(body);
  }

  function renderReviewList(body) {
    var listId = "adminReviewList";
    var existing = document.getElementById(listId);
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.id = listId;

    var addBtn = document.createElement("button");
    addBtn.className = "admin-btn admin-btn--ghost";
    addBtn.textContent = "+ Add review";
    addBtn.style.marginBottom = "8px";
    addBtn.addEventListener("click", function () {
      window.REVIEWS.push({ stars: 5, name: "Guest · 🌍", text: { en: "", vi: "" } });
      draft.reviews = JSON.parse(JSON.stringify(window.REVIEWS));
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      scheduleSave();
      renderReviewList(body);
      openReviewEditor(window.REVIEWS.length - 1);
    });
    wrap.appendChild(addBtn);

    var list = document.createElement("div");
    list.className = "admin-list";
    (window.REVIEWS || []).forEach(function (rev, i) {
      var item = document.createElement("div");
      item.className = "admin-list-item";
      var linkHint = rev.url ? (' · ' + escHtml(rev.source || "link")) : "";
      item.innerHTML = '<span style="font-size:14px;flex-shrink:0">' + "⭐".repeat(rev.stars || 5) + '</span>'
        + '<span class="admin-list-item__label">' + escHtml(rev.name) + linkHint + '</span>'
        + '<div class="admin-list-item__actions">'
        + '<button class="admin-btn admin-btn--ghost admin-btn--icon" data-ei="' + i + '">✎</button>'
        + '<button class="admin-btn admin-btn--danger admin-btn--icon" data-di="' + i + '">🗑</button>'
        + '</div>';
      item.querySelector('[data-ei]').addEventListener("click", function (e) { e.stopPropagation(); openReviewEditor(i); });
      item.querySelector('[data-di]').addEventListener("click", function (e) {
        e.stopPropagation();
        window.REVIEWS.splice(i, 1);
        draft.reviews = JSON.parse(JSON.stringify(window.REVIEWS));
        document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
        scheduleSave();
        renderReviewList(body);
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  function openReviewEditor(i) {
    var rev = window.REVIEWS[i];
    if (!rev) return;
    openPanel("Review: " + rev.name,
      '<div class="admin-field"><label>Reviewer name (with flag emoji)</label>'
      + '<input type="text" id="revName" value="' + escHtml(rev.name) + '"></div>'
      + '<div class="admin-field"><label>Stars (1–5)</label>'
      + '<input type="number" id="revStars" min="1" max="5" value="' + (rev.stars || 5) + '"></div>'
      + '<div class="admin-section-divider">Link to original review (optional)</div>'
      + '<div class="admin-field"><label>Source platform (e.g. Google, TripAdvisor, Facebook)</label>'
      + '<input type="text" id="revSource" value="' + escHtml(rev.source || "") + '" placeholder="Google"></div>'
      + '<div class="admin-field"><label>Review URL</label>'
      + '<input type="url" id="revUrl" value="' + escHtml(rev.url || "") + '" placeholder="https://…"></div>'
      + '<div class="admin-section-divider">Review text</div>'
      + bilingual2("EN", (rev.text && rev.text.en) || "", "revTextEn", "VI", (rev.text && rev.text.vi) || "", "revTextVi"),
      "");

    function update() {
      window.REVIEWS[i].name  = val("revName");
      window.REVIEWS[i].stars = parseInt(val("revStars"), 10) || 5;
      window.REVIEWS[i].text  = { en: val("revTextEn"), vi: val("revTextVi") };
      var src = val("revSource").trim();
      var url = val("revUrl").trim();
      if (url) {
        window.REVIEWS[i].url = url;
        window.REVIEWS[i].source = src || "source";
      } else {
        delete window.REVIEWS[i].url;
        delete window.REVIEWS[i].source;
      }
      draft.reviews = JSON.parse(JSON.stringify(window.REVIEWS));
      document.dispatchEvent(new CustomEvent("languagechange", { detail: LANG() }));
      scheduleSave();
    }
    ["revName","revStars","revSource","revUrl","revTextEn","revTextVi"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("input", update);
    });
  }

  /* ── RESERVE ─────────────────────────────────────────────────── */
  function openReserveEditor() {
    openPanel("RESERVE — Booking Section", "", "");
    var body = el("adminPanelBody");
    i18nField("Eyebrow", "reserve.eyebrow", body);
    i18nField("Title", "reserve.title", body);
    i18nField("Lead text", "reserve.lead", body);
    addDivider(body, "Perks list");
    i18nField("Perk 1", "reserve.perk1", body);
    i18nField("Perk 2", "reserve.perk2", body);
    i18nField("Perk 3", "reserve.perk3", body);
    addDivider(body, "Form labels");
    i18nField("Book now button", "form.bookNow", body);
    i18nField("No-payment hint", "form.hint", body);
  }

  /* ── VISIT ───────────────────────────────────────────────────── */
  function openVisitEditor() {
    openPanel("VISIT — Find Us Section", "", "");
    var body = el("adminPanelBody");

    addDivider(body, "Section headings");
    i18nField("Eyebrow", "visit.eyebrow", body);
    i18nField("Title", "visit.title", body);

    addDivider(body, "Contact info");
    var v = (draft.visit || {});
    addTextField(body, "Address (shown in page)", v.address || (document.querySelector(".visit__list li:first-child span") || {}).textContent || "", function (v2) {
      if (!draft.visit) draft.visit = {};
      draft.visit.address = v2;
      var el2 = document.querySelector(".visit__list li:first-child span");
      if (el2) el2.textContent = v2;
      var fa = document.querySelector(".footer__col span");
      if (fa) fa.textContent = v2;
      scheduleSave();
    });
    i18nField("Hours text", "visit.hours", body);

    addDivider(body, "Map & Links");
    addTextField(body, "Google Maps embed src (iframe src)", v.mapEmbedSrc || (document.querySelector(".visit__map iframe") || {}).src || "", function (v2) {
      if (!draft.visit) draft.visit = {};
      draft.visit.mapEmbedSrc = v2;
      var mapEl = document.querySelector(".visit__map iframe");
      if (mapEl) mapEl.src = v2;
      scheduleSave();
    });
    addTextField(body, "Directions URL (Google Maps link)", v.directionsHref || "", function (v2) {
      if (!draft.visit) draft.visit = {};
      draft.visit.directionsHref = v2;
      var btn = document.querySelector(".visit__actions .btn--primary");
      if (btn) btn.href = v2;
      scheduleSave();
    });
    addTextField(body, "WhatsApp link (wa.me/...)", v.whatsappHref || "", function (v2) {
      if (!draft.visit) draft.visit = {};
      draft.visit.whatsappHref = v2;
      var btn = document.querySelector(".visit__actions .btn--whatsapp");
      if (btn) btn.href = v2;
      scheduleSave();
    });
    i18nField("Directions button label", "visit.directions", body);
    i18nField("WhatsApp button label", "visit.whatsapp", body);
  }

  /* ── FOOTER ──────────────────────────────────────────────────── */
  function openFooterEditor() {
    openPanel("FOOTER", "", "");
    var body = el("adminPanelBody");

    var ft = (draft.footer || {});
    addTextField(body, "Brand name (footer)", ft.brandName || (document.querySelector(".footer__brand strong") || {}).textContent || "", function (v) {
      if (!draft.footer) draft.footer = {};
      draft.footer.brandName = v;
      var fb = document.querySelector(".footer__brand strong");
      if (fb) fb.textContent = v;
      scheduleSave();
    });
    i18nField("Tagline", "footer.tagline", body);
    i18nField("Explore column heading", "footer.explore", body);
    i18nField("Contact column heading", "footer.contact", body);
    addTextField(body, "Address (footer)", ft.address || (document.querySelector(".footer__col span") || {}).textContent || "", function (v) {
      if (!draft.footer) draft.footer = {};
      draft.footer.address = v;
      var fa = document.querySelector(".footer__col span");
      if (fa) fa.textContent = v;
      scheduleSave();
    });
    i18nField("Footer bottom line", "footer.built", body);
  }

  /* ═══════════════════════════════════════════════════════════════
     IMAGE UPLOAD (client-side compress → base64 → function)
  ═══════════════════════════════════════════════════════════════ */
  function uploadImage(file, progressId, onSuccess) {
    var prog = document.getElementById(progressId);
    if (prog) prog.textContent = "Compressing…";

    compressImage(file)
      .then(function (result) {
        if (prog) prog.textContent = "Uploading…";
        return fetch(FN + "/upload-image", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: result.base64, type: result.type, name: file.name }),
        });
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok && res.body.url) {
          if (prog) prog.textContent = "Uploaded ✓";
          onSuccess(res.body.url);
        } else {
          if (prog) prog.textContent = "Error: " + (res.body.error || "Upload failed");
        }
      })
      .catch(function (err) {
        if (prog) prog.textContent = "Upload error. Try again.";
      });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var MAX = 1600;
          var w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) {
            var ratio = Math.min(MAX / w, MAX / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);

          // Try WebP; fall back to JPEG
          var dataUrl  = canvas.toDataURL("image/webp", 0.82);
          var mimeType = dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
          if (mimeType === "image/jpeg") dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          var base64 = dataUrl.split(",")[1];
          resolve({ base64: base64, type: mimeType });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SAVE / PUBLISH / DISCARD / LOGOUT
  ═══════════════════════════════════════════════════════════════ */
  function scheduleSave() {
    isDirty = true;
    setStatus("Unsaved changes…", "is-saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 1200);
  }

  function saveDraft() {
    if (!draft) return Promise.resolve(false);
    ensureDraftComplete();
    draft.updatedAt = new Date().toISOString();
    return fetch(FN + "/save-content", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok) {
          isDirty = false;
          setStatus("Draft saved ✓", "is-saved");
          return true;
        }
        setStatus("Save error: " + (res.body.error || "?"), "is-error");
        return false;
      })
      .catch(function () {
        setStatus("Save failed — check connection", "is-error");
        return false;
      });
  }

  function doPublish() {
    setStatus("Publishing…", "is-saving");
    var runPublish = function () {
      fetch(FN + "/publish", { method: "POST", credentials: "include" })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok) {
            var warns = res.body.warnings || [];
            if (warns.length) {
              setStatus("Published v" + res.body.version + " — ⚠ SEO: " + warns[0], "is-error");
            } else {
              setStatus("Published v" + res.body.version + " ✓", "is-saved");
            }
          } else {
            setStatus("Publish error: " + (res.body.error || "?"), "is-error");
          }
        })
        .catch(function () { setStatus("Publish failed", "is-error"); });
    };

    if (isDirty) {
      saveDraft().then(function (ok) { if (ok) runPublish(); });
      return;
    }
    runPublish();
  }

  function doDiscard() {
    if (!confirm("Discard all unsaved draft changes and reload from last published version?")) return;
    fetch(FN + "/get-content", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (content) {
        if (content) {
          draft = content;
          mergeDraftIntoGlobals(draft);
          reRenderSite();
          setStatus("Discarded — showing published content", "is-saved");
        } else {
          setStatus("No published content found", "is-error");
        }
      });
  }

  function doLogout() {
    fetch(FN + "/auth", { method: "DELETE", credentials: "include" })
      .finally(function () { window.location.reload(); });
  }

  /* ═══════════════════════════════════════════════════════════════
     HELPER FIELD BUILDERS
  ═══════════════════════════════════════════════════════════════ */
  function addTextField(parent, label, currentValue, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "admin-field";
    var lbl = document.createElement("label");
    lbl.textContent = label;
    var input = document.createElement("input");
    input.type = "text";
    input.value = currentValue || "";
    input.addEventListener("input", function () { onChange(input.value); });
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    parent.appendChild(wrap);
    return input;
  }

  function addNumberField(parent, label, currentValue, min, max, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "admin-field";
    var lbl = document.createElement("label");
    lbl.textContent = label;
    var input = document.createElement("input");
    input.type = "number";
    input.value = currentValue;
    input.min   = min;
    input.max   = max;
    input.addEventListener("change", function () { onChange(input.value); });
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    parent.appendChild(wrap);
    return input;
  }

  function addSelectField(parent, label, options, currentValue, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "admin-field";
    var lbl = document.createElement("label");
    lbl.textContent = label;
    var sel = document.createElement("select");
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value    = opt[0];
      o.textContent = opt[1];
      if (opt[0] === currentValue) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { onChange(sel.value); });
    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    parent.appendChild(wrap);
    return sel;
  }

  function addDivider(parent, text) {
    var d = document.createElement("div");
    d.className   = "admin-section-divider";
    d.textContent = text;
    parent.appendChild(d);
  }

  /* ═══════════════════════════════════════════════════════════════
     MISC UTILITIES
  ═══════════════════════════════════════════════════════════════ */
  function money(n) {
    var c   = window.SITE_CONFIG.currency;
    var num = Number(n).toLocaleString(LANG() === "vi" ? "vi-VN" : "en-US", {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    });
    return c.position === "before" ? c.symbol + num : num + " " + c.symbol;
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      var sv = source[key];
      if (Array.isArray(sv)) { target[key] = sv; }
      else if (sv && typeof sv === "object" && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        deepMerge(target[key], sv);
      } else { target[key] = sv; }
    });
    return target;
  }

  function setStatus(msg, cls) {
    var s = el("adminStatus");
    if (!s) return;
    s.textContent = msg;
    s.className   = "admin-bar__status " + (cls || "");
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function show(id) { var e = el(id); if (e) e.style.display = ""; }
  function hide(id) { var e = el(id); if (e) e.style.display = "none"; }
  function val(id)  { var e = el(id); return e ? e.value : ""; }

})();
