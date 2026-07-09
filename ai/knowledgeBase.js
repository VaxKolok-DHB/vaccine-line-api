const fs = require("fs");
const path = require("path");

const KB_PATH = path.join(__dirname, "..", "knowledge-base.md");

let cachedContent = null;

/**
 * โหลดฐานความรู้จาก knowledge-base.md (แคชไว้หลังโหลดครั้งแรก)
 * แก้ไข/เพิ่มเนื้อหาไฟล์นี้ได้ตลอดเวลา — แค่แก้แล้ว restart เซิร์ฟเวอร์
 */
function getKnowledgeBase() {
  if (cachedContent === null) {
    try {
      cachedContent = fs.readFileSync(KB_PATH, "utf8");
    } catch (err) {
      console.error("[knowledgeBase] อ่านไฟล์ knowledge-base.md ไม่สำเร็จ:", err.message);
      cachedContent = "";
    }
  }
  return cachedContent;
}

module.exports = { getKnowledgeBase };
