"use strict";
let _tx = null;
function tx() {
  if (_tx) return _tx;
  const nodemailer = require("nodemailer");
  const port = Number(process.env.SMTP_PORT || 465);
  _tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _tx;
}
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ""));
const owner = () => process.env.OWNER_EMAIL || process.env.SMTP_USER;

const cfgBase = () => {
  try { return require("./booking-config.json").baseUrl || process.env.URL || ""; }
  catch { return process.env.URL || ""; }
};

async function sendBookingNotifications(rec) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.warn("notify: SMTP not set; skipping"); return; }
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  const base = cfgBase();
  const link = base ? `${base}/confirm?token=${encodeURIComponent(require("../booking-action").tokenFor(rec.id))}` : "";

  const text = `New ${rec.type} ${rec.id}\nName: ${rec.customer_name || ""}\nContact: ${rec.customer_contact || ""}\n` +
               `When: ${when}\nGuests: ${rec.guests || ""}\nNotes: ${rec.notes || ""}\nStatus: ${rec.status}` +
               (link ? `\n\nManage this booking: ${link}` : "");
  const html = `<p><b>New ${rec.type}</b> — ${rec.customer_name || "guest"}</p>` +
    `<p>When: ${when}<br>Guests: ${rec.guests || "?"}<br>Contact: ${rec.customer_contact || ""}<br>Notes: ${rec.notes || "—"}</p>` +
    (link ? `<p><a href="${link}" style="background:#1a7f4b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Review &amp; confirm</a></p>` +
            `<p style="color:#888;font-size:.85rem">Opens a page with Confirm / Decline buttons. Link valid 7 days.</p>` : "");

  await tx().sendMail({ from: owner(), to: owner(), subject: `New ${rec.type}: ${rec.customer_name || "guest"} — ${when}`, text, html })
    .catch((e) => console.warn("notify owner:", e.message));

  if (isEmail(rec.customer_contact)) {
    const menuUrl = (() => { try { return require("./booking-config.json").menuUrl; } catch { return ""; } })();
    await tx().sendMail({ from: owner(), to: rec.customer_contact,
      subject: "We received your reservation request",
      text: `Hi ${rec.customer_name || ""},\n\nWe received your request for ${when} (${rec.guests || "?"} guests). ` +
            `Our team will confirm shortly.\n\nReference: ${rec.id}` +
            (menuUrl ? `\n\nBrowse the menu while you wait (optional): ${menuUrl}` : "") +
            `\n— The Fisherman` })
      .catch((e) => console.warn("notify customer:", e.message));
  }
}

async function sendConfirmation(rec) {
  if (!process.env.SMTP_USER || !isEmail(rec.customer_contact)) return;
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  await tx().sendMail({ from: owner(), to: rec.customer_contact,
    subject: "Your table is confirmed — The Fisherman",
    text: `Hi ${rec.customer_name || ""},\n\nYour table for ${when} (${rec.guests || "?"} guests) is confirmed. ` +
          `See you soon!\n\nReference: ${rec.id}\n— The Fisherman` })
    .catch((e) => console.warn("confirm mail:", e.message));
}

async function sendDecline(rec) {
  if (!process.env.SMTP_USER || !isEmail(rec.customer_contact)) return;
  const when = [rec.date, rec.time].filter(Boolean).join(" ");
  await tx().sendMail({ from: owner(), to: rec.customer_contact,
    subject: "About your reservation request — The Fisherman",
    text: `Hi ${rec.customer_name || ""},\n\nSorry — we're unable to accommodate ${when} (${rec.guests || "?"} guests). ` +
          `Please try another time or message us on WhatsApp/Zalo and we'll help.\n\nReference: ${rec.id}\n— The Fisherman` })
    .catch((e) => console.warn("decline mail:", e.message));
}

module.exports = { sendBookingNotifications, sendConfirmation, sendDecline };
