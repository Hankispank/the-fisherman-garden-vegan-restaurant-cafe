"use strict";
// Single source of truth for "set a booking's status" (index + o/<id>).

async function setStatus(store, id, status) {
  let index = (await store.get("index", { type: "json" })) || [];
  const before = index.find((r) => r.id === id);
  index = index.map((r) => (r.id === id ? { ...r, status } : r));
  const order = await store.get("o/" + id, { type: "json" });
  if (order) {
    order.status = status;
    await store.setJSON("o/" + id, order);
  }
  await store.setJSON("index", index);
  return { order, changed: !before || before.status !== status, prevStatus: before && before.status };
}

async function afterStatusChange(store, order, status, changed) {
  if (!changed || !order) return;
  const notify = require("./notify");
  const av = require("./availability");
  try {
    if (status === "confirmed") await notify.sendConfirmation(order);
    else if (status === "declined") {
      await notify.sendDecline(order);
      await av.releaseSlot(store, order);
    }
  } catch (_) { /* best effort */ }
}

module.exports = { setStatus, afterStatusChange };
