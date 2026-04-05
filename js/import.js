// ── AttendTrack — Import & Sync Module ──

let _syncInterval = null;

// ── Tab switching ──
function importSwitchTab(tab) {
  ['api', 'file', 'status'].forEach(t => {
    const el = document.getElementById('import-tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.import-tab-btn').forEach((b, i) => {
    b.classList.toggle('on', ['api', 'file', 'status'][i] === tab);
  });
  if (tab === 'status') renderImportStatus();
}

// ── API CONFIG ──
function saveApiConfig() {
  const url = document.getElementById('api-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  const freq = parseInt(document.getElementById('api-freq').value);
  const conflict = document.getElementById('api-conflict').value;
  if (!url) { toast('Enter an API URL first'); return; }
  const db = getDB();
  db.syncConfig = { url, apiKey: key, freq, conflict };
  saveDB();
  testApiConnection(url, key);
  setupSyncSchedule(freq);
}

async function testApiConnection(url, key) {
  const el = document.getElementById('api-test-result');
  if (!el) return;
  el.innerHTML = '<div class="info-box warn">&#9203; Testing connection...</div>';
  updateSyncIndicator('amber', 'Testing...');
  await new Promise(r => setTimeout(r, 1000));
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = key.startsWith('Bearer ') ? key : 'Bearer ' + key;
    const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const emps = extractEmployeesFromResponse(data);
      el.innerHTML = '<div class="info-box success">&#10003; Connected! Found <strong>' + emps.length + '</strong> employees. Click "Sync now" to import.</div>';
      updateSyncIndicator('green', 'Connected');
      addSyncLog('&#10003; Connection test successful — ' + emps.length + ' employees found');
    } else {
      el.innerHTML = '<div class="info-box error">&#10007; API error ' + res.status + ': ' + res.statusText + '. Check the URL.</div>';
      updateSyncIndicator('gray', 'Error');
      addSyncLog('&#10007; Connection failed: HTTP ' + res.status);
    }
  } catch (e) {
    const isDemo = url.includes('localhost') || url.includes('example') || url.includes('your-') || url.includes('yourapp');
    if (isDemo) {
      el.innerHTML = '<div class="info-box warn">&#9888; Demo mode — cannot reach "' + url + '".<br>Enter your real deployed API URL, or <button class="btn-xs bx-teal" onclick="loadMockApiData()" style="margin-left:4px">load mock data to test</button></div>';
      updateSyncIndicator('amber', 'Demo mode');
    } else {
      el.innerHTML = '<div class="info-box error">&#10007; Could not reach server.<br>' + e.message + '</div>';
      updateSyncIndicator('gray', 'Unreachable');
      addSyncLog('&#10007; Connection error: ' + e.message);
    }
  }
}

async function syncNow() {
  const db = getDB();
  const cfg = db.syncConfig;
  if (!cfg || !cfg.url) { toast('Configure API URL first'); importSwitchTab('api'); return; }
  const btn = document.getElementById('sync-now-btn');
  if (btn) { btn.textContent = 'Syncing...'; btn.disabled = true; }
  addSyncLog('&#9203; Manual sync started...');
  updateSyncIndicator('amber', 'Syncing...');
  await new Promise(r => setTimeout(r, 800));
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = cfg.apiKey.startsWith('Bearer ') ? cfg.apiKey : 'Bearer ' + cfg.apiKey;
    const res = await fetch(cfg.url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const emps = extractEmployeesFromResponse(data);
      const result = mergeIncomingEmployees(emps, cfg.conflict);
      db.lastSync = new Date().toISOString();
      db.lastMethod = 'API sync';
      saveDB();
      addSyncLog('&#10003; Sync complete: ' + result.added + ' added, ' + result.updated + ' updated, ' + result.skipped + ' skipped');
      updateSyncIndicator('green', 'Connected');
      toast('&#10003; Sync complete — ' + result.added + ' added, ' + result.updated + ' updated');
      renderImportStatus();
    } else {
      addSyncLog('&#10007; Sync failed: HTTP ' + res.status);
      toast('Sync failed: ' + res.status);
      updateSyncIndicator('gray', 'Error');
    }
  } catch (e) {
    addSyncLog('&#10007; Sync error: ' + e.message);
    toast('Cannot reach API — check connection');
    updateSyncIndicator('gray', 'Unreachable');
  }
  if (btn) { btn.textContent = 'Sync now'; btn.disabled = false; }
}

function extractEmployeesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (data.employees && Array.isArray(data.employees)) return data.employees;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.results && Array.isArray(data.results)) return data.results;
  if (data.staff && Array.isArray(data.staff)) return data.staff;
  return [];
}

function getMappings() {
  return {
    name: document.getElementById('map-name')?.value || 'full_name',
    id:   document.getElementById('map-id')?.value   || 'employee_id',
    dept: document.getElementById('map-dept')?.value || 'department',
    site: document.getElementById('map-site')?.value || 'work_location',
    role: document.getElementById('map-role')?.value || 'role',
    pin:  document.getElementById('map-pin')?.value  || 'pin',
  };
}

function normaliseEmployee(raw) {
  const m = getMappings();
  const get = (...keys) => { for (const k of keys) { const v = raw[k] || raw[k.toLowerCase()] || raw[k.toUpperCase()]; if (v) return String(v).trim(); } return ''; };
  return {
    name: get(m.name, 'name', 'full_name', 'fullname', 'employee_name', 'staff_name'),
    id:   get(m.id,   'id',   'employee_id', 'emp_id', 'staff_id'),
    dept: get(m.dept, 'department', 'dept', 'division', 'team') || 'Cleaning',
    site: get(m.site, 'site', 'location', 'work_location', 'branch', 'workplace') || 'Mall — Level 2',
    role: (get(m.role, 'role', 'position', 'type') || 'staff').toLowerCase(),
    pin:  get(m.pin,  'pin', 'password', 'code', 'temp_pin') || '1234',
  };
}

function mergeIncomingEmployees(incoming, conflict) {
  const db = getDB();
  let added = 0, updated = 0, skipped = 0;
  incoming.forEach(raw => {
    const r = normaliseEmployee(raw);
    if (!r.name) { skipped++; return; }
    const initials = r.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const id = r.id || (r.role === 'supervisor' ? 'SUP' : 'EMP') + '-' + Date.now() + Math.random().toString(36).slice(2, 5);
    const exists = db.employees.find(e => e.id === id || e.name === r.name);
    if (exists) {
      if (conflict === 'main') { Object.assign(exists, { name: r.name, dept: r.dept, site: r.site, role: r.role, pin: r.pin, initials, source: 'api' }); updated++; }
      else if (conflict === 'keep') { skipped++; }
      else skipped++;
    } else {
      db.employees.push({ id, name: r.name, dept: r.dept, site: r.site, role: r.role, pin: r.pin, initials, source: 'api' });
      added++;
    }
  });
  saveDB();
  return { added, updated, skipped };
}

function loadMockApiData() {
  const mock = [
    { employee_id: 'EMP-020', full_name: 'Mariam Al-Sayed',   department: 'Cleaning',     work_location: 'Mall — Level 2',       role: 'staff',      pin: '4321' },
    { employee_id: 'EMP-021', full_name: 'Hassan Qasim',      department: 'Pest control', work_location: 'Hotel Lobby',          role: 'staff',      pin: '4321' },
    { employee_id: 'EMP-022', full_name: 'Aisha Mahmoud',     department: 'Hospitality',  work_location: 'Office Tower B',       role: 'staff',      pin: '4321' },
    { employee_id: 'EMP-023', full_name: 'Bilal Kareem',      department: 'Disinfecting', work_location: 'Residential Complex',  role: 'staff',      pin: '4321' },
    { employee_id: 'SUP-010', full_name: 'Tariq Mansour',     department: 'Maintenance',  work_location: 'Hotel Lobby',          role: 'supervisor', pin: '5678' },
  ];
  const result = mergeIncomingEmployees(mock, 'main');
  const db = getDB();
  db.lastSync = new Date().toISOString();
  db.lastMethod = 'Mock API data';
  if (!db.syncLog) db.syncLog = [];
  saveDB();
  addSyncLog('&#9670; Mock API data loaded: ' + result.added + ' added, ' + result.updated + ' updated');
  updateSyncIndicator('green', 'Mock connected');
  toast('&#10003; ' + result.added + ' employees imported from mock data');
  importSwitchTab('status');
  renderImportStatus();
}

function setupSyncSchedule(mins) {
  clearInterval(_syncInterval);
  if (mins > 0) {
    _syncInterval = setInterval(syncNow, mins * 60000);
    addSyncLog('&#9203; Auto-sync scheduled every ' + mins + ' minutes');
    toast('Auto-sync every ' + mins + ' min');
  } else {
    addSyncLog('Auto-sync disabled — manual only');
  }
}

// ── FILE IMPORT ──
let _parsedEmployees = [];

function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-drop-zone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
}

function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  addSyncLog('&#128196; File selected: ' + file.name + ' (' + ext.toUpperCase() + ')');
  if (ext === 'csv') readImportCSV(file);
  else if (ext === 'json') readImportJSON(file);
  else if (ext === 'xlsx') readImportXLSX(file);
  else { toast('Unsupported file. Use CSV, JSON or Excel.'); }
}

function readImportCSV(file) {
  const r = new FileReader();
  r.onload = e => {
    const lines = e.target.result.trim().split('\n');
    if (lines.length < 2) { toast('CSV is empty'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.match(/(".*?"|[^,]+)/g) || [];
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
      return obj;
    }).filter(r => Object.values(r).some(v => v));
    _parsedEmployees = rows;
    showImportPreview(rows, 'CSV');
    addSyncLog('&#10003; CSV parsed — ' + rows.length + ' rows, columns: ' + headers.join(', '));
  };
  r.readAsText(file);
}

function readImportJSON(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const rows = Array.isArray(data) ? data : (data.employees || data.data || data.results || data.staff || []);
      _parsedEmployees = rows;
      showImportPreview(rows, 'JSON');
      addSyncLog('&#10003; JSON parsed — ' + rows.length + ' records');
    } catch (err) { toast('Invalid JSON file'); addSyncLog('&#10007; JSON parse error: ' + err.message); }
  };
  r.readAsText(file);
}

function readImportXLSX(file) {
  addSyncLog('&#9203; Reading Excel file...');
  // Load SheetJS from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        _parsedEmployees = rows;
        showImportPreview(rows, 'Excel');
        addSyncLog('&#10003; Excel parsed — ' + rows.length + ' rows from sheet: ' + wb.SheetNames[0]);
      } catch (err) { toast('Could not read Excel file'); addSyncLog('&#10007; Excel error: ' + err.message); }
    };
    r.readAsArrayBuffer(file);
  };
  script.onerror = () => {
    toast('Could not load Excel parser — use CSV or JSON');
    addSyncLog('&#10007; SheetJS failed to load — use CSV or JSON');
  };
  document.head.appendChild(script);
}

function showImportPreview(rows, format) {
  if (!rows.length) { toast('No data found in file'); return; }
  const preview = rows.slice(0, 6).map(normaliseEmployee);
  const missing = rows.filter(r => !normaliseEmployee(r).name).length;
  const countEl = document.getElementById('import-preview-count');
  const warnEl = document.getElementById('import-preview-warn');
  const tblEl = document.getElementById('import-preview-tbl');
  const wrap = document.getElementById('import-file-preview');
  if (countEl) countEl.textContent = rows.length + ' employee' + (rows.length !== 1 ? 's' : '');
  if (warnEl) warnEl.innerHTML = missing ? '<div class="info-box warn">&#9888; ' + missing + ' rows missing a name — they will be skipped.</div>' : '';
  let tbl = '<table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:32%">Name</th><th style="width:24%">Dept</th><th style="width:22%">Site</th><th style="width:22%">Role</th></tr></thead><tbody>';
  preview.forEach(r => {
    tbl += '<tr><td style="font-weight:500">' + (r.name || '<span style="color:var(--text-danger)">Missing</span>') + '</td><td style="font-size:11px">' + r.dept + '</td><td style="font-size:11px">' + r.site.split(' ')[0] + '…</td><td>' + (r.role === 'supervisor' ? '<span class="badge b-purple">Sup</span>' : '<span class="badge b-blue">Staff</span>') + '</td></tr>';
  });
  if (rows.length > 6) tbl += '<tr><td colspan="4" style="text-align:center;color:var(--color-text-secondary);font-size:11px">… and ' + (rows.length - 6) + ' more</td></tr>';
  tbl += '</tbody></table>';
  if (tblEl) tblEl.innerHTML = tbl;
  if (wrap) wrap.style.display = 'block';
}

function doImportEmployees() {
  if (!_parsedEmployees.length) { toast('No employees to import'); return; }
  const result = mergeIncomingEmployees(_parsedEmployees, 'main');
  const db = getDB();
  db.lastSync = new Date().toISOString();
  db.lastMethod = 'File import';
  saveDB();
  addSyncLog('&#10003; File import complete: ' + result.added + ' imported, ' + result.updated + ' updated, ' + result.skipped + ' skipped');
  toast('&#10003; ' + (result.added + result.updated) + ' employees imported');
  _parsedEmployees = [];
  const wrap = document.getElementById('import-file-preview');
  const fi = document.getElementById('import-file-input');
  if (wrap) wrap.style.display = 'none';
  if (fi) fi.value = '';
  importSwitchTab('status');
  renderImportStatus();
}

function cancelImportFile() {
  _parsedEmployees = [];
  const wrap = document.getElementById('import-file-preview');
  const fi = document.getElementById('import-file-input');
  if (wrap) wrap.style.display = 'none';
  if (fi) fi.value = '';
}

function downloadTemplate(fmt) {
  if (fmt === 'csv') {
    const csv = 'employee_id,full_name,department,work_location,role,pin\nEMP-001,Ahmed Khalil,Cleaning,Mall — Level 2,staff,1234\nEMP-002,Sara Mohammed,Hospitality,Hotel Lobby,staff,1234\nSUP-001,Nour Al-Rashid,Cleaning,Mall — Level 2,supervisor,0000';
    const b = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = 'employees_template.csv'; a.click();
    URL.revokeObjectURL(u); toast('CSV template downloaded');
  } else {
    const json = JSON.stringify({ employees: [{ employee_id: 'EMP-001', full_name: 'Ahmed Khalil', department: 'Cleaning', work_location: 'Mall — Level 2', role: 'staff', pin: '1234' }, { employee_id: 'EMP-002', full_name: 'Sara Mohammed', department: 'Hospitality', work_location: 'Hotel Lobby', role: 'staff', pin: '1234' }] }, null, 2);
    const b = new Blob([json], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = 'employees_template.json'; a.click();
    URL.revokeObjectURL(u); toast('JSON template downloaded');
  }
  addSyncLog('&#8595; Template downloaded: ' + fmt.toUpperCase());
}

// ── STATUS ──
function renderImportStatus() {
  const db = getDB();
  const cfg = db.syncConfig || {};
  const hasUrl = !!cfg.url;
  const dotEl = document.getElementById('import-st-api-dot');
  const badgeEl = document.getElementById('import-st-api-badge');
  const lastEl = document.getElementById('import-st-last-sync');
  const nextEl = document.getElementById('import-st-next-sync');
  const cntEl = document.getElementById('import-st-emp-count');
  const methodEl = document.getElementById('import-st-last-method');
  if (dotEl) dotEl.className = 'status-dot ' + (hasUrl ? 'dot-green' : 'dot-gray');
  if (badgeEl) { badgeEl.className = 'badge ' + (hasUrl ? 'b-green' : 'b-gray'); badgeEl.textContent = hasUrl ? 'Configured' : 'Not configured'; }
  if (lastEl) lastEl.textContent = db.lastSync ? new Date(db.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';
  if (nextEl) nextEl.textContent = cfg.freq > 0 ? 'Every ' + cfg.freq + ' min' : 'Manual only';
  if (cntEl) cntEl.textContent = db.employees.filter(e => e.role !== 'admin').length + ' employees';
  if (methodEl) methodEl.textContent = db.lastMethod || '—';
  const emps = db.employees.filter(e => e.role !== 'admin');
  let tbl = '<table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:36%">Name</th><th style="width:26%">Dept</th><th style="width:20%">Role</th><th style="width:18%">Source</th></tr></thead><tbody>';
  emps.forEach(e => {
    const src = e.source === 'api' ? '<span class="badge b-green" style="font-size:10px">API</span>' : e.source === 'file' ? '<span class="badge b-blue" style="font-size:10px">File</span>' : '<span class="badge b-gray" style="font-size:10px">Manual</span>';
    tbl += '<tr><td style="font-weight:500;font-size:12px">' + e.name + '</td><td style="font-size:11px;color:var(--color-text-secondary)">' + e.dept + '</td><td>' + (e.role === 'supervisor' ? '<span class="badge b-purple" style="font-size:10px">Sup</span>' : '<span class="badge b-blue" style="font-size:10px">Staff</span>') + '</td><td>' + src + '</td></tr>';
  });
  if (!emps.length) tbl += '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--color-text-tertiary);font-size:12px">No employees yet</td></tr>';
  tbl += '</tbody></table>';
  const tblEl = document.getElementById('import-emp-list-tbl');
  if (tblEl) tblEl.innerHTML = tbl;
  const logEl = document.getElementById('import-sync-log');
  if (logEl) logEl.innerHTML = (db.syncLog || []).join('<br>') || 'No activity yet.';
}

function clearAllImportedEmployees() {
  if (!confirm('Remove all non-admin employees? This cannot be undone.')) return;
  const db = getDB();
  db.employees = db.employees.filter(e => e.role === 'admin');
  saveDB();
  addSyncLog('&#9888; All employees cleared by admin');
  toast('All employees removed');
  renderImportStatus();
}

// ── Helpers ──
function updateSyncIndicator(color, label) {
  const dot = document.getElementById('import-sync-pulse');
  const lbl = document.getElementById('import-sync-label');
  if (dot) dot.className = 'pulse ' + color;
  if (lbl) lbl.textContent = label;
}

function addSyncLog(msg) {
  const db = getDB();
  if (!db.syncLog) db.syncLog = [];
  const t = new Date().toTimeString().slice(0, 8);
  db.syncLog.unshift('[' + t + '] ' + msg);
  if (db.syncLog.length > 30) db.syncLog = db.syncLog.slice(0, 30);
  saveDB();
  const el = document.getElementById('import-sync-log');
  if (el) el.innerHTML = db.syncLog.join('<br>');
}

// ── Init import screen ──
function initImportScreen() {
  const db = getDB();
  const cfg = db.syncConfig || {};
  if (cfg.url && document.getElementById('api-url')) document.getElementById('api-url').value = cfg.url;
  if (cfg.apiKey && document.getElementById('api-key')) document.getElementById('api-key').value = cfg.apiKey;
  if (cfg.freq !== undefined && document.getElementById('api-freq')) document.getElementById('api-freq').value = cfg.freq;
  if (cfg.conflict && document.getElementById('api-conflict')) document.getElementById('api-conflict').value = cfg.conflict;
  if (cfg.url) updateSyncIndicator('green', 'Configured');
  if (db.syncLog && db.syncLog.length) {
    const el = document.getElementById('import-sync-log');
    if (el) el.innerHTML = db.syncLog.join('<br>');
  }
  importSwitchTab('api');
}
