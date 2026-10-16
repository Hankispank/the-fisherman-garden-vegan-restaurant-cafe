"use strict";
const { wrap } = require("../functions/_lib/vercel-compat");
module.exports = wrap(require("../functions/save-content").handler);
module.exports.config = { api: { bodyParser: { sizeLimit: "4mb" } } };
