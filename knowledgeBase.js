const { getKnowledgeBase } = require("./knowledgeBase");

// แยกฐานความรู้ (knowledge-base.md) ออกเป็นรายการคำถาม-คำตอบ
// รูปแบบไฟล์: **หมายเลข หัวข้อคำถาม**\n<คำตอบ>\nอ้างอิง: ...
let cachedEntries = null;
let cachedIndex = null;

function parseEntries(text) {
  const entries = [];
  const regex =
    /\*\*(\d+\.\d+)\s+([^\n*]+?)\*\*\r?\n([\s\S]*?)(?=\n\*\*\d+\.\d+\s|\n##\s|\n---|\s*$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, id, question, rawBody] = match;
    const body = rawBody.trim();
    if (body) {
      entries.push({ id, question: question.trim(), body });
    }
  }
  return entries;
}

function getEntries() {
  if (!cachedEntries) {
    cachedEntries = parseEntries(getKnowledgeBase());
  }
  return cachedEntries;
}

function normalize(str) {
  return String(str || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// ภาษาไทยไม่มีช่องว่างคั่นคำ จึงใช้ character bigram แทนการตัดคำ
function bigramCounts(str) {
  const counts = new Map();
  const s = normalize(str);
  if (s.length < 2) {
    if (s.length === 1) counts.set(s, 1);
    return counts;
  }
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  return counts;
}

// สร้าง TF-IDF index จากทุกรายการ เพื่อลดน้ำหนัก bigram ที่พบบ่อยทั่วไป
// (เช่น "า-ล", "ม-ี") และเพิ่มน้ำหนัก bigram ที่เจาะจงหัวข้อจริง ๆ
function buildIndex(entries) {
  const N = entries.length || 1;
  const docCounts = entries.map((e) => bigramCounts(`${e.question} ${e.body}`));

  const df = new Map();
  for (const counts of docCounts) {
    for (const gram of counts.keys()) {
      df.set(gram, (df.get(gram) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [gram, d] of df) {
    idf.set(gram, Math.log((N + 1) / (d + 1)) + 1);
  }
  const maxIdf = Math.log(N + 1) + 1; // น้ำหนักสำหรับ bigram ที่ไม่เคยพบในฐานความรู้เลย

  const vectors = docCounts.map((counts) => {
    const vec = new Map();
    let normSq = 0;
    for (const [gram, tf] of counts) {
      const w = tf * (idf.get(gram) || maxIdf);
      vec.set(gram, w);
      normSq += w * w;
    }
    return { vec, norm: Math.sqrt(normSq) };
  });

  return { idf, maxIdf, vectors };
}

function getIndex() {
  if (!cachedIndex) {
    cachedIndex = buildIndex(getEntries());
  }
  return cachedIndex;
}

function vectorize(str, idf, maxIdf) {
  const counts = bigramCounts(str);
  const vec = new Map();
  let normSq = 0;
  for (const [gram, tf] of counts) {
    const w = tf * (idf.get(gram) || maxIdf);
    vec.set(gram, w);
    normSq += w * w;
  }
  return { vec, norm: Math.sqrt(normSq) };
}

function cosine(a, b) {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [small, big] = a.vec.size < b.vec.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [gram, w] of small.vec) {
    const w2 = big.vec.get(gram);
    if (w2) dot += w * w2;
  }
  return dot / (a.norm * b.norm);
}

/**
 * ค้นหาคำถาม-คำตอบที่ใกล้เคียงที่สุดจากฐานความรู้ โดยไม่ใช้ AI
 * ใช้ TF-IDF weighted cosine similarity บน character bigram
 * @param {string} userMessage ข้อความจากผู้ใช้
 * @param {number} threshold คะแนนความคล้ายขั้นต่ำที่ยอมรับ (0-1)
 * @returns {{id:string, question:string, body:string}|null}
 */
function search(userMessage, threshold = 0.185) {
  const entries = getEntries();
  const { idf, maxIdf, vectors } = getIndex();
  const qVec = vectorize(userMessage, idf, maxIdf);

  let best = null;
  let bestScore = 0;
  entries.forEach((entry, i) => {
    const score = cosine(qVec, vectors[i]);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  if (best && bestScore >= threshold) {
    return best;
  }
  return null;
}

/**
 * (ใช้สำหรับ debug/ปรับจูน) คืนคะแนนความคล้ายของทุกรายการ เรียงจากมากไปน้อย
 */
function searchAll(userMessage, topN = 5) {
  const entries = getEntries();
  const { idf, maxIdf, vectors } = getIndex();
  const qVec = vectorize(userMessage, idf, maxIdf);
  const scored = entries.map((entry, i) => ({
    entry,
    score: cosine(qVec, vectors[i]),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

module.exports = { search, getEntries, searchAll };