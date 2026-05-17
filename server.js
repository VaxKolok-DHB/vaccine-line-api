const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type"]
}));

app.options("*",cors());
app.use(express.json());

// 🔴 LINE TOKEN
const TOKEN="DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

// 🔵 Firebase
const DB="https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";


// =======================
// 🔹 helper children
// =======================

async function getChildren(){

  const res = await axios.get(
    `${DB}/children.json`
  );

  return res.data || {};

}

function findByHN(children,hn){

  for(let key in children){

    if(children[key].hn===hn){

      return {
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

      return {
        key,
        child:children[key]
      };

    }
  }

  return null;
}


// =======================
// 📌 WEBHOOK
// =======================

app.post("/webhook",async(req,res)=>{

const events=req.body.events;

if(!events || events.length===0){
   return res.sendStatus(200);
}

const e=events[0];

if(
e.type==="message" &&
e.message.type==="text"
){

const text=e.message.text.trim();
const userId=e.source.userId;


// =======================
// 🟢 ลงทะเบียน
// =======================

if(text.startsWith("ลงทะเบียน")){

const hn=text.split(" ")[1];

try{

const children=
await getChildren();

const found=
findByHN(
children,
hn
);

if(!found){

await reply(
e.replyToken,
"❌ ไม่พบข้อมูลเด็ก"
);

return res.sendStatus(200);

}

const child=
found.child;

await axios.patch(

`${DB}/children/${found.key}.json`,

{

lineUserId:userId,

registered:true,

registeredAt:
new Date().toISOString()

}

);


// 🔥 ข้อมูลวัคซีน

const vaccines=
child.vaccines || {};

const vaccineText=

Object.keys(vaccines)
.length

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

👶 ${child.name||"-"}

🆔 HN: ${hn}

📌 ข้อมูลวัคซีนล่าสุด

💉 ${vaccineText}

📞 ${child.phone||"-"}

🕒 ${
new Date()
.toLocaleString(
"th-TH"
)
}

ระบบพร้อมติดตามอาการหลังฉีดวัคซีน`

);

return res.sendStatus(200);

}
catch(err){

console.log(
err.response?.data ||
err.message
);

await reply(
e.replyToken,
"❌ ระบบขัดข้อง"
);

return res.sendStatus(200);

}

}

// =======================
// 🟠 รับอาการ
// =======================

if(text.startsWith("อาการ:")){

const symptom=
text.replace(
"อาการ:",
""
).trim();

let level="🟢 ปกติ";

if(
symptom.includes("รุนแรง")
||
symptom.includes("ชัก")
){

level="🔴 ฉุกเฉิน";

}
else if(
symptom.includes("ไข้สูง")
){

level="🟠 เฝ้าระวัง";

}

try{

const resData=
await axios.get(
`${DB}/children.json`
);

const children=
resData.data || {};

let foundChild=null;

for(let key in children){

if(
children[key]
.lineUserId===userId
){

foundChild=
children[key];

break;

}

}

if(!foundChild){

await reply(
e.replyToken,
"❌ ไม่พบข้อมูลผู้ใช้"
);

return res.sendStatus(200);

}


await axios.put(

`${DB}/symptoms/${foundChild.hn}.json`,

{

symptom,
level,
userId,

name:
foundChild.name || "-",

hn:
foundChild.hn || "-",

phone:
foundChild.phone || "",

time:
new Date().toISOString(),

status:
"รอดำเนินการ"

}

);


if(level==="🔴 ฉุกเฉิน"){

await reply(

e.replyToken,

"🚨 กรุณาพาเด็กไปพบแพทย์ทันที หรือโทร 1669"

);

}else{

await reply(
e.replyToken,
"✅ รับข้อมูลเรียบร้อย"
);

}

}catch(err){

console.log(err);

}

}

}

res.sendStatus(200);

});



// =======================
// 📌 ส่งข้อความหลังฉีด
// =======================

app.post("/send",async(req,res)=>{

const {

name,
userId,
vaccines,
date,
phone

}=req.body;


if(!userId){

return res.send(
"no userId"
);

}


const vaccineText=

vaccines &&
vaccines.length>0

? vaccines.join(", ")

: "ไม่ระบุ";


let showDate=
"ไม่ระบุ";


if(date){

const d=
new Date(date);

if(!isNaN(d)){

showDate=
d.toLocaleDateString(
"th-TH"
);

}

}


try{


await axios.post(

"https://api.line.me/v2/bot/message/push",

{

to:userId,

messages:[

{

type:"text",

text:

`📌 แจ้งการรับวัคซีน

👶 ${name}

📅 วันที่ฉีด:
${showDate}

💉 ได้รับวัคซีน:
${vaccineText}

📞 ${phone||"-"}

🕒 ${
date
?
new Date(date)
.toLocaleString("th-TH")
:
"-"
}

กรุณาสังเกตอาการของเด็กอย่างใกล้ชิด`

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


// 🔥 ติดตาม 10 นาที

setTimeout(async()=>{

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

Authorization:
`Bearer ${TOKEN}`

}

}

);

},10*60*1000);


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
)
);
