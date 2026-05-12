const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json());

// 🔴 ใส่ TOKEN จริง (ห้ามมีช่องว่าง/ขึ้นบรรทัด)
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

// 🔵 Firebase Realtime DB URL
const DB = "https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";

// =======================
// helpers
// =======================
async function reply(token, text) {
  return axios.post(
    "https://api.line.me/v2/bot/message/reply",
    { replyToken: token, messages: [{ type: "text", text }] },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

async function pushMessage(to, message) {
  return axios.post(
    "https://api.line.me/v2/bot/message/push",
    { to, messages: [message] },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

// สร้างรายการติดตาม (เก็บเวลาใน DB)
function addFollowUp(userId, name, delayMs, label) {
  const sendAt = new Date(Date.now() + delayMs).toISOString();
  return axios.post(`${DB}/followups.json`, {
    userId,
    name,
    label,
    sendAt,
    sent: false
  });
}

// ส่งคำถามติดตาม
async function sendFollowUp(userId, name, label) {
  await pushMessage(userId, {
    type: "text",
    text:
`📋 ติดตามอาการ (${label})

👶 ${name}

ขณะนี้มีอาการอย่างไรบ้าง`,
    quickReply: {
      items: [
        { type: "action", action: { type: "message", label: "😊 ปกติ", text: "อาการ: ไม่มีอาการผิดปกติ" } },
        { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ", text: "อาการ: ไข้ต่ำ" } },
        { type: "action", action: { type: "message", label: "🔥 ไข้สูง", text: "อาการ: ไข้สูง" } },
        { type: "action", action: { type: "message", label: "🚨 รุนแรง", text: "อาการ: อาการรุนแรง" } }
      ]
    }
  });
}

// =======================
// webhook (ลงทะเบียน + รับอาการ)
// =======================
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const e = events[0];

  try {
    if (e.type === "message" && e.message.type === "text") {
      const text = e.message.text.trim();
      const userId = e.source.userId;

      // 🔹 ลงทะเบียน: "ลงทะเบียน 20196"
      if (text.startsWith("ลงทะเบียน")) {
        const hn = text.split(" ")[1];

        const resData = await axios.get(`${DB}/children.json`);
        const children = resData.data || {};

        let foundKey = null;
        for (let key in children) {
          if (children[key].hn == hn) {
            foundKey = key;
            break;
          }
        }

        if (!foundKey) {
          await reply(e.replyToken, "❌ ไม่พบข้อมูลเด็ก");
          return res.sendStatus(200);
        }

        await axios.patch(`${DB}/children/${foundKey}.json`, {
          lineUserId: userId
        });

        await reply(e.replyToken, "✅ ลงทะเบียนสำเร็จ");
      }

      // 🔹 รับอาการ: "อาการ: ..."
      if (text.startsWith("อาการ:")) {
        const symptom = text.replace("อาการ: ", "");

        let level = "🟢 ปกติ";
        if (symptom.includes("รุนแรง") || symptom.includes("ชัก")) level = "🔴 ฉุกเฉิน";
        else if (symptom.includes("ไข้สูง")) level = "🟠 เฝ้าระวัง";

        // หาเด็กจาก userId
        const resData = await axios.get(`${DB}/children.json`);
        const children = resData.data || {};

        let foundChild = null;
        for (let key in children) {
          if (children[key].lineUserId === userId) {
            foundChild = children[key];
            break;
          }
        }

        // บันทึกอาการ (มี name + hn)
        await axios.post(`${DB}/symptoms.json`, {
          symptom,
          level,
          userId,
          name: foundChild?.name || "-",
          hn: foundChild?.hn || "-",
          time: new Date().toISOString(),
          status: "รอดำเนินการ"
        });

        if (level === "🔴 ฉุกเฉิน") {
          await reply(e.replyToken, "🚨 กรุณาพาเด็กไปพบแพทย์ทันที หรือโทร 1669");
        } else {
          await reply(e.replyToken, "✅ รับข้อมูลเรียบร้อย ขอบคุณครับ");
        }
      }
    }

  } catch (err) {
    console.log("webhook error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// =======================
// ส่งหลังฉีด (เรียกจาก dashboard)
// =======================
app.post("/send", async (req, res) => {
  const { name, userId, vaccines, date } = req.body;

  if (!userId) return res.status(400).send("no userId");

  const vaccineText = Array.isArray(vaccines) && vaccines.length
    ? vaccines.join(", ")
    : "ไม่ระบุ";

  let showDate = "ไม่ระบุ";
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) showDate = d.toLocaleDateString("th-TH");
  }

  try {
    // แจ้งทันที
    await pushMessage(userId, {
      type: "text",
      text:
`📌 ได้รับวัคซีนแล้ว

👶 ${name}
📅 ${showDate}
💉 ${vaccineText}

กรุณาสังเกตอาการของเด็ก`
    });

    // 🔥 สร้างตารางติดตาม (ไม่ใช้ setTimeout)
    await addFollowUp(userId, name, 10 * 60 * 1000, "10 นาที");
    await addFollowUp(userId, name, 6 * 60 * 60 * 1000, "6 ชั่วโมง");
    await addFollowUp(userId, name, 24 * 60 * 60 * 1000, "24 ชั่วโมง");

    res.send("sent");

  } catch (err) {
    console.log("send error:", err.response?.data || err.message);
    res.status(500).send("error");
  }
});

// =======================
// cron checker (ทุก 1 นาที)
// =======================
setInterval(async () => {
  try {
    const res = await axios.get(`${DB}/followups.json`);
    const data = res.data || {};
    const now = new Date();

    for (let key in data) {
      const f = data[key];

      if (!f.sent && new Date(f.sendAt) <= now) {
        await sendFollowUp(f.userId, f.name, f.label);

        // mark ส่งแล้ว
        await axios.patch(`${DB}/followups/${key}.json`, {
          sent: true
        });
      }
    }
  } catch (err) {
    console.log("cron error:", err.response?.data || err.message);
  }
}, 60000);

app.listen(3000, () => console.log("server running"));
