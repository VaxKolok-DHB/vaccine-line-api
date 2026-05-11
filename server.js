const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 ใส่ TOKEN (ห้ามมีช่องว่าง)
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

// 🔵 Firebase
const DB = "https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";

// ---------- helper ----------
async function reply(token, text) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    { replyToken: token, messages: [{ type: "text", text }] },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

// =======================
// 📌 WEBHOOK (ลงทะเบียน + รับอาการ)
// =======================
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const e = events[0];

  if (e.type === "message" && e.message.type === "text") {
    const text = e.message.text.trim();
    const userId = e.source.userId;

    // 🔹 ลงทะเบียน: ลงทะเบียน 20196
    if (text.startsWith("ลงทะเบียน")) {
      const hn = text.split(" ")[1];

      try {
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
      } catch (err) {
        console.log(err.response?.data || err.message);
      }
    }

    // 🔹 รับอาการ
    if (text.startsWith("อาการ:")) {
      const symptom = text.replace("อาการ: ", "");

      try {
        await axios.post(`${DB}/symptoms.json`, {
          symptom,
          userId,
          time: new Date().toISOString()
        });

        if (
          symptom.includes("รุนแรง") ||
          symptom.includes("หายใจ") ||
          symptom.includes("ชัก")
        ) {
          await reply(e.replyToken, "🚨 กรุณานำเด็กไปพบแพทย์ทันที หรือโทร 1669");
        } else {
          await reply(e.replyToken, "✅ รับข้อมูลเรียบร้อย ขอบคุณครับ");
        }
      } catch (err) {
        console.log(err.response?.data || err.message);
      }
    }
  }

  res.sendStatus(200);
});

// =======================
// 📌 ส่ง LINE หลังฉีด
// =======================
app.post("/send", async (req, res) => {
  const { name, userId, vaccines } = req.body;

  if (!userId) return res.send("no userId");

  const vaccineText =
    vaccines && vaccines.length > 0 ? vaccines.join(", ") : "ไม่ระบุ";

  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [
          {
            type: "text",
            text:
`📌 แจ้งการรับวัคซีน

👶 ${name}
💉 ได้รับวัคซีน: ${vaccineText}

📋 กรุณาเลือกอาการของเด็ก`,
            quickReply: {
              items: [
                { type: "action", action: { type: "message", label: "😊 ปกติ", text: "อาการ: ไม่มีอาการผิดปกติ" } },
                { type: "action", action: { type: "message", label: "🤒 ไข้ต่ำ", text: "อาการ: ไข้ต่ำ" } },
                { type: "action", action: { type: "message", label: "💉 ปวด/บวม", text: "อาการ: ปวดหรือบวมบริเวณที่ฉีด" } },
                { type: "action", action: { type: "message", label: "🔥 ไข้สูง", text: "อาการ: ไข้สูง" } },
                { type: "action", action: { type: "message", label: "😢 งอแง", text: "อาการ: ร้องกวนผิดปกติ" } },
                { type: "action", action: { type: "message", label: "🚨 อาการรุนแรง", text: "อาการ: อาการรุนแรง" } }
              ]
            }
          }
        ]
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    res.send("sent");
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.send("error");
  }
});

app.listen(3000, () => console.log("server running"));
