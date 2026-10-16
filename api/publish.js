"use strict";
const { wrap } = require("../functions/_lib/vercel-compat");
module.exports = wrap(require("../functions/publish").handler);
