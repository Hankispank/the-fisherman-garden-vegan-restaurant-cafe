"use strict";
const cfg = require("./booking-config.json");

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
// Both "now" and the requested time are built as UTC wall-clock so the comparison
// is consistent regardless of the Lambda's own zone. VN has no DST → fixed offset.
const nowLocalMs = () => Date.now() + cfg.tzOffsetMinutes * 60000;
const slotKey = (date, time) => "slot/" + date + "T" + time;

async function check({ date, time, guests }, event) {
  if (!date || !time) return { ok: false, reason: "Please provide a date and time." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return { ok: false, reason: "Use date YYYY-MM-DD and time HH:MM (24h)." };

  const reqMs = Date.parse(date + "T" + time + ":00Z");
  if (Number.isNaN(reqMs)) return { ok: false, reason: "Invalid date/time." };
  if (reqMs < nowLocalMs()) return { ok: false, reason: "That time is in the past." };

  const mins = toMin(time);
  if (mins < toMin(cfg.opens) || mins > toMin(cfg.closes))
    return { ok: false, reason: `We're open ${cfg.opens}–${cfg.closes} daily.`,
             suggestions: [cfg.opens, "12:00", "19:00"] };

  const party = parseInt(guests || "0", 10) || 0;
  if (cfg.maxPartySize && party > cfg.maxPartySize)
    return { ok: false, reason: `For parties over ${cfg.maxPartySize}, please contact us directly.` };

  const { getStore } = require("./blobs");
  const store = getStore("orders", event);
  const used = (await store.get(slotKey(date, time), { type: "json" })) || { count: 0 };
  if (cfg.capacityPerSlot && used.count + Math.max(party, 1) > cfg.capacityPerSlot)
    return { ok: false, reason: "That time is fully booked. Please try another slot." };

  return { ok: true };
}

async function reserveSlot(store, { date, time, guests }) {
  const key = slotKey(date, time);
  const used = (await store.get(key, { type: "json" })) || { count: 0 };
  used.count += Math.max(parseInt(guests || "1", 10) || 1, 1);
  await store.setJSON(key, used); // benign race, same pattern as the order index
}

module.exports = { check, reserveSlot, slotKey };
