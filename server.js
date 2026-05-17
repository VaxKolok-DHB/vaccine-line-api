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

const TOKEN=process.env."DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";


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

}catch(err){

console.log(
err.response?.data||
err.message
);

}

}



// ========================
// WEBHOOK
// ========================

app.post(
"/webhook",
async(req,res)=>{

try{

const events=
req.body.events||[];

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

const resData=
await axios.get(
`${DB}/children.json`
);

const children=
resData.data||{};

let foundKey=null;

for(
let key
in children
){

if(
children[key]
.hn===hn
){

foundKey=key;
break;

}

}


if(
!foundKey
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
children[foundKey];

await axios.patch(

`${DB}/children/${foundKey}.json`,

{

lineUserId:
userId,

registered:
true,

registeredAt:
new Date()
.toISOString(),

followupStatus:
"🟡 รอติดตาม"

}

);


// วัคซีน

const vaccines=
c.vaccines||{};

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



// ========================
// follow-up
// ========================

setTimeout(

async()=>{

await axios.patch(

`${DB}/children/${foundKey}.json`,

{

followupStatus:
"🟠 ส่งติดตามแล้ว"

}

);


await push(

userId,

`📋 แบบติดตามอาการ

👶 ${c.name}

⏰ ${thaiTime()}

ผ่านไปแล้ว
30 วินาที

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

await reply(
e.replyToken,
"✅ รับข้อมูลเรียบร้อย"
);

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
err.response?.data||
err.message
);

return res.sendStatus(
500
);

}

});

const PORT=
process.env.PORT || 3000;

app.listen(
PORT,
()=>{

console.log(
`🚀 Running on ${PORT}`
);

});
