"use strict";
/** check-availability — public GET endpoint for slot checks (no auth). */
const av = require("./_lib/availability");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const H = { "Content-Type": "application/json", ...CORS };

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Use GET." }) };
  const q = event.queryStringParameters || {};
  const r = await av.check({ date: q.date, time: q.time, guests: q.guests }, event);
  return { statusCode: 200, headers: H,
    body: JSON.stringify({ available: r.ok, reason: r.reason || null, suggestions: r.suggestions || [] }) };
};
