// =========================
// Firebase
// =========================
const firebaseConfig = {
  apiKey: "HnOSpjSHma268VX3glsVJ9idzj9Uc1jjcqkJ7P11",
  authDomain: "vaccine-dashboard-bc687.firebaseapp.com",
  databaseURL: "https://vaccine-dashboard-bc687-default-rtdb.firebaseio.com/",
  projectId: "vaccine-dashboard-bc687",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =========================
// ตำบล
// =========================
const tambonMap = {
  all: "ทั้งหมด",
  kolok: "สุไหงโก-ลก",
  munoh: "มูโนะ",
  pasemas: "ปาเสมัส",
  puyoh: "ปูโยะ"
};

// =========================
// รายการวัคซีน
// =========================
const vaccineList = [
  "BCG", "HBV1", "HBV2",
  "IPV1", "IPV2",
  "DTP1", "DTP2", "DTP3", "DTP4", "DTP5",
  "OPV1", "OPV2", "OPV3", "OPV4", "OPV5",
  "MMR1", "MMR2",
  "JE1", "JE2",
  "Rota1", "Rota2", "Rota3"
];

const vaccineLabel = {
  "BCG":"BCG","HBV1":"HBV1","HBV2":"HBV2",
  "IPV1":"IPV1","IPV2":"IPV2",
  "DTP1":"DTP-HB-Hib1","DTP2":"DTP-HB-Hib2","DTP3":"DTP-HB-Hib3","DTP4":"DTP4","DTP5":"DTP5",
  "OPV1":"OPV1","OPV2":"OPV2","OPV3":"OPV3","OPV4":"OPV4","OPV5":"OPV5",
  "MMR1":"MMR1","MMR2":"MMR2",
  "JE1":"JE1","JE2":"JE2",
  "Rota1":"Rota1","Rota2":"Rota2","Rota3":"Rota3"
};

// เกณฑ์อายุเริ่มฉีด (หน่วย: เดือน)
const vaccineAgeSchedule = {
  BCG:0, HBV1:0,
  DTP1:2, IPV1:2, OPV1:2, Rota1:2,
  DTP2:4, IPV2:4, OPV2:4, Rota2:4,
  DTP3:6, OPV3:6, Rota3:6,
  MMR1:9, JE1:9,
  DTP4:18, OPV4:18,
  MMR2:30, JE2:30,
  DTP5:72, OPV5:72
};

// =========================
// หน่วยบริการ
// =========================
const hospitalData = {
  kolok: [
    { id: "77729", name: "ศูนย์แพทย์ใกล้ใจ1 (เทศบาล)" },
    { id: "77728", name: "ศูนย์แพทย์ใกล้ใจ2 (เจริญเขต)" }
  ],
  munoh: [
    { id: "10169", name: "รพ.สต.มูโนะ" }
  ],
  puyoh: [
    { id: "10170", name: "รพ.สต.ปูโยะ" }
  ],
  pasemas: [
    { id: "10168", name: "รพ.สต.ปาเสมัส" },
    { id: "10658", name: "รพ.สต.บ้านกวาลอซีรา" }
  ]
};

function getHospitalName(id) {
  for (const list of Object.values(hospitalData)) {
    const h = list.find(x => x.id === id);
    if (h) return h.name;
  }
  return "-";
}

// =========================
// หมู่/ชุมชน
// =========================
const villageData = {
  pasemas: {
    "1": { name: "บ้านซรายอ",      leader: "ฮารีมคาน" },
    "2": { name: "บ้านตือระ",       leader: "นาซูฮา"   },
    "3": { name: "บ้านปาเสมัส",     leader: "ณรงค์"    },
    "4": { name: "บ้านน้ำตก",       leader: "มาฮาโซ"   },
    "5": { name: "บ้านกวาลอซีรา",   leader: "มะรอดี"   },
    "6": { name: "บ้านซรายอออก",    leader: "ปฏิวัติ"  },
    "7": { name: "บ้านกูแบอีแก",    leader: "อัสมี"    },
    "8": { name: "บ้านศาลาใหม่",    leader: "รุสวา"    }
  },
  munoh: {
    "1": { name: "บ้านมูโนะ",       leader: "สาลีมี"   },
    "2": { name: "บ้านลูโบะลือซง",  leader: "นาทวี"    },
    "3": { name: "บ้านปาดังยอ",     leader: "มุสตอปา"  },
    "4": { name: "บ้านปูโปะ",       leader: "ประเสริฐ" },
    "5": { name: "บ้านบูเก๊ะ",      leader: "อามาซะ"   }
  },
  puyoh: {
    "1": { name: "บ้านลาแล",        leader: "เฉลิมพล"  },
    "2": { name: "บ้านปูโยะ",       leader: "อาหามะ"   },
    "3": { name: "บ้านฆอแย",        leader: "ไซมี"     },
    "4": { name: "บ้านน้ำตก",       leader: "นรวีร์"   },
    "5": { name: "บ้านตอออ",        leader: "สมนึก"    },
    "6": { name: "บ้านกูยิ",        leader: "มะยูนุ"   }
  }
};

const kolokCommunity = {
  "1":{ name:"ชุมชนกูโบร์" },"2":{ name:"ชุมชนโต๊ะลือเบ" },"3":{ name:"ชุมชนตันหยงมะลิ" },
  "4":{ name:"ชุมชนโก-ลกวิลเลจ" },"5":{ name:"ชุมชนบือเร็ง" },"6":{ name:"ชุมชนกือดำบำรู" },
  "7":{ name:"ชุมชนกือบงกำแม" },"8":{ name:"ชุมชนหัวสะพาน" },"9":{ name:"ชุมชนเสาสัญญาณ" },
  "10":{ name:"ชุมชนดงงูเห่า" },"11":{ name:"ชุมชนหลังด่าน" },"12":{ name:"ชุมชนมัสยิดกลาง" },
  "13":{ name:"ชุมชนจือแลตูลี" },"14":{ name:"ชุมชนสันติสุข" },"15":{ name:"ชุมชนปาโงปิเมง" },
  "16":{ name:"ชุมชนปาโงเปาะเล็ง" },"17":{ name:"ชุมชนโปฮงยามู" },"18":{ name:"ชุมชนอริศรา" },
  "19":{ name:"ชุมชนเจริญสุข" },"20":{ name:"ชุมชนหัวกุญแจ" },"21":{ name:"ชุมชนสวนมะพร้าว" },
  "22":{ name:"ชุมชนท่ากอไผ่" },"23":{ name:"ชุมชนท่าประปา" },"24":{ name:"ชุมชนท่าโรงเลื่อย" },
  "25":{ name:"ชุมชนหลังล้อแม็ก" },"26":{ name:"ชุมชนศรีอามาน" },"27":{ name:"ชุมชนทรายทอง" },
  "28":{ name:"ชุมชนบือเร็งใน" },"29":{ name:"ชุมชนซรีจาฮายา" },"30":{ name:"ชุมชนเจริญทรัพย์" },
  "31":{ name:"ชุมชนเจริญเขต" }
};

// =========================
// วันที่ Helper
// =========================
function toThaiDateDisplay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${parseInt(y) + 543}`;
}

function toInputDate(val) {
  if (!val) return "";
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.includes("/")) {
    const parts = val.split("/");
    if (parts.length === 3) {
      let [d, m, y] = parts.map(Number);
      if (y >= 2500) y -= 543;
      return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }
  if (!isNaN(val) && Number(val) > 40000) {
    return new Date((Number(val) - 25569) * 86400 * 1000).toISOString().split("T")[0];
  }
  return val;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// =========================
// Flatpickr พ.ศ.
// =========================
function patchBEYear(fp) {
  const container = fp.calendarContainer;
  if (!container) return;
  const dopatch = () => {
    const yearEl = container.querySelector(".cur-year");
    if (!yearEl) return;
    const ce = parseInt(yearEl.value || yearEl.textContent || "0");
    if (ce > 0 && ce < 2500) yearEl.value = ce + 543;
  };
  dopatch();
  if (!fp._beObserver) {
    fp._beObserver = new MutationObserver(dopatch);
    fp._beObserver.observe(container, { childList: true, subtree: true, characterData: true });
  }
}

function initThaiDatepicker(el, isoVal, onChangeCb) {
  const fp = flatpickr(el, {
    locale: "th",
    dateFormat: "d/m/Y",
    defaultDate: isoVal || null,
    allowInput: false,
    onReady(_, __, fp)      { patchBEYear(fp); _setThaiValue(fp); },
    onMonthChange(_, __, fp){ patchBEYear(fp); },
    onYearChange(_, __, fp) { patchBEYear(fp); },
    onChange(dates, _, fp) {
      if (!dates[0]) return;
      _setThaiValue(fp);
      const isoSave = flatpickr.formatDate(dates[0], "Y-m-d");
      if (onChangeCb) onChangeCb(isoSave);
    }
  });
  _setThaiValue(fp);
  return fp;
}

function _setThaiValue(fp) {
  if (!fp.selectedDates[0]) return;
  const dt = fp.selectedDates[0];
  const d  = String(dt.getDate()).padStart(2, "0");
  const m  = String(dt.getMonth() + 1).padStart(2, "0");
  const y  = dt.getFullYear() + 543;
  fp.input.value = `${d}/${m}/${y}`;
}

// =========================
// Hospital filter
// =========================
function updateHospitalFilter() {
  const tambonEl = document.getElementById("tambonFilter");
  const hospitalSelect = document.getElementById("hospitalFilter");
  if (!tambonEl || !hospitalSelect) return;
  const tambon = tambonEl.value;
  hospitalSelect.innerHTML = `<option value="all">ทุกหน่วยบริการ</option>`;
  hospitalSelect.value = "all";
  if (!hospitalData[tambon]) return;
  hospitalData[tambon].forEach(h => {
    hospitalSelect.innerHTML += `<option value="${h.id}">${h.name}</option>`;
  });
}

// =========================
// ล็อกอิน
// =========================
function login() {
  let cid = document.getElementById("cid").value.replace(/\D/g, '');
  const msg = document.getElementById("msg");
  msg.innerText = "";
  if (cid.length !== 13) { msg.innerText = "กรอกเลขบัตรให้ครบ 13 หลัก"; return; }
  db.ref("users").once("value", snap => {
    const data = snap.val() || {};
    let foundUser = null;
    for (let id in data) {
      const dbCid = (data[id].cid || "").replace(/\D/g, '');
      if (dbCid === cid) { foundUser = { id, ...data[id] }; break; }
    }
    if (!foundUser)                          { msg.innerText = "ไม่พบผู้ใช้"; return; }
    if (foundUser.status === "rejected")     { msg.innerText = "บัญชีถูกปฏิเสธ"; return; }
    if (foundUser.status !== "approved")     { msg.innerText = "รอผู้ดูแลอนุมัติ"; return; }
    const fullName = foundUser.name + " " + (foundUser.lastname || "");
    localStorage.setItem("user",     foundUser.cid);
    localStorage.setItem("name",     fullName);
    localStorage.setItem("username", fullName);
    localStorage.setItem("role",     foundUser.role || "user");
    db.ref("loginLogs").push({
      cid: foundUser.cid, name: fullName, role: foundUser.role || "user",
      date: new Date().toLocaleDateString("th-TH"),
      loginTime: new Date().toLocaleTimeString("th-TH")
    });
    window.location.href = "index.html";
  });
}

function loadKPI()  { /* stub */ }
function goTambon() { /* stub */ }

// =========================
// สมัคร
// =========================
function register() {
  const name     = document.getElementById("name").value.trim();
  const lastname = document.getElementById("lastname").value.trim();
  const cid      = document.getElementById("cid").value.trim();
  const email    = document.getElementById("email").value.trim();
  const phone    = document.getElementById("phone").value.trim();
  const position = getPosition();
  const msg      = document.getElementById("msg");
  msg.style.color = "red";
  if (!name || !lastname || !cid) { msg.innerText = "กรุณากรอกข้อมูลให้ครบ"; return; }
  if (cid.length !== 13)          { msg.innerText = "เลขบัตรต้อง 13 หลัก";    return; }
  if (!position)                  { msg.innerText = "กรุณาเลือกหรือระบุตำแหน่งงาน"; return; }
  db.ref("users/" + cid).once("value", snap => {
    if (snap.exists()) { msg.innerText = "มีผู้ใช้นี้แล้ว"; return; }
    db.ref("users/" + cid).set({
      cid, name, lastname, email, phone, position,
      role: "user", status: "pending", createdAt: new Date().toISOString()
    }).then(() => {
      msg.style.color = "green";
      msg.innerText = "สมัครสำเร็จ รอผู้ดูแลอนุมัติ";
      setTimeout(() => { window.location.href = "login.html"; }, 1500);
    });
  });
}

function getPosition() {
  const sel = document.getElementById("position");
  if (!sel) return "";
  if (sel.value === "other") return (document.getElementById("position-other")?.value || "").trim();
  return sel.value;
}

function handlePosChange() {
  const sel         = document.getElementById("position");
  const otherWrap   = document.getElementById("other-wrap");
  const preview     = document.getElementById("pos-preview");
  const previewText = document.getElementById("pos-preview-text");
  if (!sel) return;
  if (sel.value === "other") {
    if (otherWrap) otherWrap.style.display = "block";
    if (preview)   preview.style.display   = "none";
    document.getElementById("position-other")?.focus();
  } else if (sel.value) {
    if (otherWrap)   otherWrap.style.display   = "none";
    if (previewText) previewText.textContent    = sel.value;
    if (preview)     preview.style.display      = "block";
  } else {
    if (otherWrap) otherWrap.style.display = "none";
    if (preview)   preview.style.display   = "none";
  }
}

function toggleBtn() {
  const agreed = document.getElementById("pdpa-agree")?.checked;
  const btn    = document.getElementById("btn-reg");
  if (btn) btn.disabled = !agreed;
}

// =========================
// State + กรองจากกราฟ
// =========================
let currentPage    = 1;
const rowsPerPage  = 30;
let followChart;
let chartMode      = "percent";
let childRef       = null;
let allChildren    = [];
const PAGE_SIZE    = 6000;
let lastKey        = null;
let isLoading      = false;
let statusFilter   = "all";
let selectedVaccine = "all";

// ตัวแปรกรองจากคลิกกราฟ
let selectedBarKey  = null;
let selectedBarMode = "tambon";

// badge กรองจากกราฟ
function showBarFilterBadge(label) {
  let badge = document.getElementById("barFilterBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "barFilterBadge";
    badge.style.cssText = [
      "display:inline-flex","align-items:center","gap:6px",
      "padding:5px 14px","background:#dbeafe","color:#1e40af",
      "border-radius:99px","font-size:13px","font-weight:600",
      "border:1px solid #93c5fd"
    ].join(";");
    const actionBar = document.querySelector(".action-bar");
    if (actionBar) actionBar.appendChild(badge);
  }
  badge.innerHTML =
    `<i class="fa-solid fa-chart-bar fa-xs"></i> ${label}
     <button onclick="clearBarFilter()" title="ล้างตัวกรอง"
       style="background:none;border:none;cursor:pointer;color:#1e40af;
              font-size:15px;line-height:1;padding:0 2px;margin-left:2px">&times;</button>`;
}

function clearBarFilter() {
  selectedBarKey = null;
  const badge = document.getElementById("barFilterBadge");
  if (badge) badge.remove();
  currentPage = 1;
  loadFollow();
}

// =========================
// loadFollow
// =========================
function loadFollow() {
  const keyword        = (document.getElementById("searchInput")?.value  || "").toLowerCase();
  const tambonFilter   = document.getElementById("tambonFilter")?.value  || "all";
  const hospitalFilter = document.getElementById("hospitalFilter")?.value || "all";
  const typeAreaFilter = document.getElementById("typeAreaFilter")?.value || "all";
  const ageFilter      = document.getElementById("ageFilter")?.value     || "all";
  const mobileList     = document.getElementById("mobileList");
  const isMobile       = window.innerWidth < 768;

  if (mobileList) mobileList.innerHTML = "";
  if (childRef)   childRef.off();
  childRef = db.ref("children").orderByKey().limitToFirst(PAGE_SIZE);

  childRef.once("value", snap => {
    const data         = snap.val() || {};
    const html         = [];
    const mobileHtml   = [];
    const filteredData = [];
    let done = 0, notdone = 0;
    const vaccineFilterActive = (selectedVaccine !== "all");

    for (const id in data) {
      const c = data[id] || {};
      if (!c.name?.trim() || !c.cid?.trim()) continue;

      if (ageFilter !== "all") {
        const ageYears   = Math.floor(getAgeMonths(c.birth) / 12);
        const targetYear = parseInt(ageFilter);
        if (targetYear === 5) { if (ageYears < 5) continue; }
        else                  { if (ageYears !== targetYear) continue; }
      }

      if (tambonFilter   !== "all" && c.tambon   !== tambonFilter)   continue;
      if (hospitalFilter !== "all" && c.hospital !== hospitalFilter) continue;
      if (typeAreaFilter !== "all") {
        const cType = c.typeArea || "1";
        if (cType !== typeAreaFilter) continue;
      }

      // กรองจากคลิกกราฟ
      if (selectedBarKey !== null) {
        if (selectedBarMode === "tambon") {
          if ((c.tambon || "ไม่ระบุ") !== selectedBarKey) continue;
        } else {
          if ((c.village || "ไม่ระบุ") !== selectedBarKey) continue;
        }
      }

      const hn   = (c.hn   || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      const cid  = (c.cid  || "").toLowerCase();
      if (keyword && !name.includes(keyword) && !cid.includes(keyword) && !hn.includes(keyword)) continue;

      const count = c.vaccines ? Object.keys(c.vaccines).length : 0;
      let isDone;
      if (vaccineFilterActive) {
        const minAge    = vaccineAgeSchedule?.[selectedVaccine] ?? 0;
        const hasVax    = !!(c.vaccines?.[selectedVaccine]);
        const oldEnough = getAgeMonths(c.birth) >= minAge;
        if      (statusFilter === "done")    { if (!hasVax)              continue; isDone = true;  }
        else if (statusFilter === "notdone") { if (hasVax || !oldEnough) continue; isDone = false; }
        else                                 { if (!oldEnough) continue;           isDone = hasVax; }
      } else {
        isDone = count >= 10;
        if (statusFilter === "done"    && !isDone) continue;
        if (statusFilter === "notdone" &&  isDone) continue;
      }

      if (isDone) { done++; } else { notdone++; }

      if (isMobile) {
        mobileHtml.push(`
<div class="child-card">
  <div class="child-card-top">
    <div>
      <div class="child-card-name">
        <i class="fa-solid fa-child fa-xs" style="color:#6b7280;margin-right:4px"></i>${c.name || '-'}
      </div>
      <div class="child-card-hn">HN : ${c.hn || '-'}</div>
    </div>
    <span class="tag ${isDone ? 'tag-green' : ''}" style="${isDone ? '' : 'background:#fee2e2;color:#dc2626'}">
      ${isDone ? (vaccineFilterActive ? 'ได้รับแล้ว' : 'ฉีดครบ') : (vaccineFilterActive ? 'ยังไม่ได้รับ' : 'ยังไม่ครบ')}
    </span>
  </div>
  <div class="child-card-row">
    <i class="fa-solid fa-location-dot fa-xs" style="color:#6b7280;width:14px"></i> ${getTambonName(c.tambon)}
  </div>
  <div class="child-card-row">
    <i class="fa-solid fa-house fa-xs" style="color:#6b7280;width:14px"></i> บ้าน ${c.house || "-"} ${c.tambon === "kolok" ? "" : "หมู่ "}${c.village || "-"}
  </div>
  <div class="child-meta">
    <span class="tag">${getAgeBadge(c.birth)}</span>
    <span class="tag">
      <i class="fa-solid fa-syringe fa-xs"></i> ${count} เข็ม
    </span>
  </div>
  <div style="margin-top:10px">
    <button onclick="openVaccineModal('${id}')" class="btn btn-primary">
      <i class="fa fa-syringe fa-sm"></i> ดูวัคซีน
    </button>
  </div>
</div>`);
      }

      filteredData.push({ id, c, count, isDone });
    }

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start    = (currentPage - 1) * rowsPerPage;
    const pageData = filteredData.slice(start, start + rowsPerPage);

    pageData.forEach((row, rowIndex) => {
      const { id, c, count, isDone } = row;
      const birthISO = formatDateInput(c.birth);
      const rowNum   = start + rowIndex + 1;
      html.push(`
<tr data-id="${id}">
  <td style="text-align:center;color:#6b7280;font-size:13px;white-space:nowrap;">${rowNum}</td>
  <td style="min-width:120px"><input value="${escHtml(c.hn)}" onchange="autoSave('${id}','hn',this.value)" style="min-width:110px"></td>
  <td style="min-width:155px"><input value="${escHtml(c.cid)}"  onchange="autoSave('${id}','cid',this.value)"  style="min-width:145px"></td>
  <td style="min-width:200px"><input value="${escHtml(c.name)}" onchange="autoSave('${id}','name',this.value)" style="min-width:190px"></td>
  <td>
    <select class="form-select" style="min-width:130px" onchange="changeTambon(this)">
      <option value="">-- เลือกตำบล --</option>
      <option value="kolok"   ${c.tambon==="kolok"   ? "selected":""}>สุไหงโก-ลก</option>
      <option value="munoh"   ${c.tambon==="munoh"   ? "selected":""}>มูโนะ</option>
      <option value="puyoh"   ${c.tambon==="puyoh"   ? "selected":""}>ปูโยะ</option>
      <option value="pasemas" ${c.tambon==="pasemas" ? "selected":""}>ปาเสมัส</option>
    </select>
  </td>
  <td>
    <select class="form-select" style="min-width:160px" onchange="autoSave('${id}','hospital',this.value)">
      <option value="">-- เลือกรพ.สต --</option>
      <option value="10170" ${c.hospital==="10170"?"selected":""}>รพ.สต.ปูโยะ</option>
      <option value="10169" ${c.hospital==="10169"?"selected":""}>รพ.สต.มูโนะ</option>
      <option value="10168" ${c.hospital==="10168"?"selected":""}>รพ.สต.ปาเสมัส</option>
      <option value="77729" ${c.hospital==="77729"?"selected":""}>ศูนย์แพทย์ใกล้ใจ1</option>
      <option value="77728" ${c.hospital==="77728"?"selected":""}>ศูนย์แพทย์ใกล้ใจ2</option>
      <option value="10658" ${c.hospital==="10658"?"selected":""}>รพ.สต.บ้านกวาลอซีรา</option>
    </select>
  </td>
  <td><input value="${escHtml(c.house)}"  onchange="autoSave('${id}','house',this.value)"></td>
  <td>${buildVillageDropdown(c.tambon, c.village, id)}</td>
  <td>
    <input type="text"
      class="form-control form-control-sm birth-datepicker"
      data-iso="${birthISO}"
      data-child-id="${id}"
      placeholder="วว/ดด/ปปปป"
      style="min-width:130px"
      readonly>
  </td>
  <td class="age-cell">${getAgeBadge(c.birth)}</td>
  <td onclick="openVaccineModal('${id}')" style="cursor:pointer;text-align:center">
    <div style="display:inline-flex;align-items:center;justify-content:center;gap:6px;
                min-width:90px;height:38px;padding:0 14px;border-radius:10px;border:1px solid #ddd;
                font-size:14px;font-weight:600;
                background:${count===0?'#fee2e2':'#dcfce7'};color:${count===0?'#dc2626':'#059669'};">
      <i class="fa-solid fa-syringe fa-sm"></i> ${count} เข็ม
    </div>
  </td>
  <td style="min-width:160px"><input value="${escHtml(c.caregiver)}" onchange="autoSave('${id}','caregiver',this.value)" placeholder="ชื่อผู้ดูแล" style="min-width:150px"></td>
  <td style="min-width:200px"><input value="${escHtml(c.note)}"      onchange="autoSave('${id}','note',this.value)"      style="min-width:190px"></td>
  <td>${c.updatedAt || "-"}</td>
  <td>
    <button onclick="deleteChild('${id}')" title="ลบ"
      style="border:none;background:none;cursor:pointer;font-size:18px;color:#e24b4a;">
      <i class="ti ti-trash"></i>
    </button>
  </td>
  <td>
    <select onchange="updateStatus('${id}',this.value)">
      <option value="pending" ${!isDone?"selected":""}>ยังไม่ครบ</option>
      <option value="done"    ${isDone?"selected":""}>ฉีดครบ</option>
    </select>
  </td>
  <td>
    <select class="form-select" style="min-width:130px" onchange="autoSave('${id}','typeArea',this.value)">
      <option value="1" ${(!c.typeArea||c.typeArea==="1")?"selected":""}>Type 1: อยู่จริงตามทะเบียน</option>
      <option value="2" ${c.typeArea==="2"?"selected":""}>Type 2: มีชื่อ ไม่อยู่จริง</option>
      <option value="3" ${c.typeArea==="3"?"selected":""}>Type 3: ไม่มีชื่อ แต่อยู่จริง</option>
      <option value="4" ${c.typeArea==="4"?"selected":""}>Type 4: นอกเขต มารับบริการ</option>
    </select>
  </td>
</tr>`);
    });

    const followTable = document.getElementById("followTable");
    if (mobileList)  mobileList.innerHTML = mobileHtml.join("");
    if (followTable) followTable.innerHTML = html.join("");

    document.querySelectorAll(".birth-datepicker").forEach(el => {
      const isoVal  = el.dataset.iso;
      const childId = el.dataset.childId;
      initThaiDatepicker(el, isoVal, (isoSave) => {
        if (childId) autoSave(childId, "birth", isoSave);
      });
    });

    renderPagination(filteredData.length);

    const isDashboard = !!document.getElementById("dash-total");
    if (!isDashboard) {
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
      setEl("total",   done + notdone);
      setEl("done",    done);
      setEl("notdone", notdone);
      const percent = (done + notdone) > 0 ? ((done / (done + notdone)) * 100).toFixed(1) : 0;
      setEl("percent", percent + "%");
    }

    const chartDesc = document.getElementById("chartDescription");
    if (chartDesc) {
      const total   = done + notdone;
      const percent = total > 0 ? ((done / total) * 100).toFixed(1) : 0;
      const title   = tambonFilter !== "all"
        ? `สรุปข้อมูลการฉีดวัคซีนรายตำบล · ${tambonMap[tambonFilter] || tambonFilter}`
        : "สรุปภาพรวมข้อมูลการฉีดวัคซีน";
      let descHtml = `<b>${title}</b><br>
        <span style="color:#059669">ฉีดแล้ว (ครบ 10 เข็มขึ้นไป):</span> ${done} คน (${percent}%)<br>
        <span style="color:#dc2626">ยังไม่ครบ:</span> ${notdone} คน`;
      if (vaccineFilterActive) {
        descHtml += `<br><small style="color:gray">* แสดงเฉพาะเด็กที่ได้รับ ${vaccineLabel[selectedVaccine] || selectedVaccine} แล้ว</small>`;
      }
      chartDesc.innerHTML = descHtml;
    }
  });
}

// =========================
// updateIndexKPI + กราฟ
// =========================
function updateIndexKPI() {
  if (document.getElementById("dash-total")) return;
  if (!document.getElementById("followChart")) return;

  const vax          = document.getElementById("vaccineFilter")?.value  || "all";
  const tambon       = document.getElementById("tambonFilter")?.value   || "all";
  const typeArea     = document.getElementById("typeAreaFilter")?.value || "all";
  const hospitalKPI  = document.getElementById("hospitalFilter")?.value || "all";
  const ageKPI       = document.getElementById("ageFilter")?.value      || "all";

  db.ref("children").once("value", snap => {
    const data = snap.val() || {};
    let done = 0, total = 0;
    const vMap = {};

    // เติมชุมชนโกลกทั้ง 31 ชุมชนก่อน เพื่อให้แสดงครบแม้ยังไม่มีข้อมูลเด็ก
    if (tambon === "kolok") {
      Object.entries(kolokCommunity).forEach(([key, info]) => {
        vMap[key] = { done: 0, not: 0, lbl: info.name };
      });
    }

    for (const id in data) {
      const c = data[id] || {};
      if (!c.name?.trim()) continue;
      if (tambon     !== "all" && c.tambon            !== tambon)     continue;
      if (typeArea   !== "all" && (c.typeArea || "1") !== typeArea)   continue;
      if (hospitalKPI !== "all" && c.hospital         !== hospitalKPI) continue;
      if (ageKPI !== "all") {
        const ageYearsKPI   = Math.floor(getAgeMonths(c.birth) / 12);
        const targetYearKPI = parseInt(ageKPI);
        if (targetYearKPI === 5) { if (ageYearsKPI < 5) continue; }
        else                     { if (ageYearsKPI !== targetYearKPI) continue; }
      }
      if (vax !== "all") {
        const minAge = vaccineAgeSchedule?.[vax] ?? 0;
        if (getAgeMonths(c.birth) < minAge) continue;
      }

      const isDone = vax === "all"
        ? Object.keys(c.vaccines || {}).length >= 10
        : !!(c.vaccines?.[vax]);

      if (statusFilter === "done"    && !isDone) continue;
      if (statusFilter === "notdone" &&  isDone) continue;

      // กรองจากคลิกกราฟ (เฉพาะ village mode — tambon ถูกกรองแล้วจาก tambonFilter DOM)
      if (selectedBarKey !== null && selectedBarMode === "village") {
        if ((c.village || "ไม่ระบุ") !== selectedBarKey) continue;
      }

      total++;
      if (isDone) done++;

      const vKey = tambon === "all"
        ? (c.tambon  || "ไม่ระบุ")
        : (c.village || "ไม่ระบุ");
      if (!vMap[vKey]) vMap[vKey] = { done: 0, not: 0, lbl: "" };
      if (tambon === "all") {
        vMap[vKey].lbl = tambonMap?.[c.tambon] || c.tambon || "ไม่ระบุ";
      } else if (tambon === "kolok") {
        const comInfo = kolokCommunity?.[c.village];
        vMap[vKey].lbl = comInfo
          ? comInfo.name
          : (c.village ? `ชุมชน ${c.village}` : "ไม่ระบุ");
      } else {
        const vInfo = villageData?.[tambon]?.[c.village];
        vMap[vKey].lbl = vInfo
          ? `หมู่ ${c.village} – ${vInfo.name}`
          : (c.village ? `หมู่ ${c.village}` : "ไม่ระบุ");
      }
      if (isDone) vMap[vKey].done++; else vMap[vKey].not++;
    }

    const notdone = total - done;
    const pct     = total > 0 ? (done / total * 100).toFixed(1) : 0;

    const isDash = !!document.getElementById("dash-total");
    if (!isDash) {
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
      setEl("total",   total);
      setEl("done",    done);
      setEl("notdone", notdone);
      setEl("percent", pct + "%");
    }

    const elDD = document.getElementById("followDonutDone");
    const elDN = document.getElementById("followDonutNot");
    if (elDD) elDD.textContent = done;
    if (elDN) elDN.textContent = notdone;

    const elSub = document.getElementById("villageFollowSub");
    if (elSub) {
      const tN = tambon === "all" ? "ทุกตำบล" : (tambonMap?.[tambon] || tambon);
      const vN = vax    === "all" ? "ทุกวัคซีน" : (vaccineLabel?.[vax] || vax);
      elSub.textContent = tN + " · " + vN;
    }

    // Donut chart
    const donutEl = document.getElementById("followChart");
    if (donutEl) {
      if (window._idxDonut) { window._idxDonut.destroy(); window._idxDonut = null; }
      donutEl.parentElement.innerHTML = '<canvas id="followChart"></canvas>';
      const ctx = document.getElementById("followChart").getContext("2d");
      const _p  = total > 0 ? Math.round(done / total * 100) : 0;
      window._idxDonut = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["ฉีดครบแล้ว","ยังไม่ครบ"],
          datasets: [{ data:[done,notdone], backgroundColor:["#059669","#f87171"], borderWidth:0, hoverOffset:6 }]
        },
        options: {
          cutout:"72%", responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{ position:"bottom", labels:{ boxWidth:12,padding:16,font:{size:13},usePointStyle:true } },
            tooltip:{ callbacks:{ label: c => ` ${c.label}: ${c.parsed} คน (${total>0?(c.parsed/total*100).toFixed(0):0}%)` } }
          }
        },
        plugins: [{ id:"ctr", beforeDraw(chart) {
          const { ctx, chartArea } = chart;
          const cx = (chartArea.left+chartArea.right)/2, cy = (chartArea.top+chartArea.bottom)/2;
          ctx.save();
          ctx.font = "bold 22px 'IBM Plex Sans Thai',sans-serif";
          ctx.fillStyle = "#111827"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(_p+"%", cx, cy);
          ctx.restore();
        }}]
      });
    }

    // Bar chart รายหมู่/ตำบล
    const vWrap = document.getElementById("villageFollowWrap");
    if (vWrap) {
      if (window._idxVillage) { window._idxVillage.destroy(); window._idxVillage = null; }

      const rows = Object.entries(vMap)
        .filter(([,r]) => r.done + r.not > 0)
        .sort(([a,ra],[b,rb]) => {
          if (a === "ไม่ระบุ") return 1;
          if (b === "ไม่ระบุ") return -1;
          if (tambon === "all") return (ra.lbl||"").localeCompare(rb.lbl||"", "th");
          return parseInt(a) - parseInt(b);
        });

      const vLabels = rows.map(([,r]) => r.lbl || "ไม่ระบุ");
      const doneD   = rows.map(([,r]) => r.done);
      const notD    = rows.map(([,r]) => r.not);
      const totD    = rows.map(([,r]) => r.done + r.not);

      const bgDone = rows.map(([key]) =>
        selectedBarKey === null ? "#059669" : (key === selectedBarKey ? "#059669" : "rgba(5,150,105,0.3)"));
      const bgNot = rows.map(([key]) =>
        selectedBarKey === null ? "#f87171" : (key === selectedBarKey ? "#f87171" : "rgba(248,113,113,0.3)"));

      vWrap.style.height = Math.max(260, rows.length * 44 + 80) + "px";
      vWrap.innerHTML = '<canvas id="villageChartFollow"></canvas>';
      const vCtx = document.getElementById("villageChartFollow").getContext("2d");

      window._idxVillage = new Chart(vCtx, {
        type: "bar",
        data: {
          labels: vLabels,
          datasets: [
            { label: vax==="all"?"ฉีดครบแล้ว":`ได้รับ ${vaccineLabel?.[vax]||vax}`,
              data: doneD, backgroundColor: bgDone, borderRadius: 6, barThickness: 18 },
            { label: vax==="all"?"ยังไม่ครบ":`ยังไม่ได้รับ ${vaccineLabel?.[vax]||vax}`,
              data: notD,  backgroundColor: bgNot,  borderRadius: 6, barThickness: 18 }
          ]
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          onClick(event, elements) {
            if (!elements.length) { if (selectedBarKey !== null) clearBarFilter(); return; }
            const idx        = elements[0].index;
            const [key, obj] = rows[idx];
            if (selectedBarKey === key) { clearBarFilter(); return; }
            selectedBarKey  = key;
            selectedBarMode = tambon === "all" ? "tambon" : "village";
            if (selectedBarMode === "tambon" && key !== "ไม่ระบุ") {
              const sel = document.getElementById("tambonFilter");
              if (sel) { sel.value = key; updateHospitalFilter(); loadvaccineChart(); }
            }
            currentPage = 1;
            showBarFilterBadge(obj.lbl || key);
            loadFollow();
            updateIndexKPI();
          },
          onHover(event, elements) {
            const canvas = event.native?.target;
            if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: { position:"top", labels:{ boxWidth:12,padding:16,font:{size:13},usePointStyle:true } },
            tooltip: { callbacks: { label: c => {
              const t = totD[c.dataIndex] || 1;
              return ` ${c.dataset.label}: ${c.parsed.x} คน (${(c.parsed.x/t*100).toFixed(0)}%)`;
            }}}
          },
          scales: {
            x: { grid:{color:"#f3f4f6"}, ticks:{font:{size:12}},
                 title:{display:true,text:"จำนวนเด็ก (คน)",font:{size:12},color:"#6b7280"} },
            y: { grid:{display:false}, ticks:{font:{size:12},padding:4} }
          }
        }
      });
    }
  });
}

function setMode(mode) { chartMode = mode; loadFollow(); }

// =========================
// Pagination
// =========================
function renderPagination(totalRows) {
  const paginEl  = document.getElementById("pagination");
  if (!paginEl) return;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) pages.add(i);

  const sorted = [...pages].sort((a, b) => a - b);
  let html = `<button class="btn btn-sm btn-secondary me-1" ${currentPage===1?"disabled":""} onclick="changePage(${currentPage-1})">&#9664;</button>`;
  let prev = 0;
  sorted.forEach(p => {
    if (prev && p - prev > 1) html += `<button class="btn btn-sm btn-outline me-1" disabled>…</button>`;
    html += `<button class="btn btn-sm ${p===currentPage?"btn-primary":"btn-outline-primary"} me-1" onclick="changePage(${p})">${p}</button>`;
    prev = p;
  });
  html += `<button class="btn btn-sm btn-secondary" ${currentPage===totalPages?"disabled":""} onclick="changePage(${currentPage+1})">&#9654;</button>`;
  paginEl.innerHTML = html;
}

function changePage(page) {
  const totalPages = Math.max(1, Math.ceil(/* reuse last count */ 1 / rowsPerPage));
  currentPage = Math.max(1, page);
  loadFollow();
}

// =========================
// Modal วัคซีน
// =========================
let currentId = "";

function openVaccineModal(id) {
  currentId = id;
  db.ref("children/" + id).once("value").then(snap => {
    const data    = snap.val() || {};
    const current = data.vaccines || {};
    let html = "";
    vaccineList.forEach(v => {
      const saved   = current[v] || "";
      const checked = saved ? "checked" : "";
      const dateVal = toInputDate(saved);
      html += `
      <div class="vaccine-item mb-2 d-flex align-items-center gap-2 flex-wrap">
        <input type="checkbox" value="${v}" ${checked} onchange="toggleDateInline(this,'${v}')">
        <label style="width:120px;margin:0;">${vaccineLabel[v] || v}</label>
        <input type="text" data-iso="${dateVal}" placeholder="วว/ดด/ปปปป" data-vaccine="${v}"
          style="max-width:160px;${saved?'':'display:none;'}"
          class="form-control form-control-sm thai-datepicker" readonly>
      </div>`;
    });
    document.getElementById("vaccineEditor").innerHTML = html;
    document.querySelectorAll("#vaccineEditor .thai-datepicker").forEach(el => {
      initThaiDatepicker(el, el.dataset.iso, null);
    });
    const modalEl = document.getElementById("vaccineModal");
    modalEl.addEventListener("shown.bs.modal", () => {
      modalEl.querySelector(".modal-body").style.overflowY = "visible";
      modalEl.querySelector(".modal-dialog").style.overflow = "visible";
    }, { once: true });
    new bootstrap.Modal(modalEl).show();
  }).catch(err => console.error("openVaccineModal:", err));
}

function toggleDateInline(checkbox, v) {
  const dateInput = checkbox.closest(".vaccine-item").querySelector(".thai-datepicker");
  const fp        = dateInput?._flatpickr;
  if (checkbox.checked) {
    dateInput.style.display = "";
    if (!fp?.selectedDates?.length) { fp?.setDate(new Date(), true); setTimeout(() => fp?.open(), 50); }
  } else {
    dateInput.style.display = "none";
    fp?.clear();
  }
}

// =========================
// บันทึกวัคซีน
// =========================
function saveVaccines() {
  let newVaccines = {};
  document.querySelectorAll("#vaccineEditor .vaccine-item").forEach(item => {
    const cb        = item.querySelector("input[type=checkbox]");
    const name      = cb.value;
    const dateInput = item.querySelector(".thai-datepicker");
    if (!cb.checked) return;
    const fp           = dateInput?._flatpickr;
    const selectedDate = fp?.selectedDates?.[0];
    let dateVal        = selectedDate ? flatpickr.formatDate(selectedDate, "Y-m-d") : "";
    if (!dateVal) { dateVal = todayISO(); fp?.setDate(new Date(), true); }
    newVaccines[name] = dateVal;
  });
  db.ref("children/" + currentId).once("value").then(snap => {
    const child = snap.val() || {};
    return Promise.all([
      db.ref("children/" + currentId).update({ vaccines: newVaccines, updatedAt: new Date().toLocaleString("th-TH") }),
      db.ref("symptoms/" + currentId).update({
        name: child.name || "", hn: child.hn || "", cid: child.cid || "",
        birth: child.birth || "", house: child.house || "", tambon: child.tambon || "",
        vaccines: newVaccines, symptom: "ยังไม่ระบุ", level: "รอติดตาม",
        status: "รอติดตาม", priority: 1, followStep: 1, normalCount: 0,
        nextFollowUp: Date.now() + 60000, time: Date.now()
      })
    ]);
  }).then(() => {
    alert("บันทึกแล้ว");
    try { sendLineFollowUp(currentId); } catch (e) { /* LINE ไม่ได้ตั้งค่า */ }
    try { loadFollow(); }               catch (e) { console.error(e); }
    try { loadvaccineChart(); }         catch (e) { console.error(e); }
  }).catch(err => { console.error(err); alert("บันทึกไม่สำเร็จ"); });
}

// =========================
// เปลี่ยนสถานะ
// =========================
function updateStatus(id, status) {
  if (status === "pending") {
    db.ref("children/" + id + "/vaccines").remove();
    loadFollow(); loadvaccineChart();
  } else { openVaccineModal(id); }
}

// =========================
// autosave
// =========================
let saveTimer = {};

function saveLog(action, field, oldVal, newVal) {
  // stub — บันทึก log ถ้าต้องการ
  console.log(`[saveLog] ${action}: ${field} "${oldVal}" → "${newVal}"`);
}

function autoSave(id, field, value) {
  clearTimeout(saveTimer[id + field]);
  saveTimer[id + field] = setTimeout(() => {
    db.ref("children/" + id).once("value").then(snap => {
      const oldData  = snap.val() || {};
      const oldValue = oldData[field] || "-";
      return db.ref("children/" + id).update({
        [field]: value, updatedAt: new Date().toLocaleString("th-TH")
      }).then(() => { saveLog("แก้ไขข้อมูล", field, oldValue, value); showSaved(); });
    }).catch(err => console.error("autoSave:", err));
  }, 800);
}

function showSaved() {
  let toast = document.getElementById("saveToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saveToast";
    Object.assign(toast.style, {
      position:"fixed", bottom:"20px", right:"20px",
      background:"#16a34a", color:"white", padding:"10px 16px",
      borderRadius:"8px", boxShadow:"0 4px 10px rgba(0,0,0,0.2)",
      zIndex:"9999", display:"flex", alignItems:"center", gap:"8px", fontSize:"14px"
    });
    document.body.appendChild(toast);
  }
  toast.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกแล้ว';
  toast.style.display = "flex";
  setTimeout(() => { toast.style.display = "none"; }, 1500);
}

// =========================
// เพิ่มข้อมูล
// =========================
function getFormData() {
  return {
    hn:       document.getElementById("hn")?.value.trim()      || "",
    cid:      document.getElementById("cid")?.value.trim()     || "",
    name:     document.getElementById("name")?.value.trim()    || "",
    tambon:   document.getElementById("tambon")?.value         || "",
    hospital: document.getElementById("hospital")?.value       || "",
    house:    document.getElementById("house")?.value          || "",
    birth:    document.getElementById("birth")?.value          || "",
    note:     document.getElementById("note")?.value           || "",
    village:  document.getElementById("village")?.value        || "",
    soi:      document.getElementById("soi")?.value            || "",
    phone:    document.getElementById("phone")?.value.trim()   || "",
    typeArea: document.getElementById("typeArea")?.value       || "1"
  };
}

function getVaccines() {
  let vaccines = {};
  document.querySelectorAll(".vaccine-container input[type=checkbox]:checked").forEach(cb => {
    const name      = cb.value;
    const dateInput = cb.closest(".vaccine-item")?.querySelector(".thai-datepicker");
    const fp        = dateInput?._flatpickr;
    const selected  = fp?.selectedDates?.[0];
    vaccines[name]  = selected ? flatpickr.formatDate(selected, "Y-m-d") : todayISO();
  });
  return vaccines;
}

function validateChild(c) {
  if (!c.name || !c.cid)                      { alert("กรุณากรอกชื่อและเลขบัตร"); return false; }
  if (!c.tambon || !c.hospital || !c.village) { alert("กรุณากรอกข้อมูลให้ครบ");  return false; }
  return true;
}

function resetForm() {
  ["hn","cid","name","house","birth","note","phone"].forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) el.value = "";
  });
  const villageEl = document.getElementById("village");
  const soiEl     = document.getElementById("soi");
  if (villageEl) villageEl.value = "";
  if (soiEl)     soiEl.value     = "";
  document.querySelectorAll(".vaccine-container input[type=checkbox]").forEach(cb => cb.checked = false);
  document.querySelectorAll(".vaccine-container .thai-datepicker").forEach(el => {
    el.value = ""; el.style.display = "none"; el._flatpickr?.clear();
  });
}

function saveChild(data) { return db.ref("children").push(data); }

function addChildFull() {
  const c        = getFormData();
  const vaccines = getVaccines();
  if (!validateChild(c)) return;
  const data    = { ...c, vaccines, updatedAt: new Date().toLocaleString("th-TH") };
  const newRef  = db.ref("children").push();
  const childId = newRef.key;
  newRef.set(data).then(() => {
    return db.ref("symptoms/" + childId).set({
      name: c.name || "", hn: c.hn || "", phone: c.phone || "", tambon: c.tambon || "",
      vaccines, symptom: "ยังไม่ระบุ", level: "ปกติ",
      status: "รอติดตาม", priority: 99, time: Date.now()
    });
  }).then(() => {
    alert("บันทึกแล้ว"); resetForm(); loadFollow(); loadvaccineChart();
    if (confirm("ไปหน้าติดตามอาการไหม?")) window.location.href = "symptoms.html";
  }).catch(err => { console.error("addChildFull:", err); alert("เกิดข้อผิดพลาด:\n" + err.message); });
}

function buildVillageDropdown(tambon, selected, id) {
  const data = tambon === "kolok" ? kolokCommunity : (villageData[tambon] || {});
  return `
  <select id="village_${id}" class="form-select" style="min-width:130px" onchange="autoSave('${id}','village',this.value)">
    <option value="">-- เลือกหมู่ --</option>
    ${Object.keys(data).map(v => `
      <option value="${v}" ${v == selected ? "selected" : ""}>
        ${tambon === "kolok" ? data[v].name : `หมู่ ${v} - ${data[v].name}`}
      </option>`).join("")}
  </select>`;
}

// =========================
// ลบ
// =========================
function deleteChild(id) {
  if (confirm("ลบข้อมูลนี้?")) {
    db.ref("children/" + id).remove()
      .then(() => { loadFollow(); loadvaccineChart(); })
      .catch(err => console.error("deleteChild:", err));
  }
}

// =========================
// logout
// =========================
function logout() {
  db.ref("loginLogs").push({
    name: localStorage.getItem("name"), role: localStorage.getItem("role"),
    action: "ออกจากระบบ", date: new Date().toLocaleDateString("th-TH"),
    logoutTime: new Date().toLocaleTimeString("th-TH")
  }).then(() => { localStorage.clear(); location.href = "login.html"; });
}

// =========================
// นำเข้า Excel (เดิม)
// =========================
const vaccineMap = {
  "041":"BCG","D21":"DTP1","D22":"DTP2","D23":"DTP3","D24":"DTP4","D25":"DTP5",
  "IP1":"IPV1","IP2":"IPV2","R21":"OPV1","R22":"OPV2","R23":"OPV3","R24":"OPV4","R25":"OPV5",
  "081":"MMR1","082":"MMR2","061":"JE1","062":"JE2"
};

function convertHDCtoVaccines(text) {
  let vaccines = {};
  if (!text) return vaccines;
  text = text.replace(/<br>/g, '');
  text.split("},").forEach(p => {
    try {
      if (!p.endsWith("}")) p += "}";
      const obj  = JSON.parse(p);
      const name = vaccineMap[obj.VACCINTYPE];
      if (name) vaccines[name] = obj.DATE_SERV;
    } catch (e) {}
  });
  return vaccines;
}

function getTambonByHospital(code) {
  const map = {
    "10170":"puyoh","10168":"pasemas","10658":"pasemas",
    "10169":"munoh","77729":"kolok","77728":"kolok"
  };
  return map[String(code)] || "";
}

async function importExcel() {
  const file = document.getElementById("excelFile")?.files[0];
  if (!file) { alert("กรุณาเลือกไฟล์"); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const rows     = XLSX.utils.sheet_to_json(sheet);
      const snap     = await db.ref("children").once("value");
      const oldData  = snap.val() || {};
      const hnMap    = {};
      Object.entries(oldData).forEach(([key, c]) => {
        const hn  = String(c.hn       || "").trim();
        const hos = String(c.hospital || "").trim();
        if (hn && hos) hnMap[hn + "_" + hos] = key;
      });
      let updates = {}, addCount = 0, updateCount = 0;
      rows.forEach(r => {
        const hn  = cleanValue(r.pid);
        const hos = cleanValue(r.hoscode);
        if (!hn) return;
        const uniqueKey = hn + "_" + hos;
        let id = hnMap[uniqueKey];
        if (id) { updateCount++; } else { id = db.ref().child("children").push().key; addCount++; }
        const child = {
          hn, cid: cleanValue(r.cid),
          name: (cleanValue(r.name) + " " + cleanValue(r.lname)).trim(),
          birth: cleanValue(r.birth), hospital: cleanValue(r.hoscode),
          tambon: getTambonByHospital(r.hoscode), house: cleanValue(r.addr),
          vaccines: {}, updatedAt: new Date().toLocaleString("th-TH")
        };
        const vaccineFields = {
          BCG:"bcg_date",HBV1:"hbv1_date",HBV2:"hbv2_date",
          DTP1:"dtp1_date",DTP2:"dtp2_date",DTP3:"dtp3_date",
          IPV1:"ipv1_date",IPV2:"ipv2_date",
          OPV3:"opv3_date",OPV4:"opv4_date",OPV5:"opv5_date",
          Rota1:"rota1_date",Rota2:"rota2_date",Rota3:"rota3_date",
          MMR1:"mmr1_date",MMR2:"mmr2_date",JE1:"je1_date",JE2:"je2_date",
          DTP4:"dtp4_date",DTP5:"dtp5_date"
        };
        Object.entries(vaccineFields).forEach(([name, field]) => {
          const value = cleanValue(r[field]);
          if (value) child.vaccines[name] = value;
        });
        if (hnMap[uniqueKey]) {
          const oldChild = oldData[id] || {};
          child.name     = oldChild.name     || child.name;
          child.birth    = oldChild.birth    || child.birth;
          child.cid      = oldChild.cid      || child.cid;
          child.hospital = oldChild.hospital || child.hospital;
          child.tambon   = oldChild.tambon   || child.tambon;
          child.house    = oldChild.house    || child.house;
          child.vaccines = { ...(oldChild.vaccines || {}), ...(child.vaccines || {}) };
        }
        updates[id] = child;
      });
      await db.ref("children").update(updates);
      alert(`เพิ่มใหม่ ${addCount} รายการ\nอัปเดต ${updateCount} รายการ`);
      loadFollow(); loadvaccineChart();
    } catch (err) {
      console.error("importExcel:", err);
      alert("นำเข้าไม่สำเร็จ");
    }
  };
  reader.readAsBinaryString(file);
}

function cleanValue(v) {
  if (v === null || v === undefined) return "";
  v = String(v).trim();
  if (["<NA>","NaN","null","undefined"].includes(v)) return "";
  return v;
}

function formatVillage(tambon, village) {
  if (!village) return "-";
  if (!isNaN(village)) return "หมู่ " + parseInt(village);
  return village;
}

function updateVillage(id, value) {
  db.ref("children/" + id).update({ village: value.replace("หมู่ ",""), updatedAt: new Date().toLocaleString("th-TH") });
}

function reloadRealtime() { if (childRef) childRef.off(); loadFollow(); }

function changeTambon(el) {
  const tr = el.closest("tr");
  if (!tr) return;
  const id = tr.getAttribute("data-id");
  autoSave(id, "tambon",  el.value);
  autoSave(id, "village", "");
  loadFollow();
}

function autoSaveVillage(id, value) {
  db.ref("children/" + id).update({ village: value, updatedAt: new Date().toLocaleString("th-TH") });
}

// =========================
// กราฟวัคซีนรายตำบล
// =========================
function loadvaccineChart() {
  const vaccineFilter = document.getElementById("vaccineFilter")?.value || "all";
  const tambonFilter  = document.getElementById("tambonFilter")?.value  || "all";
  selectedVaccine = vaccineFilter;

  db.ref("children").once("value").then(snapshot => {
    const data = snapshot.val() || {};
    if (!Object.keys(data).length) return;

    const allTambons = ["munoh","puyoh","pasemas","kolok"];
    const tambonName = { munoh:"มูโนะ",puyoh:"ปูโยะ",pasemas:"ปาเสมัส",kolok:"สุไหงโก-ลก" };
    const tambons    = tambonFilter === "all" ? allTambons : [tambonFilter];
    const chartEl    = document.getElementById("vaccineChart");
    if (!chartEl) return;
    if (window.vaccineChart && typeof window.vaccineChart.destroy === "function") window.vaccineChart.destroy();

    const chartCtx  = chartEl.getContext("2d");
    const gradGreen = chartCtx.createLinearGradient(0,0,0,400);
    gradGreen.addColorStop(0,"rgba(16,185,129,0.95)");
    gradGreen.addColorStop(1,"rgba(6,182,212,0.75)");
    const gradRed   = chartCtx.createLinearGradient(0,0,0,400);
    gradRed.addColorStop(0,"rgba(239,68,68,0.95)");
    gradRed.addColorStop(1,"rgba(251,146,60,0.75)");

    let labels, doneData = [], notdoneData = [], eligibleData = [];

    if (vaccineFilter !== "all") {
      const minAge = vaccineAgeSchedule[vaccineFilter] ?? 0;
      labels = tambons.map(t => tambonName[t] || t);
      tambons.forEach(t => {
        let done = 0, eligible = 0;
        for (const id in data) {
          if (data[id].tambon !== t) continue;
          const age = getAgeMonths(data[id].birth);
          if (age < minAge) continue;
          eligible++;
          if (data[id].vaccines?.[vaccineFilter]) done++;
        }
        doneData.push(done); eligibleData.push(eligible); notdoneData.push(eligible - done);
      });
    } else {
      labels = vaccineList.map(v => vaccineLabel[v] || v);
      vaccineList.forEach(v => {
        const minAge = vaccineAgeSchedule[v] ?? 0;
        let done = 0, eligible = 0;
        for (const id in data) {
          if (tambonFilter !== "all" && data[id].tambon !== tambonFilter) continue;
          const age = getAgeMonths(data[id].birth);
          if (age < minAge) continue;
          eligible++;
          if (data[id].vaccines?.[v]) done++;
        }
        doneData.push(done); eligibleData.push(eligible); notdoneData.push(eligible - done);
      });
    }

    const barThick = vaccineFilter !== "all" ? 32 : 14;
    const topLabelPlugin = {
      id: "topLabel",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          chart.getDatasetMeta(i).data.forEach((bar, j) => {
            const val = dataset.data[j];
            if (!val) return;
            const tot  = eligibleData[j] || 1;
            const pct  = tot > 0 ? ((val / tot) * 100).toFixed(0) : 0;
            const text = vaccineFilter !== "all" ? `${val} (${pct}%)` : `${val}`;
            ctx.save();
            ctx.font = `bold ${vaccineFilter !== "all" ? 11 : 10}px 'IBM Plex Sans Thai',sans-serif`;
            const tw = ctx.measureText(text).width;
            const ph = 17, pw = tw + 12, px = bar.x - pw/2, py = bar.y - ph - 5;
            ctx.fillStyle = i === 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
            ctx.beginPath();
            const r = 6;
            ctx.moveTo(px+r,py); ctx.lineTo(px+pw-r,py);
            ctx.quadraticCurveTo(px+pw,py,px+pw,py+r);
            ctx.lineTo(px+pw,py+ph-r);
            ctx.quadraticCurveTo(px+pw,py+ph,px+pw-r,py+ph);
            ctx.lineTo(px+r,py+ph);
            ctx.quadraticCurveTo(px,py+ph,px,py+ph-r);
            ctx.lineTo(px,py+r);
            ctx.quadraticCurveTo(px,py,px+r,py);
            ctx.closePath(); ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.fillStyle   = i === 0 ? "#065f46" : "#7f1d1d";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(text, bar.x, py + ph/2);
            ctx.restore();
          });
        });
      }
    };

    window.vaccineChart = new Chart(chartEl, {
      type: "bar",
      data: { labels, datasets: [
        { label:"ฉีดแล้ว",  data:doneData,    backgroundColor:gradGreen, borderWidth:1.5, borderRadius:0, borderSkipped:false, barThickness:barThick },
        { label:"ตกหล่น",   data:notdoneData, backgroundColor:gradRed,   borderWidth:1.5, borderRadius:0, borderSkipped:false, barThickness:barThick }
      ]},
      options: {
        responsive:true, maintainAspectRatio:false,
        animation:{ duration:700, easing:"easeOutQuart" },
        plugins: {
          legend:{ position:"bottom", labels:{ boxWidth:14,padding:20,font:{size:13},color:"#374151" } },
          tooltip:{
            backgroundColor:"rgba(17,24,39,0.92)", titleFont:{size:13,weight:"bold"},
            bodyFont:{size:12}, padding:12, cornerRadius:10,
            callbacks: {
              label: (ctx) => {
                const tot = eligibleData[ctx.dataIndex] || 1;
                const pct = tot > 0 ? ((ctx.raw/tot)*100).toFixed(1) : 0;
                return ` ${ctx.dataset.label}: ${ctx.raw} คน (${pct}% ของผู้มีสิทธิ์)`;
              },
              afterLabel: (ctx) => `ผู้มีสิทธิ์ (ถึงเกณฑ์อายุ): ${eligibleData[ctx.dataIndex]} คน`
            }
          }
        },
        scales: {
          x:{ grid:{display:false}, border:{display:false},
              ticks:{font:{size:vaccineFilter!=="all"?13:11},color:"#6b7280",maxRotation:vaccineFilter!=="all"?0:45} },
          y:{ beginAtZero:true, grid:{color:"rgba(0,0,0,0.05)",lineWidth:1}, border:{display:false},
              ticks:{precision:0,font:{size:11},color:"#9ca3af"},
              title:{display:true,text:"จำนวนคน",color:"#6b7280",font:{size:12}} }
        }
      },
      plugins: [topLabelPlugin]
    });

    const el = document.getElementById("vaccineDescription");
    if (!el) return;
    const totalDone     = doneData.reduce((a,b)=>a+b,0);
    const totalNotdone  = notdoneData.reduce((a,b)=>a+b,0);
    const totalEligible = eligibleData.reduce((a,b)=>a+b,0) || 1;
    const tambonText    = tambonFilter !== "all" ? tambonName[tambonFilter] : "ทุกตำบล";
    if (vaccineFilter !== "all") {
      el.innerHTML = `<b>${vaccineLabel[vaccineFilter]||vaccineFilter}</b> | ${tambonText}<br>
        ฉีดแล้ว: <b>${totalDone} คน (${((totalDone/totalEligible)*100).toFixed(1)}%)</b> &nbsp;
        ตกหล่น: ${totalNotdone} คน<br>
        <small style="color:gray">ฐาน: เด็กที่อายุถึงเกณฑ์ฉีด (${totalEligible} คน)</small>`;
    } else {
      el.innerHTML = `<b>เปรียบเทียบวัคซีนทั้งหมด</b> | ${tambonText}<br>
        รวมฉีดแล้ว: <b>${totalDone} ครั้ง</b> &nbsp; รวมตกหล่น: ${totalNotdone} ครั้ง<br>
        <small style="color:gray">แต่ละวัคซีนใช้ฐานเทียบเฉพาะเด็กที่ถึงเกณฑ์อายุ</small>`;
    }
  }).catch(err => console.error("loadvaccineChart:", err));
}

// =========================
// Sidebar
// =========================
function toggleSidebar(btn) {
  if (btn) btn.classList.toggle("active");
  document.getElementById("sidebar")?.classList.toggle("show");
  document.getElementById("backdrop")?.classList.toggle("show");
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("show");
  document.getElementById("backdrop")?.classList.remove("show");
  document.querySelector(".menu-btn")?.classList.remove("active");
}

// =========================
// แผนที่
// =========================
function openMap(tambon, house, village) {
  const tambonTH = getTambonName(tambon);
  const address  = `บ้านเลขที่ ${house} หมู่ ${village} ตำบล ${tambonTH} อำเภอสุไหงโก-ลก จังหวัดนราธิวาส`;
  window.open("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address), "_blank");
}

function getTambonName(t) {
  const map = { all:"ทั้งหมด",kolok:"สุไหงโก-ลก",munoh:"มูโนะ",puyoh:"ปูโยะ",pasemas:"ปาเสมัส" };
  return map[t] || t || "-";
}

// =========================
// คำนวณอายุ
// =========================
function calculateAge(birth) {
  if (!birth) return "-";
  const [d,m,y] = birth.split("/");
  const birthDate = new Date(y-543, m-1, d);
  const today = new Date();
  let years  = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth()    - birthDate.getMonth();
  if (months < 0) { years--; months += 12; }
  return years > 0 ? `${years} ปี ${months} เดือน` : `${months} เดือน`;
}

function parseThaiDate(birth) {
  if (!birth) return null;
  if (typeof birth === "number") return new Date((birth-25569)*86400*1000);
  birth = String(birth);
  if (birth.includes("-")) return new Date(birth);
  if (birth.includes("/")) {
    let [d,m,y] = birth.split("/").map(Number);
    if (y > 2500) y -= 543;
    return new Date(y, m-1, d);
  }
  return null;
}

function getAgeMonths(birth) {
  const birthDate = parseThaiDate(birth);
  if (!birthDate || isNaN(birthDate)) return 0;
  const today = new Date();
  let months = (today.getFullYear()-birthDate.getFullYear())*12 + (today.getMonth()-birthDate.getMonth());
  if (today.getDate() < birthDate.getDate()) months--;
  return Math.max(0, months);
}

function getAgeBadge(birth) {
  if (!birth) return `<span class="badge bg-secondary">-</span>`;
  const months = getAgeMonths(birth);
  const years  = Math.floor(months/12);
  const rem    = months % 12;
  const text   = years > 0 ? `${years} ปี ${rem} ด.` : `${months} ด.`;
  let color = "bg-success";
  if      (months <= 6)  color = "bg-info";
  else if (months <= 12) color = "bg-primary";
  else if (months <= 24) color = "bg-warning";
  else                   color = "bg-secondary";
  return `<span class="badge ${color}">${text}</span>`;
}

// =========================
// ผู้ดูแลรายตำบล
// =========================
function openCareByTambon() {
  const tambon = document.getElementById("tambonFilter")?.value || "all";

  function renderCareData(tambonKey, data) {
    let html = "";
    const villages = Object.keys(data).sort((a,b) => Number(a)-Number(b));
    villages.forEach(v => {
      const group = data[v];
      if (!group.care) return;
      html += `
        <div style="border:1px solid #eee;border-radius:14px;padding:12px;margin-bottom:12px;background:#fafafa;">
          <div style="font-weight:600;margin-bottom:6px;color:#374151;">
            <i class="fa-solid fa-house fa-xs" style="color:#6b7280;margin-right:6px"></i>หมู่ ${v}
          </div>
          ${group.care.map(c => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
            <div>
              <i class="fa-solid fa-user fa-xs" style="color:#6b7280;margin-right:4px"></i>${c.name}
              <br><small style="color:#6b7280;">${c.role||"-"}</small>
            </div>
            <a href="tel:${c.tel}" style="color:#16a34a;text-decoration:none;">
              <i class="fa-solid fa-phone fa-xs"></i> ${c.tel}
            </a>
          </div>`).join("")}
        </div>`;
    });
    return html;
  }

  const TAMBON_ORDER = ["kolok","munoh","puyoh","pasemas"];

  if (tambon === "all") {
    db.ref("villageCare").once("value", snap => {
      const allData = snap.val() || {};
      let html = "";
      TAMBON_ORDER.forEach(t => {
        if (!allData[t]) return;
        const section = renderCareData(t, allData[t]);
        if (!section) return;
        html += `
          <div style="margin-bottom:20px;">
            <div style="font-size:15px;font-weight:700;color:#1d4ed8;margin-bottom:8px;
                        padding-bottom:6px;border-bottom:2px solid #dbeafe;">
              <i class="fa-solid fa-location-dot fa-xs" style="margin-right:6px"></i>${getTambonName(t)}
            </div>
            ${section}
          </div>`;
      });
      if (!html) html = "<p style='color:#9ca3af;text-align:center;padding:20px'>ไม่มีข้อมูลผู้ดูแล</p>";
      document.getElementById("careTitle").innerText = "ผู้ดูแล - ทั้งหมด";
      document.getElementById("careBody").innerHTML  = html;
      new bootstrap.Modal(document.getElementById("careModal")).show();
    });
  } else {
    db.ref("villageCare/" + tambon).once("value", snap => {
      const data = snap.val() || {};
      const html = renderCareData(tambon, data) ||
        "<p style='color:#9ca3af;text-align:center;padding:20px'>ไม่มีข้อมูลผู้ดูแลในตำบลนี้</p>";
      document.getElementById("careTitle").innerText = "ผู้ดูแล - " + getTambonName(tambon);
      document.getElementById("careBody").innerHTML  = html;
      new bootstrap.Modal(document.getElementById("careModal")).show();
    });
  }
}

// =========================
// Seed ผู้ดูแล
// =========================
function seedVillageCareIfEmpty() {
  db.ref("villageCare").once("value", snap => {
    if (snap.exists()) return;
    db.ref("villageCare").set({
      puyoh: {
        1:{care:[{name:"นายเฉลิมพล อำพันธ์",tel:"0807047038",role:"ผู้ใหญ่บ้าน"}]},
        2:{care:[{name:"นายอาหามะ อูเซ็ง",tel:"0892947402",role:"กำนัน / ผู้ใหญ่บ้าน"}]},
        3:{care:[{name:"นายไซมี มะ",tel:"0810842978",role:"ผู้ใหญ่บ้าน"}]},
        4:{care:[{name:"นายนรวีร์ เจ๊ะเมาะ",tel:"0808466067",role:"ผู้ใหญ่บ้าน"}]},
        5:{care:[{name:"นายสมนึก แดงดี",tel:"0872951817",role:"ผู้ใหญ่บ้าน"}]},
        6:{care:[{name:"นายมะยูนุ มะเย็ง",tel:"0849971802",role:"ผู้ใหญ่บ้าน"}]}
      },
      munoh: {
        1:{care:[{name:"นายสาลีมี สาและ",tel:"0894620868",role:"ผู้ใหญ่บ้าน"}]},
        2:{care:[{name:"นายนาทวี ตันเหมนายู",tel:"0894646467",role:"ผู้ใหญ่บ้าน"}]},
        3:{care:[{name:"นายมุสตอปา อาบะ",tel:"0850770975",role:"ผู้ใหญ่บ้าน"}]},
        4:{care:[{name:"ร.ต.ประเสริฐ อาแว",tel:"0873999709",role:"กำนัน / ผู้ใหญ่บ้าน"}]},
        5:{care:[{name:"นายอามาซะ สามะ",tel:"0806303427",role:"ผู้ใหญ่บ้าน"}]}
      },
      pasemas: {
        1:{care:[{name:"นายฮารีมคาน โอระสะมันนี",tel:"0817677605",role:"ผู้ใหญ่บ้าน"}]},
        2:{care:[{name:"นายนาซูฮา หะยีอาแว",tel:"0850787676",role:"ผู้ใหญ่บ้าน"}]},
        3:{care:[{name:"นายณรงค์ อาแวสือแม",tel:"0629988149",role:"ผู้ใหญ่บ้าน"}]},
        4:{care:[{name:"นายมาฮาโซ มือเยาะ",tel:"0801382240",role:"ผู้ใหญ่บ้าน"}]},
        5:{care:[{name:"นายมะรอดี บินสะมะแอ",tel:"0896594425",role:"ผู้ใหญ่บ้าน"}]},
        6:{care:[{name:"นายปฏิวัติ เด่นอร่ามคาน",tel:"0813686863",role:"กำนัน / ผู้ใหญ่บ้าน"}]},
        7:{care:[{name:"นายอัสมี เจ๊ะอาแว",tel:"0824159376",role:"ผู้ใหญ่บ้าน"}]},
        8:{care:[{name:"นายรุสวา ดอเลาะ",tel:"0649500655",role:"ผู้ใหญ่บ้าน"}]}
      },
      kolok:{ community:{ care:[
        {name:"น.ส.สุมิตร อูมา",tel:"0993633100",role:"ผู้นำชุมชน"},
        {name:"น.ส.สะปีน๊ะ มะแซ",tel:"0869695313",role:"ผู้นำชุมชน"},
        {name:"นางละมัย การุโณ",tel:"0827038733",role:"ผู้นำชุมชน"},
        {name:"นางวิลาวัลย์ คชกาล",tel:"0831682610",role:"ผู้นำชุมชน"},
        {name:"นายธงชัย บือราเฮง",tel:"0634853736",role:"ผู้นำชุมชน"},
        {name:"นายวราวุธ มาหามะ",tel:"0634245389",role:"ผู้นำชุมชน"}
      ]}}
    });
  });
}

// =========================
// formatDate / formatDateInput
// =========================
function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", { year:"numeric",month:"short",day:"numeric" });
}

function formatDateInput(dateStr) {
  if (!dateStr) return "";
  if (typeof dateStr === "number") return new Date((dateStr-25569)*86400*1000).toISOString().split("T")[0];
  dateStr = String(dateStr);
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    let y = parseInt(parts[2]);
    if (y >= 2500) y -= 543;
    return `${y}-${String(parts[1]).padStart(2,"0")}-${String(parts[0]).padStart(2,"0")}`;
  }
  return dateStr;
}

// =========================
// Infinite scroll
// =========================
function loadMore() {
  if (!lastKey || isLoading) return;
  isLoading = true;
  db.ref("children").orderByKey().startAfter(lastKey).limitToFirst(PAGE_SIZE).once("value", snap => {
    const data = snap.val();
    if (!data) { isLoading = false; return; }
    // append to existing data — re-render by calling loadFollow
    lastKey   = Object.keys(data).pop();
    isLoading = false;
    loadFollow();
  });
}

window.addEventListener("scroll", () => {
  if (!isLoading && window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) loadMore();
});

// =========================
// Profile upload
// =========================
function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById("profileImg");
    if (img) img.src = ev.target.result;
    localStorage.setItem("profileImg", ev.target.result);
  };
  reader.readAsDataURL(file);
}

function setStatusFilter(mode) {
  statusFilter = mode;
  document.querySelectorAll("#btn-status-all,#btn-status-notdone,#btn-status-done")
    .forEach(b => b.classList.remove("btn-primary"));
  const activeBtn = document.getElementById("btn-status-" + mode);
  if (activeBtn) activeBtn.classList.add("btn-primary");
  currentPage = 1;
  loadFollow();
  if (typeof updateIndexKPI === "function") updateIndexKPI();
}

// XSS guard
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// =========================
// Init
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // add-child page: ตำบล → หมู่
  const tambonEl = document.getElementById("tambon");
  if (tambonEl) {
    tambonEl.addEventListener("change", function () {
      const villageBox = document.getElementById("villageBox");
      const soiBox     = document.getElementById("soiBox");
      if (villageBox) villageBox.innerHTML = buildVillageDropdown(this.value, "", "");
      if (soiBox)     soiBox.style.display = this.value === "kolok" ? "block" : "none";
    });
  }

  // vaccineFilter dropdown
  const vaccineSelect = document.getElementById("vaccineFilter");
  if (vaccineSelect) {
    vaccineSelect.innerHTML = `<option value="all">ทุกวัคซีน</option>`;
    vaccineList.forEach(v => {
      const op = document.createElement("option");
      op.value = v; op.textContent = vaccineLabel[v] || v;
      vaccineSelect.appendChild(op);
    });
    vaccineSelect.addEventListener("change", () => {
      selectedVaccine = vaccineSelect.value;
      loadvaccineChart(); loadFollow(); updateIndexKPI();
    });
  }

  // tambonFilter
  const tambonSel = document.getElementById("tambonFilter");
  if (tambonSel) {
    tambonSel.addEventListener("change", () => {
      selectedBarKey = null;
      const badge = document.getElementById("barFilterBadge");
      if (badge) badge.remove();
      currentPage = 1;
      updateHospitalFilter(); loadvaccineChart(); loadFollow(); updateIndexKPI();
    });
  }

  // hospitalFilter
  const hospitalSel = document.getElementById("hospitalFilter");
  if (hospitalSel) {
    hospitalSel.addEventListener("change", () => { currentPage = 1; loadFollow(); updateIndexKPI(); loadvaccineChart(); });
  }

  // ageFilter
  const ageSel = document.getElementById("ageFilter");
  if (ageSel) {
    ageSel.addEventListener("change", () => { currentPage = 1; loadFollow(); updateIndexKPI(); });
  }

  // typeAreaFilter
  const typeAreaSel = document.getElementById("typeAreaFilter");
  if (typeAreaSel) {
    typeAreaSel.addEventListener("change", () => { currentPage = 1; loadFollow(); updateIndexKPI(); });
  }

  seedVillageCareIfEmpty();

  // โหลดข้อมูล
  if (document.getElementById("followTable") || document.getElementById("mobileList")) {
    loadFollow();
    loadvaccineChart();
    updateIndexKPI();
  }
});