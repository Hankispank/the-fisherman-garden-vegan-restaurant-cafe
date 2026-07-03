/*
 * ============================================================
 *  EDITABLE FILE — site configuration (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------------
 *  This object owns EVERY business fact. The site, the SEO
 *  structured data, the Visit/footer/title, the map links, and
 *  the order-ID prefix are all filled FROM here at build/serve
 *  time — so this is the one file to edit for facts.
 *  Keep the field names exactly as they are; change the values.
 *  See TEMPLATE.md and docs/NEW_SITE_CHECKLIST.md.
 * ============================================================
 */
window.SITE_CONFIG = {
  name: "The Fisherman Garden Vegan Restaurant & Cafe",

  shortName: "The Fisherman",

  whatsapp: "84905660623",

  zalo: "84905660623",

  email: "thefisherman.veganrestaurant@gmail.com",

  web3formsKey: "",
  endpoint: "https://api.web3forms.com/submit",

  currency: {"code":"VND","symbol":"₫","position":"after","decimals":0},

  telephoneDisplay: "+84 905 660 623",
  telephoneHref:    "84905660623",
  email_public:     "thefisherman.veganrestaurant@gmail.com",
  address:          "An Bang Beach, Hội An Tây, Đà Nẵng, Vietnam",
  addressParts: {
    streetAddress:   "An Bang Beach",
    addressLocality: "Hội An",
    addressRegion:   "Đà Nẵng",
    addressCountry:  "VN",
  },
  geo:              {"lat":15.9122433,"lng":108.3416928},
  hours: [{ "days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], "opens": "08:00", "closes": "21:00" }],
  mapEmbedSrc:      "https://www.google.com/maps?q=An%20Bang%20Beach%2C%20H%E1%BB%99i%20An%20T%C3%A2y%2C%20%C4%90%C3%A0%20N%E1%BA%B5ng%2C%20Vietnam&output=embed",
  directionsHref:   "https://www.google.com/maps/search/?api=1&query=An%20Bang%20Beach%2C%20H%E1%BB%99i%20An%20T%C3%A2y%2C%20%C4%90%C3%A0%20N%E1%BA%B5ng%2C%20Vietnam",
  logo:             "🎣",
};
