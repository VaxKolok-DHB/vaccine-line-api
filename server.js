process.on("uncaughtException", (err) => { console.error("UNCAUGHT:", err); });
process.on("unhandledRejection", (err) => { console.error("REJECTION:", err); });

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// =====================
// CONFIG
// =====================
const TOKEN = process.env.LINE_TOKEN || "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";
const DB    = "https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com";

// =====================
// Helpers
// =====================
function thaiTime() {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

// 🔥 แก้ไข: delay ที่ถูกต้อง (ใช้ env override ได้สำหรับ test)
const FOLLOW_DELAYS = {
  1: parseInt(process.env.DELAY_1) || 30    * 1000,           // 30 วินาที
  2: parseInt(process.env.DELAY_2) || 1     * 60 * 60 * 1000, // 1 ชั่วโมง
  3: parseInt(process.env.DELAY_3) || 24    * 60 * 60 * 1000, // 24 ชั่วโมง
  4: parseInt(process.env.DELAY_4) || 48    * 60 * 60 * 1000, // 48 ชั่วโมง
};

function getNextFollowTime(step) {
  const delay = FOLLOW_DELAYS[step];
  if (!delay) return null;
  return Date.now() + delay;
}

const SYMPTOM_QUICK_REPLY = [
  { type: "action", action: { type: "message", label: "😊 ปกติ",    text: "อาการ: ปกติ" } },
  { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ",  text: "อาการ: ไข้ต่ำ" } },
  { type: "action", action: { type: "message", label: "💉 ปวด/บวม", text: "อาการ: ปวดหรือบวม" } },
  { type: "action", action: { type: "message", label: "🔥 ไข้สูง",  text: "อาการ: ไข้สูง" } },
  { type: "action", action: { type: "message", label: "🚨 รุนแรง",  text: "อาการ: รุนแรง" } },
];

// =====================
// Firebase helpers
// =====================
async function fbGet(path) {
  const r = await axios.get(`${DB}/${path}.json`);
  return r.data || null;
}

async function fbSet(path, data) {
  await axios.put(`${DB}/${path}.json`, data);
}

async function fbPatch(path, data) {
  await axios.patch(`${DB}/${path}.json`, data);
}

async function fbDelete(path) {
  await axios.delete(`${DB}/${path}.json`);
}

// =====================
// Messaging functions
// =====================
async function reply(replyToken, text) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text }] },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
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
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
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
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ push → ${userId} step OK:`, r.status);
    return true;
  } catch (err) {
    console.error("push error:", err.response?.data || err.message);
    return false;
  }
}

// =====================
// Webhook
// =====================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // ตอบ LINE ก่อนทันที ป้องกัน timeout

  try {
    const e = req.body.events?.[0];
    if (!e) return;
    if (e.type === "follow") {
  await push(e.source.userId, "👋 ยินดีต้อนรับสู่ระบบ VaxKolok 🏥\n\nกรุณาลงทะเบียนโดยพิมพ์:\nลงทะเบียน [HN]\n\nตัวอย่าง: ลงทะเบียน 12345");
  return;
}
if (e.type !== "message" || e.message?.type !== "text") return;

    const text   = e.message.text.trim();
    const userId = e.source.userId;

    console.log(`📩 [${userId}] "${text}"`);

    // ===== ลงทะเบียน HN =====
if (/^ลงทะเบียน/i.test(text)) {
  // แก้ตรงนี้
  const hn = text
  .replace(/^ลงทะเบียน\s*:?\s*/i, "")  // ตัดคำนำหน้าออกก่อน
  .replace(/\D/g, "")                   // แล้วค่อยเอาเฉพาะตัวเลข
  .trim();

  if (!hn) {
    await reply(
      e.replyToken,
      "❌ กรุณาระบุ HN เช่น:\nลงทะเบียน 12345"
    );
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
  await fbSet(`pendingRegister/${userId}`, {
    hn, childKey: child.key, requireName: false, createdAt: Date.now(),
  });
  // ✅ บันทึก userId ทันที
  await fbPatch(`children/${child.key}`, { lineUserId: userId, updatedAt: thaiTime() });
  
  await reply(e.replyToken,
    `🔍 พบข้อมูล\n\n👶 ชื่อ : ${child.name}\n🏥 HN  : ${hn}\n\nหากถูกต้อง พิมพ์:\n✅ ยืนยัน ${hn}`
  );
} else {
  await fbSet(`pendingRegister/${userId}`, {
    hn, requireName: true, createdAt: Date.now(),
  });
  // ✅ กรณี HN ซ้ำ ยังไม่รู้ว่าเป็นเด็กคนไหน รอยืนยันชื่อก่อน
  await reply(e.replyToken,
    `⚠️ HN ${hn} มีหลายรายการ\nกรุณายืนยันตัวตนโดยพิมพ์:\n\nยืนยัน ${hn} ชื่อ นามสกุล`
  );
}
}

    // ===== ยืนยันลงทะเบียน =====
    const cleanText = text.replace("✅", "").trim();
    if (cleanText.startsWith("ยืนยัน")) {
      const parts     = cleanText.replace("ยืนยัน", "").trim().split(/\s+/);
      const hnInput   = parts[0] || "";
      const nameInput = parts.slice(1).join(" ").trim();

      const pending = await fbGet(`pendingRegister/${userId}`);
      if (!pending || String(pending.hn || "").trim() !== hnInput) {
        await reply(e.replyToken, "❌ ไม่พบคำขอลงทะเบียน\nกรุณาพิมพ์: ลงทะเบียน [HN]");
        return;
      }

      const children = await fbGet("children") || {};
      let child = null, childKey = null;

      if (!pending.requireName) {
        childKey = pending.childKey;
        child    = children[childKey];
      } else {
        if (!nameInput) {
          await reply(e.replyToken, `❌ กรุณาระบุชื่อ-นามสกุล\nตัวอย่าง: ยืนยัน ${hnInput} สมชาย ใจดี`);
          return;
        }
        for (const key in children) {
          const c = children[key];
          if (
            String(c.hn || "").trim() === hnInput &&
            (c.name || "").replace(/\s+/g, "") === nameInput.replace(/\s+/g, "")
          ) {
            child = c; childKey = key; break;
          }
        }
        if (!child) {
          await reply(e.replyToken, "❌ ชื่อ-นามสกุลไม่ตรง กรุณาตรวจสอบอีกครั้ง");
          return;
        }
      }

      if (!child || !childKey) {
        await reply(e.replyToken, "❌ ไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่");
        return;
      }

      // 🔥 สร้าง symptoms record ที่ครบถ้วน (key เดียวกับ children)
    const now       = Date.now();
    const step1Time = getNextFollowTime(1);
    // ตรวจสอบว่าเคยลงทะเบียนแล้วหรือยัง
    const existing = await fbGet(`symptoms/${childKey}`);
    const isReRegister = existing && existing.registeredAt;

    const symptomData = {
        // --- ข้อมูลเด็ก (sync จาก children) ---
        childKey,
        userId,                          // 🔑 สำคัญ: LINE userId สำหรับ push
        name:         child.name     || "",
        hn:           child.hn       || "",
        cid:          child.cid      || "",
        phone:        child.phone    || "",
        birth:        child.birth    || "",
        tambon:       child.tambon   || "",
        hospital:     child.hospital || "",
        house:        child.house    || "",
        village:      child.village  || "",
        vaccines:     child.vaccines || {},
        // --- สถานะ ---
        symptom:      "",
        level:        "🟢 ปกติ",
        status:       "รอติดตาม",
        priority:     3,
        assignedTo:   "",
        followStep:   1,
        normalCount:  0,
        nextFollowUp: step1Time,         // 🔑 ตั้งเวลา follow-up รอบแรก
        registeredAt: now,
        updatedAt:    now,
        closedAt:     null,
        time:         now,
      };

      // บันทึก symptoms ใช้ childKey เดิม (ให้ app.js เจอ)
      await fbSet(`symptoms/${childKey}`, symptomData);

      // บันทึก lineUserId กลับไปที่ children ด้วย
      await fbPatch(`children/${childKey}`, { lineUserId: userId, updatedAt: thaiTime() });

      // ลบ pendingRegister
      await fbDelete(`pendingRegister/${userId}`);

      // ส่ง Flex confirm
      await replyFlex(e.replyToken, "✅ ลงทะเบียนสำเร็จ", {
        type: "bubble", size: "kilo",
        header: {
          type: "box", layout: "vertical",
          backgroundColor: "#0e9f6e", paddingAll: "20px",
          contents: [
            { type: "text", text: "✅ ลงทะเบียนสำเร็จ", color: "#ffffff", size: "lg", weight: "bold" },
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
              { type: "text", text: hnInput,    size: "sm", color: "#0d1b2a", weight: "bold", flex: 5 }
            ]},
            { type: "box", layout: "horizontal", contents: [
              { type: "text", text: "📋 สถานะ", size: "sm", color: "#6b7280", flex: 2 },
              { type: "text", text: "รอติดตาม", size: "sm", color: "#0e9f6e", weight: "bold", flex: 5 }
            ]},
            { type: "separator", margin: "md" },
            { type: "text", text: "⏱ ระบบจะส่งแบบประเมินอาการใน 30 วินาที", size: "xs", color: "#6b7280", wrap: true, margin: "md" }
          ]
        },
        footer: {
          type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#f9fafb",
          contents: [{ type: "text", text: `🕒 ${thaiTime()}`, size: "xs", color: "#9ca3af", align: "center" }]
        }
      });

      console.log(`✅ ลงทะเบียนแล้ว: ${child.name} (${hnInput}) childKey=${childKey} nextFollowUp=${new Date(step1Time).toISOString()}`);
      return;
    }

    // ===== รับอาการ =====
    if (text.startsWith("อาการ:")) {
      const symptom = text.replace("อาการ:", "").trim();

      // 🔥 หา childKey จาก symptoms/*/userId แทน children
      const symptomsAll = await fbGet("symptoms") || {};
      let childKey = null, follow = null;

      for (const key in symptomsAll) {
        if (symptomsAll[key].userId === userId) {
          childKey = key;
          follow   = symptomsAll[key];
          break;
        }
      }

      if (!childKey) {
        // fallback: หาจาก children/lineUserId
        const children = await fbGet("children") || {};
        for (const key in children) {
          if (children[key].lineUserId === userId) {
            childKey = key; break;
          }
        }
        if (!childKey) {
          await reply(e.replyToken, "❌ ไม่พบข้อมูลการลงทะเบียน\nกรุณาส่ง: ลงทะเบียน [HN]");
          return;
        }
        follow = await fbGet(`symptoms/${childKey}`) || {};
      }

      let normalCount = follow.normalCount || 0;
      let followStep  = follow.followStep  || 1;

      if (symptom === "ปกติ") { normalCount++; } else { normalCount = 0; }

      // ระดับอาการ
      let level = "🟢 ปกติ", status = "ติดตามแล้ว", priority = 3;
      if (symptom.includes("ไข้ต่ำ") || symptom.includes("ปวด") || symptom.includes("บวม")) {
        level = "🟠 เฝ้าระวัง"; status = "เฝ้าติดตาม"; priority = 2;
      }
      if (symptom.includes("ไข้สูง") || symptom.includes("รุนแรง")) {
        level = "🔴 ต้องติดตามใกล้ชิด"; status = "ด่วน"; priority = 1;
      }

      const vaccines    = follow.vaccines || {};
      const latestDate  = Object.values(vaccines).sort().pop() || "-";
      const vaccineText = Object.entries(vaccines)
        .filter(([, v]) => v === latestDate)
        .map(([k, v]) => `${k} (${v})`).join(", ") || "ไม่มีข้อมูล";

      // ปิดเคสอัตโนมัติเมื่อปกติ 4 ครั้งติดกัน
      if (normalCount >= 4) {
        await fbPatch(`symptoms/${childKey}`, {
          symptom, status: "ปิดเคส", level: "🟢 ปกติ",
          priority: 99, normalCount: 4,
          nextFollowUp: null, closedAt: Date.now(), updatedAt: Date.now(),
        });
        await reply(e.replyToken,
          `✅ อาการปกติครบ 4 ครั้งติดกัน\n👶 ${follow.name}\n\nปิดเคสเรียบร้อย 🎉\nขอบคุณที่ติดตามอาการนะครับ`
        );
        return;
      }

      // คำแนะนำ
      let advice = "✅ อาการปกติ ให้สังเกตอาการต่อไป";
      if (level.includes("🟠")) advice = "⚠️ ควรเฝ้าระวัง วัดไข้ทุก 4 ชั่วโมง";
      if (level.includes("🔴")) advice = "🚨 อาการรุนแรง รอเจ้าหน้าที่รับเคสด่วน!";

      const nextStep     = Math.min(followStep + 1, 5);
      const nextFollowUp = getNextFollowTime(nextStep) || null;

      // 🔥 อัปเดต symptoms (เก็บ userId ไว้เสมอ)
      await fbPatch(`symptoms/${childKey}`, {
        userId,                    // รักษา userId ไว้
        symptom, status, level, priority,
        normalCount,
        followStep:  nextStep,
        nextFollowUp,
        updatedAt:   Date.now(),
        time:        Date.now(),
      });

      await reply(e.replyToken,
        `✅ รับข้อมูลแล้ว (รอบที่ ${followStep}/4)\n\n` +
        `👶 ${follow.name || "-"}\n` +
        `💉 ${vaccineText}\n` +
        `🩺 อาการ: ${symptom}\n` +
        `📌 ระดับ: ${level}\n\n` +
        `${advice}\n\n` +
        `🕒 ${thaiTime()}`
      );
      return;
    }

    // Default
    await reply(e.replyToken,
      "ยินดีต้อนรับสู่ระบบ VaxKolok 🏥\n\nพิมพ์:\nลงทะเบียน [HN]\n\nตัวอย่าง: ลงทะเบียน 12345"
    );

  } catch (err) {
    console.error("webhook error:", err.response?.data || err.message);
  }
});

// =====================
// Auto Follow-Up (ทุก 1 นาที)
// =====================
async function autoFollowUp() {
  try {
    const symptoms = await fbGet("symptoms");
    if (!symptoms) return;

    const now = Date.now();
    let sent  = 0;

    for (const key in symptoms) {
      const s = symptoms[key];

      // ข้ามเคสที่ปิดแล้ว, ไม่มี userId, หรือยังไม่ถึงเวลา
      if (!s.userId)         continue;
      if (s.closedAt)        continue;
      if (!s.nextFollowUp)   continue;
      if (now < s.nextFollowUp) continue;

      const step      = s.followStep || 1;
      const stepLabel = step <= 4 ? `รอบที่ ${step}/4` : "รอบสุดท้าย";
      const childName = s.name || "น้อง";

      console.log(`📤 auto follow-up: ${childName} (${key}) step=${step} userId=${s.userId}`);

      const ok = await push(
        s.userId,
        `📋 ติดตามอาการหลังฉีดวัคซีน ${stepLabel}\n\n👶 ${childName}\n\nกรุณาเลือกอาการล่าสุดของเด็ก:`,
        SYMPTOM_QUICK_REPLY
      );

      if (ok) {
        // 🔥 set nextFollowUp = null ป้องกัน spam (จะตั้งใหม่เมื่อผู้ปกครองตอบกลับ)
        await fbPatch(`symptoms/${key}`, {
          nextFollowUp: null,
          lastAskedAt:  now,
          lastStep:     step,
        });
        sent++;
      }
    }

    if (sent > 0) console.log(`✅ auto follow-up ส่งแล้ว ${sent} ราย`);

  } catch (err) {
    console.error("autoFollowUp error:", err.message);
  }
}

// =====================
// Health Check
// =====================
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: thaiTime() });
});

// =====================
// Start
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VaxKolok server running on port ${PORT}`);
  console.log(`⏱ Auto follow-up: ทุก 1 นาที`);
  setInterval(autoFollowUp, 60 * 1000);
});
