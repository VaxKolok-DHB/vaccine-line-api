process.on("uncaughtException",  (err) => { console.error("UNCAUGHT:", err); });
process.on("unhandledRejection", (err) => { console.error("REJECTION:", err); });

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const { answerQuestion } = require("./answer");
const app     = express();

app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// =====================
// CONFIG
// =====================
const TOKEN = process.env.LINE_TOKEN || "h2xP7qrpsi61rF8PsP9cXAD1IW4xPidRomIj3x4Jk0XyUiJ75t5pMz1mKA/0mjtOzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3QXBInmGRAOvjiift6fNcQ492IMKgv+vEpM8BqlcT8kVAdB04t89/1O/w1cDnyilFU=";
const DB    = process.env.DB_URL || "https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com";

const MAX_NORMAL      = 5;
const MAX_STEP        = 5;
const REMINDER_DELAY  = parseInt(process.env.REMINDER_DELAY)  || 30 * 60 * 1000; // ✅ เตือนซ้ำทุก 30 นาที
const MAX_REMIND_COUNT= parseInt(process.env.MAX_REMIND_COUNT) || 2;              // ✅ เตือนซ้ำสูงสุด 2 ครั้ง
const HOSPITAL_CONTACT_URL = process.env.HOSPITAL_CONTACT_URL || "https://vaxkolok-dhb.github.io/hospital-contact/";
const SEVERE_SYMPTOM_TEXT  = "รุนแรง(มีอาการชัก ยกแขนไม่ได้)"; // ✅ ข้อความอาการรุนแรงต้องตรงกับปุ่มใน buildSymptomQuickReply

// =====================
// Helpers
// =====================
function thaiTime() {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

const FOLLOW_DELAYS = {
  1: parseInt(process.env.DELAY_1) || 30 * 60 * 1000,
  2: parseInt(process.env.DELAY_2) ||  6 * 60 * 60 * 1000,
  3: parseInt(process.env.DELAY_3) || 24 * 60 * 60 * 1000,
  4: parseInt(process.env.DELAY_4) ||  3 * 24 * 60 * 60 * 1000,
  5: parseInt(process.env.DELAY_5) ||  7 * 24 * 60 * 60 * 1000,
};

function getNextFollowTime(step) {
  const delay = FOLLOW_DELAYS[step];
  if (!delay) return null;
  return Date.now() + delay;
}

// ✅ แนบ childKey ต่อท้ายด้วย "::" เพื่อให้รู้แน่ชัดว่าคำตอบนี้เป็นของเด็กคนไหน
// (แก้ปัญหาผู้ปกครองที่มีลูกหลายคน ตอบแบบสอบถามแล้วไปอัปเดตข้อมูลของลูกคนอื่นแทน)
function buildSymptomQuickReply(childKey) {
  const suffix = childKey ? `::${childKey}` : "";
  return [
    { type: "action", action: { type: "message", label: "😊 ปกติ",          text: `อาการ: ปกติ${suffix}` } },
    { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ",         text: `อาการ: ไข้ต่ำ${suffix}` } },
    { type: "action", action: { type: "message", label: "💉 ปวด/บวมฉีดวัคซีน", text: `อาการ: ปวดหรือบวมบริเวณฉีด${suffix}` } },
    { type: "action", action: { type: "message", label: "🔥 ไข้สูง",          text: `อาการ: ไข้สูง${suffix}` } },
    { type: "action", action: { type: "message", label: "🚨 อาการรุนแรง",     text: `อาการ: รุนแรง(มีอาการชัก ยกแขนไม่ได้)${suffix}` } },
  ];
}

// =====================
// Firebase helpers (axios REST)
// =====================
async function fbGet(path) {
  const r = await axios.get(`${DB}/${path}.json`);
  return r.data || null;
}
async function fbSet(path, data)   { await axios.put(`${DB}/${path}.json`, data); }
async function fbPatch(path, data) { await axios.patch(`${DB}/${path}.json`, data); }
async function fbDelete(path)      { await axios.delete(`${DB}/${path}.json`); }

// =====================
// LINE Messaging helpers
// =====================
const LINE_HEADERS = () => ({
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
});

async function reply(replyToken, text) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text }] },
      { headers: LINE_HEADERS() }
    );
  } catch (err) {
    console.error("reply error:", err.response?.data || err.message);
  }
}

async function replyFlex(replyToken, altText, flexContents) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "flex", altText, contents: flexContents }] },
      { headers: LINE_HEADERS() }
    );
  } catch (err) {
    console.error("replyFlex error:", err.response?.data || err.message);
  }
}

// ✅ ตอบกลับพร้อมแนบปุ่ม quick reply (ใช้กับ flow ยืนยันอาการรุนแรง / เลือกอาการใหม่)
async function replyQuick(replyToken, text, items) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text, quickReply: { items } }] },
      { headers: LINE_HEADERS() }
    );
  } catch (err) {
    console.error("replyQuick error:", err.response?.data || err.message);
  }
}

async function push(userId, text, quickReply = null) {
  try {
    const msg = { type: "text", text };
    if (quickReply) msg.quickReply = { items: quickReply };
    const r = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to: userId, messages: [msg] },
      { headers: LINE_HEADERS() }
    );
    console.log(`✅ push → ${userId} OK:`, r.status);
    return true;
  } catch (err) {
    console.error("push error:", err.response?.data || err.message);
    return false;
  }
}

async function pushMessages(userId, messages) {
  try {
    const r = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to: userId, messages },
      { headers: LINE_HEADERS() }
    );
    console.log(`✅ pushMessages → ${userId} OK:`, r.status);
    return { ok: true };
  } catch (err) {
    const status = err.response?.status || null;
    const data   = err.response?.data   || null;
    console.error("pushMessages error:", status, data || err.message);
    return { ok: false, status, data, message: err.message };
  }
}

// ✅ ตรวจว่า error จาก LINE Push API เป็นกรณี "ผู้ปกครอง block/unfriend LINE OA" หรือไม่
// LINE จะตอบ 400 พร้อมข้อความทำนอง "The user hasn't added the bot as a friend (or has blocked the bot)."
function isLineUnfriendedError(pushResult) {
  if (!pushResult || pushResult.ok) return false;
  const msg = JSON.stringify(pushResult.data || pushResult.message || "").toLowerCase();
  return pushResult.status === 400 && (msg.includes("friend") || msg.includes("blocked"));
}

// =====================
// คำนวณระดับอาการ
// =====================
function classifySymptom(symptom) {
  let level = "🟢 ปกติ", status = "ติดตามแล้ว", priority = 3;
  if (symptom.includes("ไข้ต่ำ") || symptom.includes("ปวด") || symptom.includes("บวม")) {
    level = "🟠 เฝ้าระวัง"; status = "เฝ้าติดตาม"; priority = 2;
  }
  if (symptom.includes("ไข้สูง") || symptom.includes("รุนแรง") || symptom.includes("ชัก")) {
    level = "🔴 ต้องติดตามใกล้ชิด"; status = "ด่วน"; priority = 1;
  }
  return { level, status, priority };
}

// =====================
// คำแนะนำการดูแลเบื้องต้นตามอาการ
// =====================
function buildCareAdvice(symptom) {
  if (symptom.includes("ไข้ต่ำ")) {
    return (
      "🤒 การดูแลเบื้องต้นเมื่อมีไข้ต่ำ\n" +
      "• เช็ดตัวลดไข้ด้วยน้ำอุ่น (ไม่ใช้น้ำเย็นจัด)\n" +
      "• ให้ดื่มน้ำ/นมมากกว่าปกติ\n" +
      "• สวมเสื้อผ้าบางเบา ไม่ห่มผ้าหนา\n" +
      "• หากมีไข้ ให้ยาลดไข้พาราเซตามอลตามน้ำหนักตัว/คำแนะนำแพทย์\n" +
      "• วัดไข้ซ้ำทุก 4 ชั่วโมง หากไข้ไม่ลดหรือสูงขึ้น กรุณาแจ้งเจ้าหน้าที่"
    );
  }
  if (symptom.includes("ปวด") || symptom.includes("บวม")) {
    return (
      "💉 การดูแลเบื้องต้นบริเวณที่ฉีดวัคซีน\n" +
      "• ประคบเย็นบริเวณที่ปวด/บวม ครั้งละ 15-20 นาที\n" +
      "• หลีกเลี่ยงการนวดหรือกดบริเวณที่ฉีด\n" +
      "• ให้ขยับแขน/ขาได้ตามปกติ ไม่ต้องงดใช้งาน\n" +
      "• หากปวดมาก ให้ยาแก้ปวดพาราเซตามอลตามคำแนะนำแพทย์\n" +
      "• หากบวมแดงมากขึ้น มีหนอง หรือไข้ร่วมด้วย กรุณาแจ้งเจ้าหน้าที่ทันที"
    );
  }
  if (symptom.includes("ไข้สูง")) {
    return (
      "🔥 การดูแลเมื่อมีไข้สูง\n" +
      "• เช็ดตัวลดไข้ด้วยน้ำอุ่นอย่างต่อเนื่อง\n" +
      "• ให้ยาลดไข้พาราเซตามอลตามน้ำหนักตัว\n" +
      "• ให้ดื่มน้ำเพียงพอ สังเกตอาการซึม/ไม่ตอบสนอง/ชัก\n" +
      "• วัดไข้ซ้ำทุก 1-2 ชั่วโมง\n\n" +
      `📞 หากไข้ไม่ลดหรือกังวล ติดต่อสอบถามเจ้าหน้าที่ได้ที่: ${HOSPITAL_CONTACT_URL}`
    );
  }
  return "✅ อาการปกติ ให้สังเกตอาการต่อไป";
}

// =====================
// สร้างข้อความ Follow-up
// =====================
function buildFollowUpMessage(step, name, symptomText, hn, childKey) {
  const periods = {
    1: "ใน 30 นาทีที่ผ่านมา",
    2: "ใน 6 ชั่วโมงที่ผ่านมา",
    3: "ใน 24 ชั่วโมงที่ผ่านมา",
    4: "ใน 3 วันที่ผ่านมา",
    5: "ใน 1 สัปดาห์ที่ผ่านมา",
  };
  const period = periods[step] || `รอบที่ ${step}`;
  return {
    type: "text",
    text:
      `📋 ติดตามอาการหลังฉีดวัคซีน ${period}\n\n` +
      `👶 คุณ${name} (HN: ${hn})\n\n` +
      `กรุณาเลือกอาการล่าสุดของน้อง:`,
    quickReply: { items: buildSymptomQuickReply(childKey) },
  };
}

// =====================
// Webhook
// =====================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const events = req.body.events || [];
  for (const e of events) {
    try {
      await handleEvent(e);
    } catch (err) {
      console.error("event error:", err.response?.data || err.message);
    }
  }
});

async function handleEvent(e) {
  if (!e) return;

  if (e.type === "follow") {
    await push(e.source.userId,
      "👋 ยินดีต้อนรับสู่ระบบ VaxKolok 🏥\n\nกรุณาลงทะเบียนโดยพิมพ์:\nลงทะเบียน [HN]\n\nตัวอย่าง: ลงทะเบียน 12345"
    );
    return;
  }

  if (e.type !== "message" || e.message?.type !== "text") return;

  const text   = e.message.text.trim();
  const userId = e.source.userId;
  console.log(`📩 [${userId}] "${text}"`);

  // ================================================================
  // 1) ลงทะเบียน HN
  // ================================================================
  if (/^ลงทะเบียน/i.test(text)) {
    const hn = text.replace(/^ลงทะเบียน\s*:?\s*/i, "").replace(/\D/g, "").trim();
    if (!hn) {
      await reply(e.replyToken, "❌ กรุณาระบุ HN เช่น:\nลงทะเบียน 12345");
      return;
    }
    console.log("HN =", hn);

    const children = await fbGet("children") || {};
    const matches  = [];
    for (const key in children) {
      if (String(children[key].hn || "").trim() === hn) {
        matches.push({ key, ...children[key] });
      }
    }

    if (matches.length === 0) {
      await reply(e.replyToken, "❌ ไม่พบข้อมูล HN นี้ในระบบ\nกรุณาติดต่อเจ้าหน้าที่");
      return;
    }

    if (matches.length === 1) {
      const child = matches[0];
      const msg = {
        type: "text",
        text: `🔍 พบข้อมูล\n\n👶 ชื่อ : ${child.name}\n🏥 HN  : ${hn}\n\nกรุณายืนยันข้อมูล`,
        quickReply: {
          items: [
            { type: "action", action: { type: "message", label: "✅ ยืนยัน", text: `__confirm__${hn}__${child.key}` } },
            { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: `__cancel__` } }
          ]
        }
      };
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        { replyToken: e.replyToken, messages: [msg] },
        { headers: LINE_HEADERS() }
      );
      await fbSet(`pendingRegister/${userId}`, {
        hn, childKey: child.key, requireName: false, createdAt: Date.now(),
      });
    } else {
      // ✅ HN ซ้ำหลายรายการ: ให้เลือกจากปุ่ม (quick reply) แทนการพิมพ์ยืนยันชื่อเอง
      // ตัดเหลือ 12 รายการแรก (LINE จำกัด quick reply ไม่เกิน 13 ปุ่ม เผื่อ 1 ปุ่มไว้ยกเลิก)
      const list = matches.slice(0, 12);
      const listText = list
        .map((c, i) => {
          const cidDigits = String(c.cid || "").replace(/\D/g, "");
          const cidLabel  = cidDigits ? ` (เลขบัตร ปชช. ...${cidDigits.slice(-4)})` : "";
          return `${i + 1}. ${c.name || "ไม่ระบุชื่อ"}${cidLabel}`;
        })
        .join("\n");
      const moreNote = matches.length > list.length
        ? `\n\n(แสดง ${list.length} จาก ${matches.length} รายการ หากไม่พบชื่อที่ต้องการ กรุณาติดต่อเจ้าหน้าที่)`
        : "";

      const items = list.map((c, i) => ({
        type: "action",
        action: { type: "message", label: `เลือกที่ ${i + 1}`, text: `__confirm__${hn}__${c.key}` }
      }));
      items.push({ type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "__cancel__" } });

      const msg = {
        type: "text",
        text: `⚠️ HN ${hn} มีหลายรายการ (${matches.length} รายการ)\nกรุณาเลือกรายการที่ถูกต้อง:\n\n${listText}${moreNote}`,
        quickReply: { items }
      };
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        { replyToken: e.replyToken, messages: [msg] },
        { headers: LINE_HEADERS() }
      );
      await fbSet(`pendingRegister/${userId}`, { hn, requireName: true, createdAt: Date.now() });
    }
    return;
  }

  // ================================================================
  // 1.5) ยืนยันด้วยชื่อ (กรณี HN ซ้ำ)
  // ================================================================
  if (/^ยืนยัน\s+\d+/i.test(text)) {
    const m = text.match(/^ยืนยัน\s+(\d+)\s+(.+)$/i);
    if (!m) {
      await reply(e.replyToken, "❌ รูปแบบไม่ถูกต้อง\nตัวอย่าง: ยืนยัน 12345 ด.ช.เอ บี");
      return;
    }
    const hn        = m[1].trim();
    const nameInput = m[2].trim().replace(/\s+/g, " ").toLowerCase();

    const children   = await fbGet("children") || {};
    const candidates = Object.entries(children).filter(([, c]) => String(c.hn || "").trim() === hn);
    if (candidates.length === 0) {
      await reply(e.replyToken, "❌ ไม่พบ HN นี้ กรุณาติดต่อเจ้าหน้าที่");
      return;
    }
    const found = candidates.find(([, c]) =>
      String(c.name || "").trim().toLowerCase().replace(/\s+/g, " ") === nameInput
    );
    if (!found) {
      await reply(e.replyToken, "❌ ไม่พบชื่อที่ตรงกับ HN นี้\nกรุณาตรวจสอบการสะกดอีกครั้ง");
      return;
    }
    const [childKey, child] = found;
    const msg = {
      type: "text",
      text: `🔍 พบข้อมูล\n\n👶 ชื่อ : ${child.name}\n🏥 HN  : ${hn}\n\nกรุณายืนยันข้อมูล`,
      quickReply: {
        items: [
          { type: "action", action: { type: "message", label: "✅ ยืนยัน", text: `__confirm__${hn}__${childKey}` } },
          { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: `__cancel__` } }
        ]
      }
    };
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken: e.replyToken, messages: [msg] },
      { headers: LINE_HEADERS() }
    );
    await fbSet(`pendingRegister/${userId}`, { hn, childKey, requireName: false, createdAt: Date.now() });
    return;
  }

  // ================================================================
  // 2) ยืนยันการลงทะเบียน __confirm__<hn>__<childKey>
  // ================================================================
  if (text.startsWith("__confirm__")) {
    const parts    = text.split("__").filter(Boolean);
    const hnInput  = parts[1];
    const childKey = parts[2];

    const children = await fbGet("children") || {};
    const child    = children[childKey];
    if (!child) {
      await reply(e.replyToken, "❌ ไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่");
      return;
    }

    const now       = Date.now();
    const step1Time = getNextFollowTime(1);

    await fbSet(`symptoms/${childKey}`, {
      childKey, userId,
      name:     child.name     || "",
      hn:       child.hn       || "",
      cid:      child.cid      || "",
      phone:    child.phone    || "",
      birth:    child.birth    || "",
      tambon:   child.tambon   || "",
      hospital: child.hospital || "",
      house:    child.house    || "",
      village:  child.village  || "",
      vaccines: child.vaccines || {},
      symptom: "", level: "🟢 ปกติ", status: "รอติดตาม",
      priority: 3, assignedTo: "", followStep: 1, normalCount: 0,
      nextFollowUp: step1Time, registeredAt: now,
      lastAskedAt: null, sentFollowStep: null,
      remindCount: 0, lastRemindAt: null, noResponseAlert: false, // ✅ เพิ่ม field ใหม่
      updatedAt: now, closedAt: null, time: now,
    });

    await fbPatch(`children/${childKey}`, { lineUserId: userId, updatedAt: thaiTime() });
    await fbDelete(`pendingRegister/${userId}`);

    await replyFlex(e.replyToken, "✅ ลงทะเบียนสำเร็จ", {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#0e9f6e", paddingAll: "20px",
        contents: [
          { type: "text", text: "✅ ลงทะเบียนสำเร็จ",              color: "#ffffff", size: "lg", weight: "bold" },
          { type: "text", text: "ระบบติดตามวัคซีนเด็ก VaxKolok", color: "#d1fae5", size: "xs", margin: "sm" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "20px",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "👶 ชื่อ",  size: "sm", color: "#6b7280", flex: 2 },
            { type: "text", text: child.name || "-", size: "sm", color: "#0d1b2a", weight: "bold", flex: 5, wrap: true }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "🏥 HN",    size: "sm", color: "#6b7280", flex: 2 },
            { type: "text", text: hnInput,     size: "sm", color: "#0d1b2a", weight: "bold", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "📋 สถานะ", size: "sm", color: "#6b7280", flex: 2 },
            { type: "text", text: "รอติดตาม", size: "sm", color: "#0e9f6e", weight: "bold", flex: 5 }
          ]},
          { type: "separator", margin: "md" },
          { type: "text", text: "⏱ ระบบจะส่งแบบประเมินอาการใน 30 นาที", size: "xs", color: "#6b7280", wrap: true, margin: "md" }
        ]
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#f9fafb",
        contents: [{ type: "text", text: `🕒 ${thaiTime()}`, size: "xs", color: "#9ca3af", align: "center" }]
      }
    });

    console.log(`✅ ลงทะเบียนแล้ว: ${child.name} (${hnInput}) childKey=${childKey}`);
    return;
  }

  // ================================================================
  // 3) ยกเลิก
  // ================================================================
  if (text === "__cancel__") {
    await fbDelete(`pendingRegister/${userId}`);
    await reply(e.replyToken, "❌ ยกเลิกการลงทะเบียนแล้ว\n\nพิมพ์ ลงทะเบียน [HN] เพื่อเริ่มใหม่");
    return;
  }

  // ================================================================
  // 3.5) ยืนยัน/ยกเลิก อาการรุนแรง __confirm_severe__::<childKey> / __cancel_severe__::<childKey>
  // ================================================================
  if (text.startsWith("__confirm_severe__")) {
    const childKey = text.split("::")[1];
    const follow   = childKey ? await fbGet(`symptoms/${childKey}`) : null;

    if (!follow) {
      await reply(e.replyToken, "❌ ไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่โดยตรง โทร 1669");
      return;
    }

    const now = Date.now();
    await fbPatch(`symptoms/${childKey}`, {
      userId, symptom: SEVERE_SYMPTOM_TEXT,
      level: "🔴 ต้องติดตามใกล้ชิด", status: "ด่วน", priority: 1,
      nextFollowUp: null, lastAskedAt: null,
      remindCount: 0, lastRemindAt: null, noResponseAlert: false,
      updatedAt: now, time: now,
    });

    await replyQuick(
      e.replyToken,
      `🚨 อาการรุนแรง กรุณาขอความช่วยเหลือทันที!\n\n` +
        `👶 ${follow.name || "-"}\n` +
        `🩺 อาการ: ชัก / ยกแขนไม่ได้\n\n` +
        `กดปุ่มด้านล่างเพื่อโทรสายด่วน 1669 ทันที ทีมเจ้าหน้าที่ของเราได้รับแจ้งเคสด่วนนี้แล้วเช่นกัน`,
      [{ type: "action", action: { type: "uri", label: "📞 โทร 1669 ทันที", uri: "tel:1669" } }]
    );
    console.log(`🚨 อาการรุนแรงยืนยันแล้ว: ${follow.name} (${childKey})`);
    return;
  }

  if (text.startsWith("__cancel_severe__")) {
    const childKey = text.split("::")[1];
    await replyQuick(
      e.replyToken,
      "กรุณาเลือกอาการล่าสุดของน้องอีกครั้ง:",
      buildSymptomQuickReply(childKey)
    );
    return;
  }

  // ================================================================
  // 4) รับรายงานอาการ
  // ================================================================
  if (text.startsWith("อาการ:")) {
    let body = text.slice("อาการ:".length).trim();

    // ✅ ปุ่มตอบอาการรุ่นใหม่จะแนบ "::<childKey>" ต่อท้าย เพื่อระบุชัดเจนว่าเป็นของเด็กคนไหน
    // (กันปัญหาผู้ปกครองที่มีลูกหลายคน ตอบแบบสอบถามแล้วไปอัปเดตข้อมูลของลูกอีกคนแทน)
    let symptom = body, targetChildKey = null;
    const sepIdx = body.lastIndexOf("::");
    if (sepIdx !== -1) {
      symptom        = body.slice(0, sepIdx).trim();
      targetChildKey = body.slice(sepIdx + 2).trim();
    }

    let childKey = null, follow = null;

    if (targetChildKey) {
      // มีการระบุเด็กมาชัดเจนจากปุ่ม — ใช้ตัวนี้โดยตรง ไม่ต้องเดา
      const f = await fbGet(`symptoms/${targetChildKey}`);
      if (f) { childKey = targetChildKey; follow = f; }
    }

    if (!childKey) {
      // ⚠️ Fallback (ข้อความเก่าที่ไม่มี childKey แนบมา หรือพิมพ์ "อาการ: ..." เอง)
      // จะเดาจากรายการล่าสุดที่ยังไม่ปิดเคสของ userId นี้ อาจผิดคนได้ถ้ามีลูกหลายคน
      const symptomsAll = await fbGet("symptoms") || {};
      let latestKey = null, latestTime = -1;
      for (const key in symptomsAll) {
        const s = symptomsAll[key];
        if (s.userId !== userId || s.closedAt) continue;
        const t = s.lastAskedAt || s.updatedAt || 0;
        if (t > latestTime) { latestTime = t; latestKey = key; }
      }
      if (latestKey) { childKey = latestKey; follow = symptomsAll[latestKey]; }
    }

    if (!childKey) {
      const children = await fbGet("children") || {};
      for (const key in children) {
        if (children[key].lineUserId === userId) { childKey = key; break; }
      }
      if (!childKey) {
        await reply(e.replyToken, "❌ ไม่พบข้อมูลการลงทะเบียน\nกรุณาส่ง: ลงทะเบียน [HN]");
        return;
      }
      follow = await fbGet(`symptoms/${childKey}`) || {};
    }

    // ✅ อาการรุนแรง: ต้องให้ผู้ปกครองยืนยันก่อน แล้วค่อยส่งปุ่มโทร 1669 ทันที
    // (ไม่บันทึกลง Firebase หรือปิดเคสจนกว่าจะกดยืนยัน)
    if (symptom === SEVERE_SYMPTOM_TEXT) {
      await replyQuick(
        e.replyToken,
        `⚠️ กรุณายืนยันอาการ\n\n` +
          `👶 ${follow.name || "-"}\n` +
          `คุณกำลังแจ้งว่าน้องมีอาการชักหรือยกแขนไม่ได้ ใช่หรือไม่?\n\n` +
          `หากยืนยัน ระบบจะแนะนำให้โทรสายด่วน 1669 ทันที`,
        [
          { type: "action", action: { type: "message", label: "✅ ยืนยัน อาการรุนแรง", text: `__confirm_severe__::${childKey}` } },
          { type: "action", action: { type: "message", label: "❌ ไม่ใช่ เลือกใหม่",   text: `__cancel_severe__::${childKey}` } },
        ]
      );
      return;
    }

    let normalCount = follow.normalCount || 0;
    if (symptom === "ปกติ") normalCount++; else normalCount = 0;

    const { level, status, priority } = classifySymptom(symptom);

    const vaccines    = follow.vaccines || {};
    const latestDate  = Object.values(vaccines).sort().pop() || "-";
    const vaccineText = Object.entries(vaccines)
      .filter(([, v]) => v === latestDate)
      .map(([k, v]) => `${k} (${v})`).join(", ") || "ไม่มีข้อมูล";

    if (normalCount >= MAX_NORMAL) {
      await fbPatch(`symptoms/${childKey}`, {
        symptom, status: "ปิดเคส", level: "🟢 ปกติ",
        priority: 99, normalCount: MAX_NORMAL,
        nextFollowUp: null, closedAt: Date.now(),
        updatedAt: Date.now(), time: Date.now(),
      });
      await reply(e.replyToken,
        `✅ อาการปกติครบ ${MAX_NORMAL} ครั้งติดกัน\n👶 ${follow.name}\n\nปิดเคสเรียบร้อย 🎉\nขอบคุณที่ติดตามอาการนะครับ`
      );
      return;
    }

    const advice = buildCareAdvice(symptom);

    const sentStep     = follow.sentFollowStep || follow.followStep || 1;
    const nextStep     = Math.min(sentStep + 1, MAX_STEP + 1);
    const nextFollowUp = nextStep <= MAX_STEP ? getNextFollowTime(nextStep) : null;

    // ✅ เมื่อผู้ปกครองตอบแล้ว → รีเซ็ต remind ทั้งหมด
    await fbPatch(`symptoms/${childKey}`, {
      userId, symptom, status, level, priority,
      normalCount,
      followStep:      nextStep,
      sentFollowStep:  null,
      lastAskedAt:     null,
      nextFollowUp,
      remindCount:     0,       // ✅ รีเซ็ตตัวนับ
      lastRemindAt:    null,    // ✅ รีเซ็ตเวลาเตือนซ้ำ
      noResponseAlert: false,   // ✅ ปิด flag แจ้งเตือน
      updatedAt: Date.now(),
      time:      Date.now(),
    });

    await reply(e.replyToken,
      `✅ รับข้อมูลแล้ว (รอบที่ ${sentStep}/${MAX_STEP})\n\n` +
      `👶 ${follow.name || "-"}\n` +
      `💉 ${vaccineText}\n` +
      `🩺 อาการ: ${symptom}\n` +
      `📌 ระดับ: ${level}\n\n` +
      `${advice}\n\n` +
      `🕒 ${thaiTime()}`
    );
    return;
  }

  // ================================================================
  // Default
  // ================================================================
  // ✅ กันข้อความชนกัน: ถ้าผู้ใช้อยู่ระหว่างขั้นตอน "ยืนยัน HN ชื่อ-นามสกุล" อยู่
  // (พิมพ์ผิดรูปแบบ เช่น ลืมคำว่า "ยืนยัน" หรือพิมพ์ "HN12345 ...")
  // ต้องเตือนกลับไปที่ขั้นตอนนี้ก่อน ห้ามปล่อยให้หลุดไปตอบด้วยระบบ FAQ (Answer.js)
  const pending = await fbGet(`pendingRegister/${userId}`);
  if (pending && pending.requireName) {
    await reply(e.replyToken,
      `⚠️ ยังไม่ได้ยืนยันตัวตนสำหรับ HN ${pending.hn}\n\n` +
      `กรุณากดปุ่ม "เลือกที่ ..." จากข้อความก่อนหน้านี้\n` +
      `หรือพิมพ์: ยืนยัน ${pending.hn} ชื่อ-นามสกุล\n\n` +
      `หรือพิมพ์ __cancel__ เพื่อยกเลิก`
    );
    return;
  }

  const answer = await answerQuestion(text);
  await reply(e.replyToken, answer);
}

// =====================
// Auto Follow-Up (ทุก 1 นาที)
// =====================
let isRunning = false;
async function autoFollowUp() {
  if (isRunning) return;
  isRunning = true;
  try {
    const symptoms = await fbGet("symptoms");
    if (!symptoms) return;

    const now  = Date.now();
    let   sent = 0;

    for (const key in symptoms) {
      const s = symptoms[key];
      if (!s.userId)  continue;
      if (s.closedAt) continue;

      // ─────────────────────────────────────────────
      // กรณีที่ 1: ถึงเวลา follow-up ปกติ
      // ─────────────────────────────────────────────
      if (s.nextFollowUp && now >= s.nextFollowUp) {
        const step      = s.followStep || 1;
        const childName = s.name || "น้อง";
        console.log(`📤 follow-up รอบ ${step}: ${childName} (${key})`);

        const ok = await push(
          s.userId,
          `📋 ติดตามอาการหลังฉีดวัคซีน รอบที่ ${step}/${MAX_STEP}\n\n` +
          `👶 ${childName}\n\n` +
          `กรุณาเลือกอาการล่าสุดของเด็ก:`,
          buildSymptomQuickReply(key)
        );

        if (ok) {
          await fbPatch(`symptoms/${key}`, {
            nextFollowUp:    null,
            lastAskedAt:     now,
            lastStep:        step,
            sentFollowStep:  step,
            remindCount:     0,     // ✅ รีเซ็ตทุกครั้งที่ส่งรอบใหม่
            lastRemindAt:    null,
            noResponseAlert: false,
          });
          sent++;
        }
        continue;
      }

      // ─────────────────────────────────────────────
      // กรณีที่ 2: ส่งไปแล้วแต่ไม่ตอบ → ส่งเตือนซ้ำ
      // ─────────────────────────────────────────────
      if (!s.nextFollowUp && s.lastAskedAt) {
        const remindCount  = s.remindCount  || 0;
        const lastRemindAt = s.lastRemindAt || s.lastAskedAt;
        const timeSince    = now - lastRemindAt;

        // ยังไม่ถึงเวลาเตือนซ้ำ
        if (timeSince < REMINDER_DELAY) continue;

        // เตือนครบแล้ว → ไม่ส่งเพิ่ม
        if (remindCount >= MAX_REMIND_COUNT) continue;

        const step      = s.sentFollowStep || s.followStep || 1;
        const childName = s.name || "น้อง";
        console.log(`🔔 เตือนซ้ำครั้งที่ ${remindCount + 1}/${MAX_REMIND_COUNT}: ${childName} (${key})`);

        const ok = await push(
          s.userId,
          `🔔 แจ้งเตือน: ยังไม่ได้รับการตอบกลับ\n\n` +
          `📋 ติดตามอาการหลังฉีดวัคซีน รอบที่ ${step}/${MAX_STEP}\n` +
          `👶 ${childName}\n\n` +
          `กรุณาเลือกอาการล่าสุดของน้อง\n` +
          `(เตือนครั้งที่ ${remindCount + 1}/${MAX_REMIND_COUNT})`,
          buildSymptomQuickReply(key)
        );

        if (ok) {
          const newCount = remindCount + 1;
          const patch    = {
            remindCount:  newCount,
            lastRemindAt: now,
            updatedAt:    now,
          };

          // เตือนครบแล้ว → ตั้ง flag ให้ dashboard
          if (newCount >= MAX_REMIND_COUNT) {
            patch.noResponseAlert = true;
            patch.status = (s.status === "ด่วน") ? "ด่วน" : "เฝ้าติดตาม";
            console.log(`⚠️ ไม่ตอบกลับครบ ${MAX_REMIND_COUNT} ครั้ง: ${childName} (${key})`);
          }

          await fbPatch(`symptoms/${key}`, patch);
          sent++;
        }
      }
    }

    if (sent > 0) console.log(`✅ ส่งทั้งหมด ${sent} ราย`);
  } catch (err) {
    console.error("autoFollowUp error:", err.message);
  } finally {
    isRunning = false;
  }
}

// =====================
// POST /api/resend-followup — ส่ง LINE ทันที
// =====================
app.post("/api/resend-followup", async (req, res) => {
  try {
    const { key, userId, name, step, hn } = req.body;

    if (!userId) return res.status(400).json({ message: "ไม่พบ userId" });
    if (!key)    return res.status(400).json({ message: "ไม่พบ key" });

    const s = await fbGet(`symptoms/${key}`);
    if (!s) return res.status(404).json({ message: "ไม่พบข้อมูลใน Firebase" });

    const actualStep = step || s.followStep || 1;
    const actualName = name || s.name || "ผู้ปกครอง";
    const actualHn   = hn   || s.hn   || "-";

    const message = buildFollowUpMessage(actualStep, actualName, s.symptom || "", actualHn, key);
    const pushResult = await pushMessages(userId, [message]);

    if (!pushResult.ok) {
      if (isLineUnfriendedError(pushResult)) {
        // ผู้ปกครอง block หรือ unfriend LINE OA ไปแล้ว — ส่งข้อความไม่ถึงแน่นอน
        // ไม่ใช่ server พัง จึงไม่ควรตอบ 500 กันเจ้าหน้าที่เข้าใจผิด
        return res.status(409).json({
          message: `❌ ส่งไม่สำเร็จ: ผู้ปกครองของ ${actualName} (HN: ${actualHn}) ยกเลิกเป็นเพื่อนหรือบล็อก LINE OA แล้ว กรุณาติดต่อโดยตรงทางโทรศัพท์แทน`,
          reason: "line_unfriended",
        });
      }
      // error อื่นจริงๆ (token หมดอายุ, LINE ล่ม ฯลฯ) — ยังเป็นฝั่งระบบ แต่แนบรายละเอียดไว้ช่วย debug
      return res.status(502).json({
        message: "ส่ง LINE ไม่สำเร็จ ตรวจสอบ Token หรือสถานะ LINE API",
        reason: "line_api_error",
        detail: pushResult.data || pushResult.message,
      });
    }

    const now = Date.now();
    await fbPatch(`symptoms/${key}`, {
      nextFollowUp:    null,
      lastAskedAt:     now,
      sentFollowStep:  actualStep,
      remindCount:     0,     // ✅ รีเซ็ตเมื่อ manual resend
      lastRemindAt:    null,
      noResponseAlert: false,
      updatedAt:       now,
    });

    console.log(`✅ resend-followup: ${actualName} (${key}) step=${actualStep}`);
    res.json({ ok: true, message: "ส่งสำเร็จ" });

  } catch (err) {
    console.error("[resend-followup]", err.message);
    res.status(500).json({ message: err.message });
  }
});

// =====================
// Health Check
// =====================
app.get("/health", (req, res) => res.json({
  status: "ok",
  time: thaiTime(),
  config: {
    REMINDER_DELAY_MIN:   REMINDER_DELAY / 60000,
    MAX_REMIND_COUNT,
    MAX_NORMAL,
    MAX_STEP,
  }
}));

// =====================
// Start
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VaxKolok server running on port ${PORT}`);
  console.log(`⏱ Auto follow-up: ทุก 1 นาที`);
  console.log(`🔔 เตือนซ้ำ: ทุก ${REMINDER_DELAY/60000} นาที, สูงสุด ${MAX_REMIND_COUNT} ครั้ง`);
  setInterval(autoFollowUp, 60 * 1000);
});
