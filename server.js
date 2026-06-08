process.on(
"uncaughtException",
(err)=>{

console.error(
"UNCAUGHT:",
err
);

});

process.on(
"unhandledRejection",
(err)=>{

console.error(
"REJECTION:",
err
);

});


require("dotenv").config();

const express=require("express");
const axios=require("axios");
const cors=require("cors");

const app=express();

app.use(cors({
origin:"*",
methods:["GET","POST","OPTIONS"],
allowedHeaders:["Content-Type"]
}));

app.use(express.json());
const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";

if(!TOKEN){

console.error(
"❌ LINE_TOKEN missing"
);

process.exit(1);

}
const DB="https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com";

// =====================
// helper
// =====================
// followStep
// normalCount
// nextFollowUp
// closedAt
// getNextFollowTime()
// autoFollowUp()
// setInterval(autoFollowUp,...)

function thaiTime(){

return new Date()
.toLocaleString(
"th-TH",
{
timeZone:"Asia/Bangkok"
}
);

}


async function reply(
replyToken,
text
){

try{

await axios.post(

"https://api.line.me/v2/bot/message/reply",

{
replyToken,

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

}catch(err){

console.log(
err.response?.data||
err.message
);

}

}


async function push(
userId,
text,
quickReply=null
){

try{

let msg={

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

}catch(err){

console.log(
err.response?.data||
err.message
);

}

}


// =====================
// webhook
// =====================

app.post(
"/webhook",
async(req,res)=>{

try{

const e=
req.body.events?.[0];

if(
!e
){
return res.sendStatus(200);
}

if(
e.type!=="message"
||
e.message.type!=="text"
){
return res.sendStatus(200);
}

const text=
e.message.text.trim();

const userId=
e.source.userId;


// =====================
// ลงทะเบียน
// =====================

if(
text.startsWith(
"ลงทะเบียน"
)
){

const hn=text
.replace("ลงทะเบียน","")
.trim();

const result=
await axios.get(
`${DB}/children.json`
);

const children=
result.data||{};

let child=null;
let childKey=null;

for(
let key in children
){

if(children[key].hn===hn){

child=children[key];
childKey=key;

break;

}

}

if(
!child
){

await reply(
e.replyToken,
"❌ ไม่พบข้อมูล"
);

return res.sendStatus(
200
);

}


// save line user
await axios.patch(
`${DB}/symptoms/${childKey}.json`,
{
followStep:1,
normalCount:0,
nextFollowUp:Date.now() + 60000,

name: child.name || "",
hn: child.hn || "",
cid: child.cid || "",
phone: child.phone || "",
birth: child.birth || "",

vaccines: child.vaccines || {},

symptom:symptom,
status:status,
level:level,
priority:priority,

assignedTo:"",
time:Date.now()

}
);



// follow up

setTimeout(

async()=>{

try{

await push(

userId,

`📋 ติดตามอาการ

👶 ${child.name}

มีอาการอย่างไร?`,

[

{
type:"action",
action:{
type:"message",
label:"😊 ปกติ",
text:"อาการ: ปกติ"
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
text:"อาการ: รุนแรง"
}
}

]

);

}catch(err){

console.log(
"followup:",
err.message
);

}

},

30000

);

return res.sendStatus(
200
);

}



// =====================
// รับอาการ
// =====================

if(text.startsWith("อาการ:"))

{

const symptom = text.replace("อาการ:","").trim();
const symptomRef = await axios.get(`${DB}/symptoms/${childKey}.json`);

await axios.patch(
`${DB}/symptoms/${childKey}.json`,
{
 name: child.name || "",
 hn: child.hn || "",

 symptom:symptom,
 status:status,
 level:level,
 priority:priority,

 followStep:step,
 normalCount:normalCount,
 nextFollowUp:nextFollowUp,

 assignedTo:"",
 time:Date.now()
}
);





const follow = symptomRef.data || {};

const result = await axios.get(`${DB}/children.json`);
const children = result.data||{};

let child=null;
let childKey=null;

for(let key in children){

   const c=
   children[key];

   if(
      c.lineUserId===userId
   ){

      child=c;

      childKey=key;

      break;

   }

}


if(!child){

await reply(

e.replyToken,

"❌ ไม่พบข้อมูลการลงทะเบียน"

);

return res.sendStatus(
200
);

}


// ===== วัคซีนล่าสุด =====

const vaccines=
child.vaccines||{};

const latestDate=

Object.values(
vaccines
)

.sort()

.pop();

const latestVaccines=

Object.entries(
vaccines
)

.filter(
([k,v])=>
v===latestDate
);

const vaccineText=

latestVaccines.length

?

latestVaccines
.map(
([k,v])=>

`${k} (${v})`

)

.join("\n")

:

"ไม่มีข้อมูล";




// ===== ระดับอาการ =====

let level = "🟢 ปกติ";

let status = "ติดตามแล้ว";

let priority = 3;


if( symptom.includes("ไข้ต่ำ") ||symptom.includes("ปวด") ||symptom.includes("บวม"))
    
    {level = " 🟠 เฝ้าระวัง"; 
        
        status = "เฝ้าติดตาม";
        priority = 2;

}

if(symptom.includes("ไข้สูง") || symptom.includes("รุนแรง"))
    
    {level = " 🔴 ต้องติดตามใกล้ชิด"; status = "ด่วน";
    
        priority = 1;

}



// ===== บันทึก Firebase =====
await axios.patch(
`${DB}/symptoms/${childKey}.json`,
{

name: child.name || "",
hn: child.hn || "",
cid: child.cid || "",
phone: child.phone || "",
birth: child.birth || "",

vaccines: child.vaccines || {},

symptom:symptom,

status:status,

level:level,

priority:priority,

assignedTo:"",

time:Date.now(),
updatedAt: Date.now()

}
);

// ===== คำแนะนำ =====

let advice="";


if(level.includes( "🟢")){ advice = "✅ อาการปกติ\nให้สังเกตอาการต่อ";}

else 
    if(level.includes("🟠"))
        
    { advice = "⚠️ ควรเฝ้าระวัง\nวัดไข้ทุก 4 ชั่วโมง";}

else
    {advice= " 🚨 พบอาการรุนแรง\nรอเจ้าหน้าที่รับเคส";}


// ===== ตอบ LINE =====

await reply(

e.replyToken,

`✅ รับข้อมูลเรียบร้อย

👶 ${child.name}

💉 ${vaccineText}

🩺 ${symptom}

📌 ${level}

${advice}

🕒 ${thaiTime()}`);

return res.sendStatus(200);

}}

catch(err){

console.log(
err.response?.data||err.message);

return res.sendStatus(500);

}

});


// =====================
// start
// =====================

const PORT = process.env.PORT||3000;

app.listen( PORT,()=>{
setInterval(
 autoFollowUp,
 5 * 60 * 1000
);
console.log(`🚀 Running on ${PORT}`);

});


