const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔥 ใส่ LINE TOKEN ของน้อง
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gT KJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

app.post("/send", async (req, res) => {

  const { name, userId } = req.body;

  try{
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [
          {
            type: "text",
            text: `👶 ${name} ฉีดวัคซีนแล้ว\n\n⏰ น้องมีอาการอย่างไรบ้าง?`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      }
    );

    res.send("sent");

  }catch(err){
    console.log(err.response?.data || err.message);
    res.send("error");
  }

});

app.listen(3000, () => console.log("server running"));