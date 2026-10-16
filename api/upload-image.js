"use strict";
const { wrap } = require("../functions/_lib/vercel-compat");
module.exports = wrap(require("../functions/upload-image").handler);
module.exports.config = { api: { bodyParser: { sizeLimit: "4mb" } } };
