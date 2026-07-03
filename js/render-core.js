/*
 * ============================================================
 *  render-core.js — SHARED, ISOMORPHIC RENDER MODULE (LOCKED)
 * ------------------------------------------------------------
 *  Pure functions that turn content data + lang + currency into
 *  HTML strings and the schema.org JSON-LD graph. NO window /
 *  document dependencies — runs identically in the browser
 *  (js/app.js, js/seo.js) AND on the server (Netlify Edge
 *  Function netlify/edge-functions/render.js).
 *
 *  This is the single source of markup so the crawlable
 *  (server-baked) page and the interactive (browser) page never
 *  drift. See Plans/seo-ai-remediation-plan.md (WS-A).
 * ============================================================
 */
(function (global) {
  "use strict";

  var TAG_LABELS = {
    veg: { en: "Vegetarian", vi: "Chay", cls: "tag--veg" },
    spicy: { en: "Spicy", vi: "Cay", cls: "tag--spicy" },
    popular: { en: "Popular", vi: "Phổ biến", cls: "tag--popular" },
    new: { en: "New", vi: "Mới", cls: "tag--new" },
  };

  /*
   * Amenity catalog — the template's master list of "good to know" facts an
   * AI assistant / search engine can match a venue on. A site enables a SUBSET
   * via SEO_CONFIG.amenities (a list of keys); unknown/absent keys are skipped.
   * Order of this array = display order. Adding a new amenity later = one row
   * here, inherited by every template-derived site. Each row carries the emoji
   * icon, bilingual chip label, and the schema.org amenityFeature name. The
   * `pets` flag additionally sets the first-class restaurant.petsAllowed.
   */
  var AMENITIES_CATALOG = [
    { key: "familyFriendly",       group: "families", icon: "👨‍👩‍👧", en: "Family friendly",         vi: "Phù hợp gia đình",      schema: "Family friendly" },
    { key: "kidsPlayground",       group: "families", icon: "🛝",   en: "Kids' playground",        vi: "Khu vui chơi trẻ em",   schema: "Children's playground" },
    { key: "highChairs",           group: "families", icon: "🪑",   en: "High chairs",             vi: "Ghế ăn cho bé",         schema: "High chairs" },
    { key: "kidsMenu",             group: "families", icon: "🍼",   en: "Kids' menu",              vi: "Thực đơn cho trẻ em",   schema: "Kids' menu" },
    { key: "freeWifi",             group: "work",     icon: "📶",   en: "Free Wi-Fi",              vi: "Wi-Fi miễn phí",        schema: "Free Wi-Fi" },
    { key: "digitalNomads",        group: "work",     icon: "💻",   en: "Laptop / nomad friendly", vi: "Chào đón dân du mục số", schema: "Good for working on laptop" },
    { key: "powerOutlets",         group: "work",     icon: "🔌",   en: "Power outlets",           vi: "Ổ cắm điện",            schema: "Power outlets" },
    { key: "garden",               group: "comfort",  icon: "🌳",   en: "Spacious garden",         vi: "Khu vườn rộng rãi",     schema: "Outdoor seating" },
    { key: "airConditioned",       group: "comfort",  icon: "❄️",   en: "Air-conditioned",         vi: "Máy lạnh",              schema: "Air-conditioned" },
    { key: "showers",              group: "comfort",  icon: "🚿",   en: "Showers for swimmers",    vi: "Phòng tắm cho khách bơi", schema: "Showers" },
    { key: "wheelchairAccessible", group: "access",   icon: "♿",   en: "Wheelchair accessible",   vi: "Lối vào cho xe lăn",    schema: "Wheelchair-accessible entrance" },
    { key: "carParking",           group: "parking",  icon: "🅿️",   en: "Car parking",             vi: "Bãi đậu ô tô",          schema: "Parking available" },
    { key: "scooterParking",       group: "parking",  icon: "🛵",   en: "Scooter parking",         vi: "Chỗ để xe máy",         schema: "Motorbike parking" },
    { key: "dogsWelcome",          group: "pets",     icon: "🐕",   en: "Dogs welcome",            vi: "Chào đón thú cưng",     schema: "Dogs allowed", pets: true },
  ];

  // Amenity groups (ordered = display order). Bilingual labels live here in the
  // catalog, consistent with how the amenity labels themselves do — no i18n keys.
  var AMENITY_GROUPS = [
    { id: "families", en: "Families",            vi: "Gia đình" },
    { id: "work",     en: "Work & connectivity", vi: "Làm việc & kết nối" },
    { id: "comfort",  en: "Comfort & space",     vi: "Tiện nghi & không gian" },
    { id: "access",   en: "Accessibility",       vi: "Tiếp cận" },
    { id: "parking",  en: "Getting here",        vi: "Đi lại & đỗ xe" },
    { id: "pets",     en: "Pets",                vi: "Thú cưng" },
  ];

  // Resolve enabled keys to catalog + custom rows, preserving catalog order first.
  // customList items: { id, icon, group, en, vi, schema?, pets? }
  function amenityRows(keys, customList) {
    if (!keys || !keys.length) return [];
    var set = {};
    for (var i = 0; i < keys.length; i++) set[keys[i]] = true;
    var rows = AMENITIES_CATALOG.filter(function (a) { return set[a.key]; });
    (customList || []).forEach(function (c) {
      if (!c || !c.id || !set[c.id]) return;
      rows.push({
        key: c.id,
        group: c.group,
        icon: c.icon || "✨",
        en: c.en || c.id,
        vi: c.vi || c.en || c.id,
        schema: c.schema || c.en || c.id,
        pets: !!c.pets,
      });
    });
    return rows;
  }

  // HTML string of chips: <span class="amenity">icon label</span>.
  // (Retained for any consumer that still wants a flat strip.)
  function amenityChips(keys, lang) {
    return amenityRows(keys).map(function (a) {
      return '<span class="amenity"><span class="amenity__icon" aria-hidden="true">' +
        a.icon + '</span>' + pick(a, lang) + "</span>";
    }).join("");
  }

  // Grouped, available-only amenities section: one .amenity-group per non-empty
  // group (in AMENITY_GROUPS order), each a headed list of icon+label rows.
  // Returns "" when nothing is enabled so the caller can hide the section.
  function amenitySectionHTML(keys, lang, customList) {
    var rows = amenityRows(keys, customList);
    if (!rows.length) return "";
    return AMENITY_GROUPS.map(function (g) {
      var inGroup = rows.filter(function (a) { return a.group === g.id; });
      if (!inGroup.length) return "";
      var items = inGroup.map(function (a) {
        return '<li class="amenity"><span class="amenity__icon" aria-hidden="true">' +
          a.icon + '</span>' + pick(a, lang) + "</li>";
      }).join("");
      return '<div class="amenity-group">' +
        '<h3 class="amenity-group__title">' + pick(g, lang) + "</h3>" +
        '<ul class="amenity-grid" role="list">' + items + "</ul>" +
        "</div>";
    }).join("");
  }

  // { features: LocationFeatureSpecification[], petsAllowed: bool } for JSON-LD.
  function amenitySchema(keys, customList) {
    var rows = amenityRows(keys, customList);
    return {
      features: rows.map(function (a) {
        return { "@type": "LocationFeatureSpecification", name: a.schema, value: true };
      }),
      petsAllowed: rows.some(function (a) { return a.pets; }),
    };
  }

  function pick(obj, lang) {
    if (!obj) return "";
    return obj[lang] || obj.en || "";
  }

  function attr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }

  function imgTag(base, widths, w, h, alt) {
    var style = "width:100%;height:100%;object-fit:cover;border-radius:inherit;";
    if (!widths || !widths.length) {
      return (
        '<img src="' + attr(base) + '" alt="' + attr(alt) +
        '" loading="lazy" decoding="async" style="' + style + '">'
      );
    }
    var srcset = widths.map(function (x) {
      return attr(base + "-" + x + ".webp") + " " + x + "w";
    }).join(", ");
    var src = base + "-960.webp";
    var wh = w && h ? ' width="' + w + '" height="' + h + '"' : "";
    return (
      '<img src="' + attr(src) + '" srcset="' + srcset +
      '" sizes="(max-width:600px) 100vw, 33vw"' + wh +
      ' loading="lazy" decoding="async" alt="' + attr(alt) + '" style="' + style + '">'
    );
  }

  function repeat(s, n) {
    var out = "";
    for (var i = 0; i < (n || 0); i++) out += s;
    return out;
  }

  function money(n, currency, lang) {
    var c = currency || {};
    var num = Number(n).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
      minimumFractionDigits: c.decimals || 0,
      maximumFractionDigits: c.decimals || 0,
    });
    return c.position === "before" ? c.symbol + num : num + " " + c.symbol;
  }

  /* ---------- markup templates (identical browser + server) ---------- */

  // ctx = { lang, currency, t }
  function dishCardHTML(item, ctx) {
    var lang = ctx.lang;
    var name = pick(item.name, lang);
    var desc = pick(item.desc, lang);
    var tags = (item.tags || [])
      .filter(function (x) { return TAG_LABELS[x]; })
      .map(function (x) {
        return '<span class="tag ' + TAG_LABELS[x].cls + '">' + TAG_LABELS[x][lang] + "</span>";
      })
      .join("");
    var photo;
    if (item.base && item.widths && item.widths.length) {
      photo = '<div class="dish__emoji">' + imgTag(item.base, item.widths, item.w || 960, item.h || 720, name) + "</div>";
    } else if (item.image) {
      photo = '<div class="dish__emoji"><img src="' + attr(item.image) + '" alt="' + attr(name) +
        '" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></div>';
    } else {
      photo = '<div class="dish__emoji" aria-hidden="true"></div>';
    }
    return (
      '<article class="dish" data-id="' + attr(item.id) + '">' +
      photo +
      '<div class="dish__body">' +
      '<div class="dish__head">' +
      '<h3 class="dish__name">' + name + "</h3>" +
      '<span class="dish__price">' + money(item.price, ctx.currency, lang) + "</span>" +
      "</div>" +
      '<p class="dish__desc">' + desc + "</p>" +
      '<div class="dish__foot">' +
      '<div class="dish__tags">' + tags + "</div>" +
      '<button class="btn btn--primary btn--sm dish__add" type="button">+ ' + ctx.t("menu.add") + "</button>" +
      "</div></div></article>"
    );
  }

  function menuTabHTML(cat, activeId, lang) {
    var active = cat.id === activeId ? " is-active" : "";
    return (
      '<button class="menu__tab' + active + '" type="button" role="tab" data-cat="' +
      attr(cat.id) + '">' + pick(cat.name, lang) + "</button>"
    );
  }

  function reviewCardHTML(r, lang) {
    var inner =
      '<div class="review__stars">' + repeat("★", r.stars || 5) + "</div>" +
      '<p class="review__text">“' + pick(r.text, lang) + "”</p>" +
      '<p class="review__name">' + (r.name || "") + "</p>";
    if (r.url) {
      var label = r.source || "source";
      return (
        '<a class="review card review--link" href="' + attr(r.url) + '"' +
        ' target="_blank" rel="noopener noreferrer"' +
        ' aria-label="' + attr("Read " + (r.name || "this") + " review on " + label + " (opens in a new tab)") + '">' +
        inner +
        '<span class="review__source">Read on ' + attr(label) + ' <span aria-hidden="true">↗</span></span>' +
        "</a>"
      );
    }
    return '<article class="review card">' + inner + "</article>";
  }

  function galleryItemHTML(g, lang) {
    if (g.type === "image" && (g.url || g.base)) {
      var altText = pick(g.alt, lang);
      var full = g.urlFull || (g.base && g.widths && g.widths.length
        ? g.base + "-" + g.widths[g.widths.length - 1] + ".webp"
        : g.url);
      var imgHtml = g.base && g.widths && g.widths.length
        ? imgTag(g.base, g.widths, g.w, g.h, altText)
        : '<img src="' + attr(g.url) + '" alt="' + attr(altText) +
          '" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
      return (
        '<button class="gallery__item gallery__item--photo" type="button"' +
        ' data-full="' + attr(full) + '" data-alt="' + attr(altText) + '"' +
        ' aria-label="' + attr(altText || "Enlarge photo") + '">' +
        imgHtml + "</button>"
      );
    }
    return '<div class="gallery__item" style="background:var(--c-surface-alt)"></div>';
  }

  /* ---------- collect FAQ Q&A from a translation function ---------- */
  function collectFaq(t) {
    var out = [];
    for (var i = 1; i <= 50; i++) {
      var qKey = "faq.q" + i;
      var aKey = "faq.a" + i;
      var q = t(qKey);
      var a = t(aKey);
      if (q === qKey || a === aKey) break; // key not found → stop
      out.push({ q: q, a: a });
    }
    return out;
  }

  /* ---------- JSON-LD graph (schema.org) ---------- */
  // p = { origin, config, currency, menuCategories, menuItems, reviews,
  //       seoConfig, faq, description, address, telephone, lang }
  function buildJsonLd(p) {
    var base = (p.origin || "").replace(/\/$/, "");
    var restaurantUrl = base + "/";
    var seo = p.seoConfig || {};
    var cur = p.currency || {};
    var lang = p.lang || "en";

    // reviews + aggregate
    var reviewNodes = [], aggregate = null;
    if (p.reviews && p.reviews.length) {
      reviewNodes = p.reviews.map(function (r) {
        var node = {
          "@type": "Review",
          author: { "@type": "Person", name: (r.name || "").replace(/\s*·.*$/, "").trim() || "Guest" },
          reviewRating: { "@type": "Rating", ratingValue: String(r.stars || 5), bestRating: "5" },
          reviewBody: pick(r.text, lang),
        };
        if (r.url) node.url = r.url;
        return node;
      });
      var sum = p.reviews.reduce(function (a, r) { return a + (r.stars || 0); }, 0);
      aggregate = {
        "@type": "AggregateRating",
        ratingValue: (sum / p.reviews.length).toFixed(1),
        reviewCount: String(p.reviews.length),
        bestRating: "5",
      };
    }

    // menu
    var sections = (p.menuCategories || []).map(function (c) {
      var items = (p.menuItems || [])
        .filter(function (m) { return m.cat === c.id; })
        .map(function (m) {
          var item = {
            "@type": "MenuItem",
            name: pick(m.name, lang),
            description: pick(m.desc, lang),
            offers: { "@type": "Offer", price: String(m.price), priceCurrency: cur.code || "USD" },
            suitableForDiet: [
              "https://schema.org/VeganDiet",
              "https://schema.org/VegetarianDiet",
            ],
          };
          return item;
        });
      return { "@type": "MenuSection", name: pick(c.name, lang), hasMenuItem: items };
    }).filter(function (s) { return s.hasMenuItem.length > 0; });

    var menu = { "@type": "Menu", "@id": restaurantUrl + "#menu", hasMenuSection: sections };

    // restaurant
    var restaurant = {
      "@type": "Restaurant",
      "@id": base + "/#restaurant",
      name: (p.config && p.config.name) || "Restaurant",
      description: p.description || "",
      url: restaurantUrl,
      servesCuisine: seo.servesCuisine || [],
      acceptsReservations: true,
      hasMenu: restaurantUrl + "#menu",
    };
    if (seo.priceRange) restaurant.priceRange = seo.priceRange;
    if (seo.keywords) restaurant.keywords = seo.keywords;
    var parts = (p.config && p.config.addressParts) || seo.addressParts;
    var addr = p.address || seo.address;
    if (parts) restaurant.address = Object.assign({ "@type": "PostalAddress" }, parts);
    else if (addr) restaurant.address = { "@type": "PostalAddress", streetAddress: addr };
    if (seo.alternateNames && seo.alternateNames.length) restaurant.alternateName = seo.alternateNames;
    var tel = p.telephone || seo.telephone;
    if (tel) restaurant.telephone = tel;
    if (p.config && p.config.email) restaurant.email = p.config.email;
    if (seo.geo && seo.geo.lat) {
      restaurant.geo = { "@type": "GeoCoordinates", latitude: seo.geo.lat, longitude: seo.geo.lng };
    }
    if (seo.openingHours && seo.openingHours.length) {
      restaurant.openingHoursSpecification = seo.openingHours.map(function (h) {
        return { "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes };
      });
    }
    if (seo.acceptedPayments && seo.acceptedPayments.length) restaurant.paymentAccepted = seo.acceptedPayments.join(", ");
    if (seo.sameAs && seo.sameAs.length) restaurant.sameAs = seo.sameAs;
    if (seo.ogImage) restaurant.image = seo.ogImage;
    if (aggregate) restaurant.aggregateRating = aggregate;
    if (reviewNodes.length) restaurant.review = reviewNodes;
    if (seo.amenities && seo.amenities.length) {
      var am = amenitySchema(seo.amenities, seo.customAmenities);
      if (am.features.length) restaurant.amenityFeature = am.features;
      if (am.petsAllowed) restaurant.petsAllowed = true;
    }

    var graph = [
      restaurant,
      menu,
      {
        "@type": "WebSite",
        "@id": base + "/#website",
        url: restaurantUrl,
        name: (p.config && p.config.name) || "Restaurant",
        inLanguage: ["en", "vi"],
        publisher: { "@id": base + "/#restaurant" },
      },
    ];

    if (p.faq && p.faq.length) {
      graph.push({
        "@type": "FAQPage",
        "@id": base + "/#faq",
        mainEntity: p.faq.map(function (qa) {
          return { "@type": "Question", name: qa.q, acceptedAnswer: { "@type": "Answer", text: qa.a } };
        }),
      });
    }

    return { "@context": "https://schema.org", "@graph": graph };
  }

  var api = {
    TAG_LABELS: TAG_LABELS,
    AMENITIES_CATALOG: AMENITIES_CATALOG,
    AMENITY_GROUPS: AMENITY_GROUPS,
    amenityChips: amenityChips,
    amenityRows: amenityRows,
    amenitySectionHTML: amenitySectionHTML,
    amenitySchema: amenitySchema,
    money: money,
    dishCardHTML: dishCardHTML,
    menuTabHTML: menuTabHTML,
    reviewCardHTML: reviewCardHTML,
    galleryItemHTML: galleryItemHTML,
    imgTag: imgTag,
    collectFaq: collectFaq,
    buildJsonLd: buildJsonLd,
  };

  global.RenderCore = api;
})(typeof window !== "undefined" ? window : this);
