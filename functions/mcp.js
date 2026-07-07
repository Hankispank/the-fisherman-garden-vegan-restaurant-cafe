"use strict";
/** mcp — self-hosted MCP server (JSON-RPC) for Claude and other MCP clients. */
const av = require("./_lib/availability");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id",
};
const H = { "Content-Type": "application/json", ...CORS };
const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

const TOOLS = [
  { name: "check_availability", description: "Check if a table is available.",
    inputSchema: { type: "object", required: ["date", "time"], properties: {
      date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" },
      guests: { type: "string" } } } },
  { name: "book_table", description: "Request a table reservation (pending until the restaurant confirms).",
    inputSchema: { type: "object", required: ["customer_name", "customer_contact", "date", "time", "guests"], properties: {
      customer_name: { type: "string" }, customer_contact: { type: "string", description: "email or phone" },
      date: { type: "string" }, time: { type: "string" }, guests: { type: "string" }, notes: { type: "string" } } } },
];

async function callTool(name, args, event) {
  if (name === "check_availability") {
    const r = await av.check(args, event);
    return { content: [{ type: "text", text: r.ok ? "Available." : "Not available: " + r.reason }] };
  }
  if (name === "book_table") {
    const { handler } = require("./submit-order");
    const res = await handler({ httpMethod: "POST", headers: event.headers,
      body: JSON.stringify({ type: "reservation", channel: "email", contact_method: "email", botcheck: "", ...args }) });
    const j = JSON.parse(res.body || "{}");
    return { content: [{ type: "text", text: j.message || (j.success ? "Booked (pending): " + j.id : "Failed: " + (j.error || "")) }] };
  }
  throw new Error("Unknown tool: " + name);
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify(rpcErr(null, -32600, "POST only")) };
  let msg;
  try { msg = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: H, body: JSON.stringify(rpcErr(null, -32700, "Parse error")) }; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize")
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, {
        protocolVersion: "2024-11-05", capabilities: { tools: {} },
        serverInfo: { name: "the-fisherman-booking", version: "1.0.0" } })) };
    if (method === "tools/list")
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, { tools: TOOLS })) };
    if (method === "tools/call") {
      const out = await callTool(params.name, params.arguments || {}, event);
      return { statusCode: 200, headers: H, body: JSON.stringify(rpc(id, out)) };
    }
    if (method === "notifications/initialized" || id == null)
      return { statusCode: 202, headers: H, body: "" };
    return { statusCode: 200, headers: H, body: JSON.stringify(rpcErr(id, -32601, "Method not found: " + method)) };
  } catch (e) {
    return { statusCode: 200, headers: H, body: JSON.stringify(rpcErr(id, -32000, e.message)) };
  }
};
