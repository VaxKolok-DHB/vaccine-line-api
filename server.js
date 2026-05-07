const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 ใส่ LINE Channel access token (long-lived)
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gT KJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

// 🔵 URL Firebase Realtime Database ของน้อง
const DB = "https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";

// ---------- รับข้อความจาก LINE (ลงทะเบียน) ----------
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const e = events[0];

  if (e.type === "message" && e.message.type === "text") {
    const text = e.message.text.trim();
    const userId = e.source.userId;

    // รูปแบบ: ลงทะเบียน 1234
    if (text.startsWith("ลงทะเบียน")) {
      const hn = text.split(" ")[1];

      try {
        // เก็บ userId ผูกกับ HN
        await axios.patch(`${DB}/children/${hn}.json`, {
          lineUserId: userId
        });

        // ตอบกลับ
        await axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: e.replyToken,
            messages: [{ type: "text", text: "✅ ลงทะเบียนสำเร็จ" }]
          },
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
      } catch (err) {
        console.log(err.response?.data || err.message);
      }
    }
  }

  res.sendStatus(200);
});

// ---------- endpoint ส่ง LINE ----------
app.post("/send", async (req, res) => {
  const { name, userId } = req.body;

  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [
          {
            type: "text",
            text: `👶 ${name} ฉีดวัคซีนแล้ว\n⏰ มีอาการอย่างไรบ้าง?`
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
