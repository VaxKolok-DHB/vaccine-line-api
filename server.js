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

const DB="https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";



// ========================
// helper
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

async function reply(token,text){

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

}

async function push(
userId,
text,
quickReply=null
){

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

messages:[
msg
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



app.post(
"/webhook",
async(req,res)=>{

try{

const e=
req.body.events?.[0];

if(!e){

return res.sendStatus(
200
);

}

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



// ลงทะเบียน

if(
text.startsWith(
"ลงทะเบียน"
)
){

const hn=
text.split(
" "
)[1];

const result=
await axios.get(
`${DB}/children.json`
);

const children=
result.data||{};

let foundKey=null;

let child=null;

for(
let key
in children
){

if(
children[key]
.hn===hn
){

foundKey=
key;

child=
children[key];

break;

}

}

if(
!foundKey
){

await reply(
e.replyToken,
"❌ ไม่พบข้อมูล"
);

return res.sendStatus(
200
);

}

await axios.patch(

`${DB}/children/${foundKey}.json`,

{

lineUserId:
userId

}

);


await reply(

e.replyToken,

`✅ ลงทะเบียนสำเร็จ

👶 ${child.name}

🆔 ${child.hn}

📞 ${child.phone||"-"}

🕒 ${thaiTime()}

`

);


// ส่งติดตามหลัง 30 วินาที

setTimeout(
async()=>{

await push(

userId,

`📋 แบบติดตามอาการ

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

},
30000
);

return res.sendStatus(
200
);

}



// ========================
// รับอาการ
// ========================

if(
text.startsWith(
"อาการ:"
)
){

const symptom=
text.replace(
"อาการ:",
""
).trim();

const children=
(
await axios.get(
`${DB}/children.json`
)
).data||{};

let child=null;

for(
let key in children
){

if(
children[key]
.lineUserId===userId
){

child=
children[key];

break;

}

}

if(child){

// ========================
// วัคซีน
// ========================

const vaccines=
child.vaccines||{};

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

"ไม่มีข้อมูล";


// ========================
// ระดับอาการ
// ========================

let level=
"🟢 ปกติ";

let status=
"ติดตามแล้ว";

let priority=
3;

if(

symptom.includes(
"ไข้ต่ำ"
)

||

symptom.includes(
"ปวด"
)

||

symptom.includes(
"บวม"
)

){

level=
"🟠 เฝ้าระวัง";

status=
"เฝ้าติดตาม";

priority=
2;

}


if(

symptom.includes(
"ไข้สูง"
)

||

symptom.includes(
"รุนแรง"
)

){

level=
"🔴 ต้องติดตามใกล้ชิด";

status=
"ด่วน";

priority=
1;

}


// ========================
// บันทึก Firebase
// ========================

await axios.post(

`${DB}/symptoms.json`,

{

name:
child.name||"-",

hn:
child.hn||"-",

phone:
child.phone||"-",

vaccines:
vaccineText,

symptom,

status,

level,

priority,

time:
Date.now()

}

);


// ========================
// ตอบ LINE
// ========================

await reply(

e.replyToken,

`✅ รับข้อมูลเรียบร้อย

👶 ${child.name}

🆔 HN:
${child.hn}

💉 วัคซีน

${vaccineText}

🩺 อาการ

${symptom}

📌 สถานะ

${level}

🕒 ${thaiTime()}

`

);

}

return res.sendStatus(
200
);

}
