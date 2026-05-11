const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json());

// 🔴 TOKEN (ห้ามมีช่องว่าง)
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

// 🔵 Firebase
const DB = "https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";

// =======================
// helper
// =======================
async function reply(token, text) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    { replyToken: token, messages: [{ type: "text", text }] },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

async function pushMessage(to, message) {
  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    { to, messages: [message] },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

// =======================
// follow-up sender
// =======================
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
// webhook
// =======================
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const e = events[0];

  if (e.type === "message" && e.message.type === "text") {
    const text = e.message.text.trim();
    const userId = e.source.userId;

    // 🔹 ลงทะเบียน
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
        return;
      }

      await axios.patch(`${DB}/children/${foundKey}.json`, {
        lineUserId: userId
      });

      await reply(e.replyToken, "✅ ลงทะเบียนสำเร็จ");
    }

    // 🔹 รับอาการ
    if (text.startsWith("อาการ:")) {
      const symptom = text.replace("อาการ: ", "");

      let level = "🟢 ปกติ";
      if (symptom.includes("รุนแรง") || symptom.includes("ชัก")) level = "🔴 ฉุกเฉิน";
      else if (symptom.includes("ไข้สูง")) level = "🟠 เฝ้าระวัง";

      // 🔥 หาเด็กจาก userId
      const resData = await axios.get(`${DB}/children.json`);
      const children = resData.data || {};

      let foundChild = null;
      for (let key in children) {
        if (children[key].lineUserId === userId) {
          foundChild = children[key];
          break;
        }
      }

      // 🔥 บันทึก
      await axios.post(`${DB}/symptoms.json`, {
        symptom,
        level,
        userId,
        name: foundChild?.name || "-",
        hn: foundChild?.hn || "-",
        time: new Date().toISOString(),
        status: "รอดำเนินการ"
      });

      // 🔥 ตอบ
      if (level === "🔴 ฉุกเฉิน") {
        await reply(e.replyToken, "🚨 กรุณาพาเด็กไปพบแพทย์ทันที หรือโทร 1669");
      } else {
        await reply(e.replyToken, "✅ รับข้อมูลเรียบร้อย");
      }
    }
  }

  res.sendStatus(200);
});

// =======================
// ส่งหลังฉีด
// =======================
app.post("/send", async (req, res) => {
  const { name, userId, vaccines, date } = req.body;

  if (!userId) return res.send("no userId");

  const vaccineText = vaccines?.join(", ") || "ไม่ระบุ";

  let showDate = "ไม่ระบุ";
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) showDate = d.toLocaleDateString("th-TH");
  }

  try {

    // 🔥 แจ้งทันที
    await pushMessage(userId, {
      type: "text",
      text:
`📌 ได้รับวัคซีนแล้ว

👶 ${name}
📅 ${showDate}
💉 ${vaccineText}`
    });

    // 🔥 schedule (อาจหลุดใน Render free)
    setTimeout(()=> sendFollowUp(userId, name, "10 นาที"), 10 * 60 * 1000);
    setTimeout(()=> sendFollowUp(userId, name, "6 ชั่วโมง"), 6 * 60 * 60 * 1000);
    setTimeout(()=> sendFollowUp(userId, name, "24 ชั่วโมง"), 24 * 60 * 60 * 1000);
    setTimeout(()=> sendFollowUp(userId, name, "3 วัน"), 3 * 24 * 60 * 60 * 1000);

    res.send("sent");

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.send("error");
  }
});

app.listen(3000, () => console.log("server running"));
