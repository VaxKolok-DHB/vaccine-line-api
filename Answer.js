const { search } = require("./kbSearch");

// หมายเหตุ: ระบบนี้ไม่ใช้ AI/บริการภายนอกใด ๆ แล้ว
// ตอบคำถามด้วยการค้นหาข้อความที่ใกล้เคียงที่สุดจาก knowledge-base.md เท่านั้น
// ไม่มีค่าใช้จ่าย ไม่ต้องมี API key

const GREETING_REGEX = /^(สวัสดี|หวัดดี|hi|hello)/i;

const GREETING_REPLY =
  "สวัสดีค่ะ/ครับ 🙏 ระบบ VaxKolok ยินดีให้บริการ\n\n" +
  'พิมพ์คำถามเรื่องวัคซีนได้เลย เช่น "ลูกฉีดวัคซีนแล้วมีไข้ทำอย่างไร"\n\n' +
  'หรือพิมพ์ "ลงทะเบียน [HN]" เพื่อใช้ระบบติดตามอาการหลังฉีดวัคซีน เช่น ลงทะเบียน 12345';

const NOT_FOUND_REPLY =
  "ขออภัยครับ/ค่ะ ยังไม่มีข้อมูลเรื่องนี้ในฐานข้อมูลของระบบ\n" +
  "แนะนำให้ปรึกษาแพทย์หรือเจ้าหน้าที่สาธารณสุขใกล้บ้านสำหรับคำถามนี้โดยตรง\n\n" +
  'หรือลองพิมพ์คำถามให้ตรงประเด็นมากขึ้น เช่น "วัคซีนบาดทะยักฉีดกี่เข็ม"';

function formatAnswer(entry) {
  const lines = entry.body.split("\n").map((l) => l.trim());
  const refLine = lines.find((l) => l.startsWith("อ้างอิง"));
  const bodyLines = lines.filter((l) => l && !l.startsWith("อ้างอิง"));
  let text = bodyLines.join("\n");
  if (refLine) {
    text += `\n\n${refLine}`;
  }
  return text;
}

/**
 * ตอบคำถามผู้ใช้โดยค้นจากฐานความรู้เรื่องวัคซีน (ไม่ใช้ AI)
 * @param {string} userMessage ข้อความจากผู้ใช้ LINE
 * @returns {Promise<string>} คำตอบที่จะส่งกลับ
 */
async function answerQuestion(userMessage) {
  const text = (userMessage || "").trim();

  if (!text) {
    return NOT_FOUND_REPLY;
  }

  if (GREETING_REGEX.test(text)) {
    return GREETING_REPLY;
  }

  const match = search(text);
  if (match) {
    return formatAnswer(match);
  }

  return NOT_FOUND_REPLY;
}

module.exports = { answerQuestion };