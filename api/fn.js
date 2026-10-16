"use strict";
/**
 * Single Vercel function that dispatches to the existing Netlify handlers.
 * Hobby allows 12 serverless functions; one dispatcher stays under that cap.
 */
const { toEvent, send } = require("../functions/_lib/vercel-compat");

const HANDLERS = {
  auth: () => require("../functions/auth").handler,
  "get-content": () => require("../functions/get-content").handler,
  "get-media": () => require("../functions/get-media").handler,
  "save-content": () => require("../functions/save-content").handler,
  publish: () => require("../functions/publish").handler,
  "upload-image": () => require("../functions/upload-image").handler,
  "get-orders": () => require("../functions/get-orders").handler,
  "update-order": () => require("../functions/update-order").handler,
  "submit-order": () => require("../functions/submit-order").handler,
  "check-availability": () => require("../functions/check-availability").handler,
  "booking-action": () => require("../functions/booking-action").handler,
  mcp: () => require("../functions/mcp").handler,
};

module.exports = async function handler(req, res) {
  const name = (req.query && req.query.fn) || "";
  const load = HANDLERS[name];
  if (!load) {
    res.status(404).json({ error: "Unknown function." });
    return;
  }
  const result = await load()(toEvent(req));
  send(res, result);
};

module.exports.config = { api: { bodyParser: { sizeLimit: "4mb" } } };
