// ── AttendTrack DB ──
// IndexedDB-backed persistent storage with localStorage fallback

const DB_KEY = 'attendtrack_data';

const DEFAULT_DATA = {
  employees: [
    { id:'EMP-001', name:'Ahmed Khalil',    dept:'Cleaning',     site:'Mall — Level 2',       role:'staff',      pin:'1234', initials:'AK' },
    { id:'EMP-002', name:'Sara Mohammed',   dept:'Hospitality',  site:'Mall — Level 2',       role:'staff',      pin:'1234', initials:'SM' },
    { id:'EMP-003', name:'Omar Farouq',     dept:'Maintenance',  site:'Mall — Level 2',       role:'staff',      pin:'1234', initials:'OF' },
    { id:'EMP-004', name:'Laila Hassan',    dept:'Disinfecting', site:'Mall — Level 2',       role:'staff',      pin:'1234', initials:'LH' },
    { id:'EMP-005', name:'Rania Nabil',     dept:'Pest control', site:'Mall — Level 2',       role:'staff',      pin:'1234', initials:'RN' },
    { id:'EMP-006', name:'Khalid Ibrahim',  dept:'Cleaning',     site:'Hotel Lobby',          role:'staff',      pin:'1234', initials:'KI' },
    { id:'EMP-007', name:'Fatima Al-Zahra', dept:'Hospitality',  site:'Hotel Lobby',          role:'staff',      pin:'1234', initials:'FZ' },
    { id:'EMP-008', name:'Yusuf Hassan',    dept:'Maintenance',  site:'Office Tower B',       role:'staff',      pin:'1234', initials:'YH' },
    { id:'SUP-001', name:'Nour Al-Rashid',  dept:'Cleaning',     site:'Mall — Level 2',       role:'supervisor', pin:'0000', initials:'NR' },
    { id:'SUP-002', name:'Tariq Mansour',   dept:'Hospitality',  site:'Hotel Lobby',          role:'supervisor', pin:'0000', initials:'TM' },
    { id:'ADM-001', name:'Admin',           dept:'Management',   site:'All sites',            role:'admin',      pin:'9999', initials:'AD' },
  ],
  records: [],
  overrides: [],
  sites: [
    { id:'site-1', name:'Mall — Level 2',     radius:80,  auto:true,  coords:{lat:25.2854,lng:51.5310} },
    { id:'site-2', name:'Hotel Lobby',         radius:60,  auto:true,  coords:{lat:25.2948,lng:51.5190} },
    { id:'site-3', name:'Office Tower B',      radius:50,  auto:false, coords:{lat:25.2770,lng:51.5230} },
    { id:'site-4', name:'Residential Complex', radius:100, auto:true,  coords:{lat:25.3000,lng:51.5400} },
  ],
  nextId: 100
};

let _db = null;

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      _db = JSON.parse(raw);
      // migrate: ensure all fields exist
      if (!_db.sites) _db.sites = DEFAULT_DATA.sites;
      if (!_db.nextId) _db.nextId = 100;
    } else {
      _db = JSON.parse(JSON.stringify(DEFAULT_DATA));
      saveDB();
    }
  } catch(e) {
    _db = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  return _db;
}

function saveDB() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(_db)); } catch(e) {}
}

function getDB() { return _db || loadDB(); }

// ── Employee helpers ──
function getEmployee(id) { return getDB().employees.find(e => e.id === id); }
function getEmployeeByPin(pin) { return getDB().employees.find(e => e.pin === pin); }
function getAllStaff() { return getDB().employees.filter(e => e.role === 'staff'); }
function getSiteStaff(site) { return getDB().employees.filter(e => e.site === site && e.role === 'staff'); }
function getSupervisors() { return getDB().employees.filter(e => e.role === 'supervisor'); }

function addEmployee(data) {
  const db = getDB();
  db.nextId++;
  const prefix = data.role === 'supervisor' ? 'SUP' : data.role === 'admin' ? 'ADM' : 'EMP';
  const id = prefix + '-' + String(db.nextId).padStart(3, '0');
  const initials = data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const emp = { ...data, id, initials, pin: data.pin || '1234' };
  db.employees.push(emp);
  saveDB();
  return emp;
}

function removeEmployee(id) {
  const db = getDB();
  db.employees = db.employees.filter(e => e.id !== id);
  saveDB();
}

function updateEmployeePin(id, newPin) {
  const emp = getEmployee(id);
  if (emp) { emp.pin = newPin; saveDB(); }
}

// ── Record helpers ──
function getActiveRecord(empId) {
  return getDB().records.find(r => r.empId === empId && !r.clockOut);
}

function getTodayRecords(empId) {
  const today = new Date().toDateString();
  return getDB().records.filter(r => r.empId === empId && new Date(r.clockIn).toDateString() === today);
}

function getAllTodayRecords(site) {
  const today = new Date().toDateString();
  const recs = getDB().records.filter(r => new Date(r.clockIn).toDateString() === today);
  return site ? recs.filter(r => r.site === site) : recs;
}

function getActiveOnSite(site) {
  const today = new Date().toDateString();
  return getDB().records.filter(r => r.site === site && !r.clockOut && new Date(r.clockIn).toDateString() === today);
}

function getPendingManual(site) {
  return getDB().records.filter(r => r.manual && !r.approved && (!site || r.site === site));
}

function clockIn(empId, note = '', manual = false) {
  const db = getDB();
  const emp = getEmployee(empId);
  if (!emp) return null;
  // close any open record first
  const open = getActiveRecord(empId);
  if (open) return null;
  const rec = {
    id: 'R' + Date.now(),
    empId,
    empName: emp.name,
    site: emp.site,
    dept: emp.dept,
    clockIn: new Date().toISOString(),
    clockOut: null,
    note,
    noteOut: '',
    manual,
    approved: !manual,
    absent: false,
    overrideBy: null
  };
  db.records.push(rec);
  saveDB();
  return rec;
}

function clockInAt(empId, timeStr, note = '', manual = true, overrideBy = null) {
  const db = getDB();
  const emp = getEmployee(empId);
  if (!emp) return null;
  const existing = getActiveRecord(empId);
  if (existing) return null;
  const d = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  const rec = {
    id: 'R' + Date.now(),
    empId,
    empName: emp.name,
    site: emp.site,
    dept: emp.dept,
    clockIn: d.toISOString(),
    clockOut: null,
    note,
    noteOut: '',
    manual: true,
    approved: false,
    absent: false,
    overrideBy
  };
  db.records.push(rec);
  saveDB();
  return rec;
}

function clockOut(empId, note = '') {
  const rec = getActiveRecord(empId);
  if (!rec) return null;
  rec.clockOut = new Date().toISOString();
  rec.noteOut = note;
  saveDB();
  return rec;
}

function approveRecord(recId) {
  const rec = getDB().records.find(r => r.id === recId);
  if (rec) { rec.approved = true; saveDB(); }
}

function rejectRecord(recId) {
  const db = getDB();
  db.records = db.records.filter(r => r.id !== recId);
  saveDB();
}

function markAbsent(empId, by) {
  const db = getDB();
  const emp = getEmployee(empId);
  if (!emp) return;
  const now = new Date();
  db.records.push({
    id: 'R' + Date.now(),
    empId,
    empName: emp.name,
    site: emp.site,
    dept: emp.dept,
    clockIn: now.toISOString(),
    clockOut: now.toISOString(),
    note: 'Marked absent by ' + (by || 'supervisor'),
    manual: true,
    approved: true,
    absent: true,
    overrideBy: by
  });
  saveDB();
}

function editRecord(recId, updates) {
  const rec = getDB().records.find(r => r.id === recId);
  if (rec) { Object.assign(rec, updates); saveDB(); }
}

function deleteRecord(recId) {
  const db = getDB();
  db.records = db.records.filter(r => r.id !== recId);
  saveDB();
}

// ── Reporting helpers ──
function getMonthRecords(empId, year, month) {
  return getDB().records.filter(r => {
    const d = new Date(r.clockIn);
    return r.empId === empId && d.getFullYear() === year && d.getMonth() === month;
  });
}

function calcHours(rec) {
  if (!rec.clockOut || rec.absent) return 0;
  return Math.floor((new Date(rec.clockOut) - new Date(rec.clockIn)) / 60000);
}

function getTotalMinutes(records) {
  return records.filter(r => r.clockOut && !r.absent).reduce((a, r) => a + calcHours(r), 0);
}

function minsToHM(m) {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return h + 'h ' + (mn < 10 ? '0' : '') + mn + 'm';
}

function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toTimeString().slice(0, 5);
}

function fmtDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDateFull(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Sites ──
function getSites() { return getDB().sites; }
function getSite(name) { return getDB().sites.find(s => s.name === name); }

// ── Export to CSV ──
function exportAttendanceCSV(month, year) {
  const staff = getAllStaff();
  const rows = [['Employee ID', 'Name', 'Department', 'Site', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Type', 'Note']];
  staff.forEach(emp => {
    const recs = getMonthRecords(emp.id, year, month);
    recs.forEach(r => {
      rows.push([
        emp.id, emp.name, emp.dept, emp.site,
        fmtDate(r.clockIn), fmtTime(r.clockIn),
        r.clockOut ? fmtTime(r.clockOut) : '',
        r.absent ? 'ABSENT' : minsToHM(calcHours(r)),
        r.manual ? 'Manual' : 'Auto',
        r.note || ''
      ]);
    });
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendance_' + (month + 1) + '_' + year + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Reset (dev only) ──
function resetDB() {
  _db = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveDB();
}

// init on load
loadDB();
