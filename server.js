process.on("uncaughtException", (err) => { console.error("UNCAUGHT:", err); });
process.on("unhandledRejection", (err) => { console.error("REJECTION:", err); });

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";
const DB    = "https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com";

// =====================
// Helpers
// =====================
function thaiTime() {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

const FOLLOW_DELAYS = {
  1: 30 * 1000,
  2: 1  * 60 * 60 * 1000,
  3: 24 * 60 * 60 * 1000,
  4: 48 * 60 * 60 * 1000,
};
function getNextFollowTime(step) {
  const delay = FOLLOW_DELAYS[step];
  return delay ? Date.now() + delay : null;
}

const SYMPTOM_QUICK_REPLY = [
  { type: "action", action: { type: "message", label: "😊 ปกติ",    text: "อาการ: ปกติ" } },
  { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ",  text: "อาการ: ไข้ต่ำ" } },
  { type: "action", action: { type: "message", label: "💉 ปวด/บวม", text: "อาการ: ปวดหรือบวม" } },
  { type: "action", action: { type: "message", label: "🔥 ไข้สูง",  text: "อาการ: ไข้สูง" } },
  { type: "action", action: { type: "message", label: "🚨 รุนแรง",  text: "อาการ: รุนแรง" } },
];

// =====================
// Messaging functions
// =====================
async function reply(replyToken, text) {
  try {
    const r = await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text }] },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log("reply OK:", r.status);
  } catch (err) {
    console.log("reply error:", err.response?.data || err.message);
  }
}

async function replyFlex(replyToken, altText, flexContents) {
  try {
    const r = await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "flex", altText, contents: flexContents }] },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log("replyFlex OK:", r.status);
  } catch (err) {
    console.log("replyFlex error:", err.response?.data || err.message);
  }
}

async function push(userId, text, quickReply = null) {
  try {
    const msg = { type: "text", text };
    if (quickReply) msg.quickReply = { items: quickReply };
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to: userId, messages: [msg] },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
  } catch (err) {
    console.log("push error:", err.response?.data || err.message);
  }
}

// =====================
// Webhook
// =====================
app.post("/webhook", async (req, res) => {
  try {
    const e = req.body.events?.[0];
    if (!e) return res.sendStatus(200);
    if (e.type !== "message" || e.message.type !== "text") return res.sendStatus(200);

    const text   = e.message.text.trim();
    const userId = e.source.userId;

    // ===== ขั้นตอนที่ 1: ลงทะเบียน HN =====
    if (text.startsWith("ลงทะเบียน")) {
      const hn = text.replace("ลงทะเบียน", "").trim();
      if (!hn) {
        await reply(e.replyToken, "❌ กรุณาระบุ HN เช่น: ลงทะเบียน 12345");
        return res.sendStatus(200);
      }

      const result   = await axios.get(`${DB}/children.json`);
      const children = result.data || {};
      const matches  = [];
      for (const key in children) {
        if (children[key].hn === hn) matches.push({ key, ...children[key] });
      }

      if (matches.length === 0) {
        await reply(e.replyToken, "❌ ไม่พบข้อมูล HN นี้ในระบบ");
        return res.sendStatus(200);
      }

      if (matches.length === 1) {
        const child = matches[0];
        await axios.put(`${DB}/pendingRegister/${userId}.json`, {
          hn, childKey: child.key, requireName: false, createdAt: Date.now(),
        });
        await reply(e.replyToken,
          `🔍 พบข้อมูล\n\n👤 ชื่อ : ${child.name}\n🏥 HN : ${hn}\n\nหากข้อมูลถูกต้อง พิมพ์\n\n✅ ยืนยัน ${hn}`
        );
      } else {
        await axios.put(`${DB}/pendingRegister/${userId}.json`, {
          hn, requireName: true, createdAt: Date.now(),
        });
        await reply(e.replyToken,
          `⚠️ พบข้อมูลหลายรายการสำหรับ HN ${hn}\n\nกรุณายืนยันตัวตนโดยพิมพ์\n\n✅ ยืนยัน ${hn} ชื่อ นามสกุล\n\nตัวอย่าง: ยืนยัน ${hn} สมชาย ใจดี`
        );
      }
      return res.sendStatus(200);
    }

    // ===== ขั้นตอนที่ 2: ยืนยันการลงทะเบียน =====
    const cleanText = text.replace("✅", "").trim();

    if (cleanText.startsWith("ยืนยัน")) {

      const parts = cleanText
        .replace("ยืนยัน", "")
        .trim()
        .split(/\s+/);

      const hnInput   = parts[0] || "";
      const nameInput = parts.slice(1).join(" ").trim();

      const pendingRes = await axios.get(`${DB}/pendingRegister/${userId}.json`);
      const pending    = pendingRes.data;

      if (!pending || pending.hn !== hnInput) {
        await reply(e.replyToken, "❌ ไม่พบคำขอลงทะเบียน กรุณาพิมพ์ ลงทะเบียน [HN] ใหม่อีกครั้ง");
        return res.sendStatus(200);
      }

      const result   = await axios.get(`${DB}/children.json`);
      const children = result.data || {};
      let child = null, childKey = null;

      if (!pending.requireName) {
        childKey = pending.childKey;
        child    = children[childKey];
      } else {
        if (!nameInput) {
          await reply(e.replyToken,
            `❌ HN นี้มีหลายรายการ กรุณาระบุชื่อ-นามสกุลเพื่อยืนยัน\n\nตัวอย่าง: ยืนยัน ${hnInput} สมชาย ใจดี`
          );
          return res.sendStatus(200);
        }
        for (const key in children) {
          const c = children[key];
          if (c.hn === hnInput && c.name?.replace(/\s+/g,"") === nameInput.replace(/\s+/g,"")) {
            child = c; childKey = key; break;
          }
        }
        if (!child) {
          await reply(e.replyToken, "❌ ชื่อ-นามสกุลไม่ตรงกับข้อมูลในระบบ กรุณาตรวจสอบอีกครั้ง");
          return res.sendStatus(200);
        }
      }

      if (!child) {
        await reply(e.replyToken, "❌ ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่");
        return res.sendStatus(200);
      }

      // ✅ แก้ไข: reply ก่อนทำ Firebase เพื่อป้องกัน replyToken หมดอายุ
      await replyFlex(e.replyToken, "✅ ลงทะเบียนสำเร็จ", {
        type: "bubble",
        size: "kilo",
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
            {
              type: "box", layout: "horizontal",
              contents: [
                { type: "text", text: "👶 ชื่อ",   size: "sm", color: "#6b7280", flex: 2 },
                { type: "text", text: child.name || "-", size: "sm", color: "#0d1b2a", weight: "bold", flex: 5, wrap: true }
              ]
            },
            {
              type: "box", layout: "horizontal",
              contents: [
                { type: "text", text: "🏥 HN",     size: "sm", color: "#6b7280", flex: 2 },
                { type: "text", text: hnInput,      size: "sm", color: "#0d1b2a", weight: "bold", flex: 5 }
              ]
            },
            {
              type: "box", layout: "horizontal",
              contents: [
                { type: "text", text: "📋 สถานะ",  size: "sm", color: "#6b7280", flex: 2 },
                { type: "text", text: "รอติดตาม",  size: "sm", color: "#0e9f6e", weight: "bold", flex: 5 }
              ]
            },
            { type: "separator", margin: "md" },
            {
              type: "text",
              text: "⏱ ระบบจะส่งแบบประเมินอาการให้ใน 30 วินาที",
              size: "xs", color: "#6b7280", wrap: true, margin: "md"
            }
          ]
        },
        footer: {
          type: "box", layout: "vertical", paddingAll: "12px",
          backgroundColor: "#f9fafb",
          contents: [
            { type: "text", text: `🕒 ${thaiTime()}`, size: "xs", color: "#9ca3af", align: "center" }
          ]
        }
      });

      // บันทึก Firebase หลังจาก reply แล้ว
      await axios.delete(`${DB}/pendingRegister/${userId}.json`);

      await axios.patch(`${DB}/symptoms/${childKey}.json`, {
        userId,
        name:         child.name     || "",
        hn:           child.hn       || "",
        cid:          child.cid      || "",
        phone:        child.phone    || "",
        birth:        child.birth    || "",
        vaccines:     child.vaccines || {},
        symptom:      "",
        status:       "รอติดตาม",
        level:        "🟢 ปกติ",
        priority:     3,
        assignedTo:   "",
        followStep:   1,
        normalCount:  0,
        registeredAt: Date.now(),
        nextFollowUp: getNextFollowTime(1),
        closedAt:     null,
        time:         Date.now(),
      });

      await axios.patch(`${DB}/children/${childKey}.json`, { lineUserId: userId });

      return res.sendStatus(200);
    }

    // ===== รับอาการ =====
    if (text.startsWith("อาการ:")) {
      const symptom  = text.replace("อาการ:", "").trim();
      const result   = await axios.get(`${DB}/children.json`);
      const children = result.data || {};
      let child = null, childKey = null;

      for (const key in children) {
        if (children[key].lineUserId === userId) { child = children[key]; childKey = key; break; }
      }
      if (!child) {
        await reply(e.replyToken, "❌ ไม่พบข้อมูลการลงทะเบียน\nกรุณาส่ง: ลงทะเบียน [HN]");
        return res.sendStatus(200);
      }

      const followRes = await axios.get(`${DB}/symptoms/${childKey}.json`);
      const follow    = followRes.data || {};
      let normalCount = follow.normalCount || 0;
      let followStep  = follow.followStep  || 1;

      if (symptom === "ปกติ") { normalCount++; } else { normalCount = 0; }

      const vaccines       = child.vaccines || {};
      const latestDate     = Object.values(vaccines).sort().pop();
      const latestVaccines = Object.entries(vaccines).filter(([k, v]) => v === latestDate);
      const vaccineText    = latestVaccines.length
        ? latestVaccines.map(([k, v]) => `${k} (${v})`).join("\n") : "ไม่มีข้อมูล";

      let level = "🟢 ปกติ", status = "ติดตามแล้ว", priority = 3;
      if (symptom.includes("ไข้ต่ำ") || symptom.includes("ปวด") || symptom.includes("บวม")) {
        level = "🟠 เฝ้าระวัง"; status = "เฝ้าติดตาม"; priority = 2;
      }
      if (symptom.includes("ไข้สูง") || symptom.includes("รุนแรง")) {
        level = "🔴 ต้องติดตามใกล้ชิด"; status = "ด่วน"; priority = 1;
      }

      if (normalCount >= 4) {
        await axios.patch(`${DB}/symptoms/${childKey}.json`, {
          symptom, status: "ปิดเคส", level: "🟢 ปกติ",
          priority: 3, normalCount: 4, closedAt: Date.now(), updatedAt: Date.now(),
        });
        await reply(e.replyToken, `✅ อาการปกติครบ 4 ครั้งติดกัน\n👶 ${child.name}\nปิดเคสเรียบร้อย 🎉`);
        return res.sendStatus(200);
      }

      let advice = "";
      if (level.includes("🟢"))      advice = "✅ อาการปกติ\nให้สังเกตอาการต่อ";
      else if (level.includes("🟠")) advice = "⚠️ ควรเฝ้าระวัง\nวัดไข้ทุก 4 ชั่วโมง";
      else                           advice = "🚨 พบอาการรุนแรง\nรอเจ้าหน้าที่รับเคส";

      const nextStep     = followStep + 1;
      const nextFollowUp = getNextFollowTime(nextStep);

      await axios.patch(`${DB}/symptoms/${childKey}.json`, {
        name: child.name || "", hn: child.hn || "", cid: child.cid || "",
        phone: child.phone || "", birth: child.birth || "", vaccines: child.vaccines || {},
        symptom, status, level, priority, assignedTo: "",
        normalCount, followStep: nextStep, nextFollowUp,
        time: Date.now(), updatedAt: Date.now(),
      });

      await reply(e.replyToken,
        `✅ รับข้อมูลเรียบร้อย (ครั้งที่ ${followStep}/4)\n\n` +
        `👶 ${child.name}\n💉 ${vaccineText}\n🩺 ${symptom}\n📌 ${level}\n\n${advice}\n\n🕒 ${thaiTime()}`
      );
      return res.sendStatus(200);
    }

    await reply(e.replyToken, "พิมพ์: ลงทะเบียน [HN] เพื่อเริ่มต้น");
    return res.sendStatus(200);

  } catch (err) {
    console.error("webhook error:", err.response?.data || err.message);
    return res.sendStatus(500);
  }
});

// =====================
// Auto Follow-Up
// =====================
async function autoFollowUp() {
  try {
    const res  = await axios.get(`${DB}/symptoms.json`);
    const data = res.data || {};
    const now  = Date.now();

    for (const key in data) {
      const s = data[key];
      if (!s.userId || s.closedAt || !s.nextFollowUp) continue;
      if (now < s.nextFollowUp) continue;

      const stepLabel = s.followStep <= 4 ? `ครั้งที่ ${s.followStep}/4` : "";
      await push(s.userId,
        `📋 ติดตามอาการหลังฉีดวัคซีน ${stepLabel}\n\n👶 ${s.name}\n\nกรุณาประเมินอาการล่าสุด`,
        SYMPTOM_QUICK_REPLY
      );
      await axios.patch(`${DB}/symptoms/${key}.json`, { nextFollowUp: null, lastAskedAt: now });
    }
  } catch (err) {
    console.error("autoFollowUp error:", err.message);
  }
}

// =====================
// Start
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
  setInterval(autoFollowUp, 1 * 60 * 1000);
});
