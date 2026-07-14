process.on("uncaughtException",  (err) => { console.error("UNCAUGHT:", err); });
process.on("unhandledRejection", (err) => { console.error("REJECTION:", err); });

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const { answerQuestion } = require("./Answer");
const app     = express();

app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// =====================
// CONFIG
// =====================
const TOKEN = process.env.LINE_TOKEN || "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";
const DB    = process.env.DB_URL || "https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com";

const MAX_NORMAL      = 5;
const MAX_STEP        = 5;
const REMINDER_DELAY  = parseInt(process.env.REMINDER_DELAY)  || 30 * 60 * 1000; // ✅ เตือนซ้ำทุก 30 นาที
const MAX_REMIND_COUNT= parseInt(process.env.MAX_REMIND_COUNT) || 2;              // ✅ เตือนซ้ำสูงสุด 2 ครั้ง

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

const SYMPTOM_QUICK_REPLY = [
  { type: "action", action: { type: "message", label: "😊 ปกติ",          text: "อาการ: ปกติ" } },
  { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ",         text: "อาการ: ไข้ต่ำ" } },
  { type: "action", action: { type: "message", label: "💉 ปวด/บวมฉีดวัคซีน", text: "อาการ: ปวดหรือบวมบริเวณฉีด" } },
  { type: "action", action: { type: "message", label: "🔥 ไข้สูง",          text: "อาการ: ไข้สูง" } },
  { type: "action", action: { type: "message", label: "🚨 อาการรุนแรง",     text: "อาการ: รุนแรง(มีอาการชัก ยกแขนไม่ได้)" } },
];

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
    return true;
  } catch (err) {
    console.error("pushMessages error:", err.response?.data || err.message);
    return false;
  }
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
// สร้างข้อความ Follow-up
// =====================
function buildFollowUpMessage(step, name, symptomText, hn) {
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
    quickReply: { items: SYMPTOM_QUICK_REPLY },
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
      await reply(e.replyToken,
        `⚠️ HN ${hn} มีหลายรายการ\nกรุณายืนยันตัวตนโดยพิมพ์:\n\nยืนยัน ${hn} ชื่อ-นามสกุล`
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
  // 4) รับรายงานอาการ
  // ================================================================
  if (text.startsWith("อาการ:")) {
    const symptom = text.replace("อาการ:", "").trim();

    const symptomsAll = await fbGet("symptoms") || {};
    let childKey = null, follow = null;
    for (const key in symptomsAll) {
      if (symptomsAll[key].userId === userId) {
        childKey = key; follow = symptomsAll[key]; break;
      }
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

    let advice = "✅ อาการปกติ ให้สังเกตอาการต่อไป";
    if (level.includes("🟠")) advice = "⚠️ ควรเฝ้าระวัง วัดไข้ทุก 4 ชั่วโมง";
    if (level.includes("🔴")) advice = "🚨 อาการรุนแรง รอเจ้าหน้าที่รับเคสด่วน!";

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
      `กรุณาพิมพ์ตามรูปแบบนี้เท่านั้น:\nยืนยัน ${pending.hn} ชื่อ-นามสกุล\n\n` +
      `ตัวอย่าง: ยืนยัน ${pending.hn} ด.ช.เอ บี\n\n` +
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
          SYMPTOM_QUICK_REPLY
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
          SYMPTOM_QUICK_REPLY
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

    const message = buildFollowUpMessage(actualStep, actualName, s.symptom || "", actualHn);
    const ok      = await pushMessages(userId, [message]);

    if (!ok) {
      return res.status(500).json({ message: "ส่ง LINE ไม่สำเร็จ ตรวจสอบ Token หรือ userId" });
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
