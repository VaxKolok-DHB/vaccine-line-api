const express=require("express");
const axios=require("axios");
const cors=require("cors");

const app=express();

app.use(cors());
app.use(express.json());

const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";


const DB=
"https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";


// =========================
// Reply
// =========================

async function reply(token,text){

 try{

 await axios.post(
 "https://api.line.me/v2/bot/message/reply",

 {

 replyToken:token,

 messages:[
 {
 type:"text",
 text
 }
 ]

 },

 {

 headers:{
 Authorization:`Bearer ${TOKEN}`
 }

 }

 );

 }catch(err){

 console.log(
 err.response?.data ||
 err.message
 );

 }

}



// =========================
// Push
// =========================

async function push(
userId,
text
){

try{

await axios.post(

"https://api.line.me/v2/bot/message/push",

{

to:userId,

messages:[
{
type:"text",
text
}
]

},

{

headers:{
Authorization:
`Bearer ${TOKEN}`
}

}

);

}
catch(err){

console.log(
err.response?.data ||
err.message
);

}

}



// =========================
// Firebase helper
// =========================

async function getChildren(){

const res=
await axios.get(
`${DB}/children.json`
);

return res.data || {};

}

function findByHN(
children,
hn
){

for(let key in children){

if(children[key].hn===hn){

return{

key,
child:children[key]

};

}

}

return null;

}


function findByUserId(
children,
userId
){

for(let key in children){

if(
children[key]
.lineUserId===userId
){

return{

key,
child:
children[key]

};

}

}

return null;

}



// =========================
// WEBHOOK
// =========================

app.post(
"/webhook",
async(req,res)=>{

try{

const events=
req.body.events || [];

if(
events.length===0
){

return res.sendStatus(
200
);

}

const e=
events[0];

if(
e.type!=="message"
||
e.message.type!=="text"
){

return res.sendStatus(
200
);

}

const text=
e.message.text.trim();

const userId=
e.source.userId;


// =========================
// ลงทะเบียน
// =========================

if(
text.startsWith(
"ลงทะเบียน"
)
){

const hn=
text.split(" ")[1];

const children=
await getChildren();

const found=
findByHN(
children,
hn
);

if(
!found
){

await reply(
e.replyToken,
"❌ ไม่พบข้อมูลเด็ก"
);

return res.sendStatus(
200
);

}

const c=
found.child;


await axios.patch(

`${DB}/children/${found.key}.json`,

{

lineUserId:userId,

registered:true,

registeredAt:
new Date()
.toISOString()

}

);


const vaccines=
c.vaccines || {};

const vaccineText=

Object.keys(
vaccines
).length

?

Object.entries(
vaccines
)

.map(
([k,v])=>

`${k} (${v})`

)

.join("\n")

:

"ยังไม่มีข้อมูล";


await reply(

e.replyToken,

`✅ ลงทะเบียนสำเร็จ

👶 ${c.name}

🆔 HN:${c.hn}

📌 ข้อมูลวัคซีนล่าสุด

💉${vaccineText}

📞${c.phone||"-"}

🕒 ${new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}
)
}`

);


// 🔥 ถามหลัง 30 วินาที

setTimeout(

async()=>{

const followTime=
new Date()
.toLocaleString(
"th-TH",
{
timeZone:
"Asia/Bangkok"
}
);

await push(

userId,

`📋 แบบติดตามอาการ

👶 ${c.name}

⏰ เวลา:
${followTime}

📌 ผ่านไปแล้ว:
30 วินาที

กรุณาตอบ:

😊 อาการ: ไม่มีอาการผิดปกติ
🤒 อาการ: ไข้ต่ำ
💉 อาการ: ปวดหรือบวม
🔥 อาการ: ไข้สูง
🚨 อาการ: อาการรุนแรง`

);

},

30000

);

return res.sendStatus(
200
);

}



// =========================
// รับอาการ
// =========================

if (text.startsWith("อาการ:")) {

      const symptom = text.replace("อาการ: ", "");

      let level = "🟢 ปกติ";

      if (symptom.includes("รุนแรง") || symptom.includes("ชัก")) {
        level = "🔴 ฉุกเฉิน";
      } else if (symptom.includes("ไข้สูง")) {
        level = "🟠 เฝ้าระวัง";
      }

      try {

        const resData = await axios.get(`${DB}/children.json`);
        const children = resData.data || {};

        let foundChild = null;

        for (let key in children) {
          if (children[key].lineUserId === userId) {
            foundChild = children[key];
            break;
          }
        }

        await axios.put(`${DB}/symptoms/${foundChild.hn}.json`, {
          symptom,
          level,
          userId,
          name: foundChild?.name || "-",
          hn: foundChild?.hn || "-",
          phone: foundChild?.phone || "",
          
          time: new Date().toISOString(),
          status: "รอดำเนินการ"
        });

        if (level === "🔴 ฉุกเฉิน") {
          await reply(e.replyToken, "🚨 กรุณาพาเด็กไปพบแพทย์ทันที หรือโทร 1669");
        } else {
          await reply(e.replyToken, "✅ รับข้อมูลเรียบร้อย ขอบคุณครับ");
        }

      } catch (err) {
        console.log(err);
      }
    }

  }

  res.sendStatus(200);
});



// =========================
// ส่งวัคซีน
// =========================

app.post("/send", async (req, res) => {

  const { name, userId, vaccines, date, phone } = req.body;

  if (!userId) return res.send("no userId");

  const vaccineText =
    vaccines && vaccines.length > 0
      ? vaccines.join(", ")
      : "ไม่ระบุ";

  let showDate = "ไม่ระบุ";

  if (date) {
    const d = new Date(date);

    if (!isNaN(d)) {
      showDate = d.toLocaleDateString(
        "th-TH",
        {
          timeZone:"Asia/Bangkok"
        }
      );
    }
  }

  try {

    // 🔥 แจ้งทันที
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

📅 วันที่ฉีด:
${showDate}

💉 ได้รับวัคซีน:
${vaccineText}

📞 ${phone || "-"}

🕒 ${
new Date().toLocaleString(
"th-TH",
{
timeZone:"Asia/Bangkok"
}
)
}

กรุณาสังเกตอาการของเด็กอย่างใกล้ชิด`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      }
    );



    // 🔥 ถามอาการหลัง 3 วินาที

    setTimeout(async () => {

      const followTime =
      new Date()
      .toLocaleString(
      "th-TH",
      {
      timeZone:"Asia/Bangkok"
      }
      );

      await axios.post(

        "https://api.line.me/v2/bot/message/push",

        {

          to:userId,

          messages:[
            {

              type:"text",

              text:
`📋 แบบติดตามอาการ

👶 ${name}

⏰ เวลา:
${followTime}

📌 ผ่านไปแล้ว:
3 วินาที

มีอาการอย่างไรบ้าง`,

              quickReply:{

                items:[

                  {
                    type:"action",
                    action:{
                      type:"message",
                      label:"😊 ปกติ",
                      text:"อาการ: ไม่มีอาการผิดปกติ"
                    }
                  },

                  {
                    type:"action",
                    action:{
                      type:"message",
                      label:"🤒 ไข้ต่ำ",
                      text:"อาการ: ไข้ต่ำ"
                    }
                  },

                  {
                    type:"action",
                    action:{
                      type:"message",
                      label:"💉 ปวด/บวม",
                      text:"อาการ: ปวดหรือบวม"
                    }
                  },

                  {
                    type:"action",
                    action:{
                      type:"message",
                      label:"🔥 ไข้สูง",
                      text:"อาการ: ไข้สูง"
                    }
                  },

                  {
                    type:"action",
                    action:{
                      type:"message",
                      label:"🚨 รุนแรง",
                      text:"อาการ: อาการรุนแรง"
                    }
                  }

                ]

              }

            }

          ]

        },

        {
          headers:{
            Authorization:`Bearer ${TOKEN}`
          }
        }

      );

    },3*1000);


    res.send("sent");

  }
  catch(err){

    console.log(
      err.response?.data ||
      err.message
    );

    res.send("error");
  }

});

app.listen(
3000,
()=>console.log(
"🚀 Server running on port 3000"
));



}
);
