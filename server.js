const express=require("express");
const axios=require("axios");
const cors=require("cors");

const app=express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(cors());
app.use(express.json());

const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";


const DB=
"https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";


// =======================
// 🔹 helper reply
// =======================
async function reply(token, text) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken: token,
      messages: [{ type: "text", text }]
    },
    {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }
  );
}

// ========================
// helper เวลา
// ========================

function thaiTime(){

 return new Date()
 .toLocaleString(
 "th-TH",
 {
 timeZone:"Asia/Bangkok"
 }
 );

}


// ========================
// Reply
// ========================

async function reply(
token,
text
){

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
Authorization:
`Bearer ${TOKEN}`
}

}

);

}
catch(err){

console.log(
"Reply:",
err.response?.data ||
err.message
);

}

}



// ========================
// Push
// ========================

async function push(
userId,
text,
quickReply=null
){

try{

const msg={

type:"text",

text

};

if(
quickReply
){

msg.quickReply={
items:quickReply
};

}

await axios.post(

"https://api.line.me/v2/bot/message/push",

{

to:userId,

messages:[msg]

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
"Push:",
err.response?.data ||
err.message
);

}

}



// ========================
// Firebase helper
// ========================

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

for(
let key
in children
){

if(
children[key]
.hn===hn
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


function findByUserId(
children,
userId
){

for(
let key
in children
){

if(
children[key]
.lineUserId===
userId
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



// ========================
// webhook
// ========================

app.post(
"/webhook",
async(
req,
res
)=>{

try{

const events=
req.body.events || [];

if(
!events.length
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



// ========================
// ลงทะเบียน
// ========================

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
"❌ ไม่พบข้อมูล"
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

lineUserId:
userId,

registered:
true,

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

`${k}
(${v})`

)

.join("\n")

:

"ยังไม่มีข้อมูล";


await reply(

e.replyToken,

`✅ ลงทะเบียนสำเร็จ

👶 ${c.name||"-"}

🆔 ${c.hn||"-"}

💉
${vaccineText}

📞 ${c.phone||"-"}

🕒 ${thaiTime()}`

);

return res.sendStatus(
200
);

}



// ========================
// รับอาการ
// ========================
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



// ========================
// ส่งวัคซีน
// ========================

app.post(
"/send",
async(req,res)=>{

try{

const {

name,
userId,
vaccines=[],
phone="-",
date

}=req.body;


if(!userId){

return res
.status(400)
.send("no userId");

}


const vaccineText=

vaccines.length

?

vaccines.join(", ")

:

"ไม่ระบุ";


let showDate="-";

if(date){

const d=
new Date(date);

if(!isNaN(d)){

showDate=
d.toLocaleDateString(
"th-TH",
{
timeZone:
"Asia/Bangkok"
}
);

}

}


console.log(
"🔥 send vaccine:",
name
);


// แจ้งทันที

await push(

userId,

`📌 แจ้งการรับวัคซีน

👶 ${name}

📅 วันที่ฉีด:
${showDate}

💉 วัคซีน:
${vaccineText}

📞 เบอร์:
${phone}

🕒 ${thaiTime()}`

);

console.log(
"✅ vaccine sent"
);


// ถามอาการหลัง 3 วิ

setTimeout(

async()=>{

try{

console.log(
"🔥 followup sending"
);

await push(

userId,

`📋 แบบติดตามอาการ

👶 ${name}

⏰ ${thaiTime()}

ผ่านไปแล้ว
3 วินาที

มีอาการอย่างไรบ้าง?`,

[

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

);

console.log(
"✅ followup sent"
);

}catch(err){

console.log(
"Followup Error:",
err.response?.data ||
err.message
);

}

},

3000

);

return res.send(
"sent"
);

}
catch(err){

console.log(
err.response?.data ||
err.message
);

return res
.status(500)
.send("error");

}

});


app.listen(
3000,
()=>{

console.log(
"🚀 Server running on port 3000"
);

});
