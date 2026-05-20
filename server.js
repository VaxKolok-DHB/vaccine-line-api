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

// =====================
// helper
// =====================

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

err.response?.data
||
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

err.response?.data
||
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


// =====================
// ลงทะเบียน
// =====================

if(
text.startsWith(
"ลงทะเบียน"
)
){

const hn=
text.split(" ")[1];

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

if(
children[key]
.hn===hn
){

child=
children[key];

childKey=
key;

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

`${DB}/children/${childKey}.json`,

{

lineUserId:userId,

registered:true,

registeredAt:
Date.now()

}

);

if(child){

const vaccines=
child.vaccines||{};


// 🔥 หาวันล่าสุด

const latestDate=

Object.values(
vaccines
)

.sort()

.pop();


// 🔥 เอาเฉพาะวัคซีนล่าสุด

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


await reply(

e.replyToken,

`✅ ลงทะเบียนสำเร็จ

👶 ${child.name}

🆔 ${child.hn}

💉 วัคซีน:

${vaccineText}

📞 ${child.phone||"-"}

🕒 ${thaiTime()}

`

);


// follow up

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



// =====================
// รับอาการ
// =====================

if(
text.startsWith(
"อาการ:"
)
){

const symptom=

text.replace(
"อาการ:",
""
)

.trim();


const result=
await axios.get(
`${DB}/children.json`
);

const children=
result.data||{};

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



let level=
"🟢 ปกติ";

let status=
"ติดตามแล้ว";

let priority=
3;


// เฝ้าระวัง

if(

symptom.includes("ไข้ต่ำ")

||

symptom.includes("ปวด")

||

symptom.includes("บวม")

){

level=
"🟠 เฝ้าระวัง";

status=
"เฝ้าติดตาม";

priority=
2;

}


// ด่วน

if(

symptom.includes("ไข้สูง")

||

symptom.includes("รุนแรง")

){

level=
"🔴 ต้องติดตามใกล้ชิด";

status=
"ด่วน";

priority=
1;

}



await axios.post(

`${DB}/symptoms.json`,

{

name:
child.name,

hn:
child.hn,

phone:
child.phone,

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



await reply(

e.replyToken,

`✅ รับข้อมูลเรียบร้อย

👶 ${child.name}

💉 วัคซีน:

${vaccineText}

🩺 อาการ:

${symptom}

📌 ${level}

🕒 ${thaiTime()}

`

);

}

return res.sendStatus(
200
);

}

return res.sendStatus(
200
);

}
catch(err){

console.log(

err.response?.data
||
err.message

);

return res.sendStatus(
500
);

}

});



// =====================
// start
// =====================

const PORT=
process.env.PORT
||
3000;

app.listen(
PORT,
()=>{

console.log(
`🚀 Running on ${PORT}`
);

});
