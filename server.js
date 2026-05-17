require("dotenv").config();

const express=require("express");
const axios=require("axios");
const cors=require("cors");

const app=express();

app.use(cors());
app.use(express.json());

const TOKEN = "DIK8oggf4sTTqeGzpc+PnWOX/4g+rGQOt4x/E7+b7uxOT0nSQcpU/O8to6IZgIOAzRpfGzesWr5Gh+P0EAH6gTKJ+lhqyOIVGOgS+o9cY3S3h6+l0vY1sMQ0hmZDKOaNu6zkfaYL+4unZLnjWLJBdgdB04t89/1O/w1cDnyilFU=";


const DB="https://vaccine-dashboard-81107-default-rtdb.asia-southeast1.firebasedatabase.app";



// =================
// helper
// =================

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



async function getChildren(){

const res=
await axios.get(
`${DB}/children.json`
);

return res.data||{};

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



// =================
// webhook
// =================

app.post(
"/webhook",
async(
req,
res
)=>{

try{

const e=
req.body.events?.[0];

if(
!e
||
e.type!=="message"
){

return res.sendStatus(
200
);

}

const text=
e.message.text.trim();

const userId=
e.source.userId;


// =================
// ลงทะเบียน
// =================

if(
text.startsWith(
"ลงทะเบียน"
)
){

const hn=
text.split(
" "
)[1];

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
.toISOString(),

followupStatus:
"🟡 รอติดตาม"

}

);


const vaccineText=

Object.entries(
c.vaccines||{}
)

.map(
([k,v])=>

`${k}
(${v})`

)

.join("\n")

||

"ยังไม่มีข้อมูล";


await reply(

e.replyToken,

`✅ ลงทะเบียนสำเร็จ

👶 ${c.name}

🆔 ${c.hn}

💉
${vaccineText}

📞 ${c.phone||"-"}

🕒 ${thaiTime()}`

);

return res.sendStatus(
200
);

}



// =================
// รับอาการ
// =================

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
await getChildren();

const found=
findByUserId(
children,
userId
);

if(
!found
){

return res.sendStatus(
200
);

}

const c=
found.child;

let level=
"🟢 ปกติ";

if(
symptom.includes(
"ไข้สูง"
)
){

level=
"🟠 เฝ้าระวัง";

}

if(
symptom.includes(
"รุนแรง"
)
){

level=
"🔴 ฉุกเฉิน";

}


await axios.put(

`${DB}/symptoms/${c.hn}.json`,

{

name:
c.name,

hn:
c.hn,

phone:
c.phone,

symptom,

level,

status:
"🟢 ติดตามแล้ว",

time:
new Date()
.toISOString()

}

);


await axios.patch(

`${DB}/children/${found.key}.json`,

{

followupStatus:
"🟢 ติดตามแล้ว"

}

);


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
err.response?.data ||
err.message
);

res.sendStatus(
500
);

}

});



// =================
// ส่งวัคซีน
// =================

app.post(
"/send",
async(
req,
res
)=>{

try{

const{

name,
userId,
vaccines=[],
phone,
date

}=req.body;

await push(

userId,

`📌 แจ้งการรับวัคซีน

👶 ${name}

📅 ${date}

💉 ${vaccines.join(", ")}

📞 ${phone}

🕒 ${thaiTime()}`

);


// ส่งติดตาม 30 วิ

setTimeout(

async()=>{

await push(

userId,

`📋 แบบติดตามอาการ

👶 ${name}

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

res.send(
"sent"
);

}
catch(err){

console.log(
err.response?.data||
err.message
);

res.status(500)
.send("error");

}

});



const PORT=
process.env.PORT || 3000;

app.listen(
PORT,
()=>{

console.log(
`🚀 Running ${PORT}`
);

});
