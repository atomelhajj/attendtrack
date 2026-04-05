// ── Admin Module ──

let adminTab = 'live';

function initAdmin() {
  renderAdminHome();
}

function renderAdminHome() {
  document.getElementById('admin-date-sub').textContent = fmtDateFull(new Date().toISOString());
  renderAdminStats();
  setAdminTab(adminTab);
}

function renderAdminStats() {
  const today = new Date().toDateString();
  const activeRecs = getDB().records.filter(r => !r.clockOut && !r.absent && new Date(r.clockIn).toDateString() === today);
  const pendingReview = getPendingManual(null).length;
  const escalated = getDB().records.filter(r => r.escalated).length;
  const totalStaff = getAllStaff().length;

  document.getElementById('adm-s1').textContent = activeRecs.length;
  document.getElementById('adm-s2').textContent = pendingReview;
  document.getElementById('adm-s3').textContent = escalated;
  document.getElementById('adm-s4').textContent = totalStaff;
}

function setAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('on'));
  const btns = document.querySelectorAll('.admin-tab');
  const tabMap = { live:0, employees:1, reports:2, sites:3 };
  if (btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('on');
  const el = document.getElementById('admin-tab-content');
  if (tab === 'live') el.innerHTML = renderAdminLive();
  else if (tab === 'employees') el.innerHTML = renderAdminEmployees();
  else if (tab === 'reports') el.innerHTML = renderAdminReports();
  else if (tab === 'sites') el.innerHTML = renderAdminSites();
}

function renderAdminLive() {
  const today = new Date().toDateString();
  const allStaff = getAllStaff();
  const todayRecs = getDB().records.filter(r => new Date(r.clockIn).toDateString() === today);

  // Group by site
  const sites = [...new Set(allStaff.map(e => e.site))];
  let html = '';

  sites.forEach(site => {
    const siteStaff = allStaff.filter(e => e.site === site);
    html += '<div class="sect">' + site + '</div><div class="tbl-wrap"><table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:30%">Employee</th><th style="width:22%">Dept</th><th style="width:15%">In</th><th style="width:15%">Out</th><th style="width:18%">Status</th></tr></thead><tbody>';
    siteStaff.forEach(e => {
      const active = todayRecs.find(r => r.empId === e.id && !r.clockOut && !r.absent);
      const rec = active || todayRecs.find(r => r.empId === e.id);
      let badge, inT = '—', outT = '—';
      if (rec) {
        inT = fmtTime(rec.clockIn);
        outT = rec.clockOut ? fmtTime(rec.clockOut) : '—';
        if (rec.absent) badge = badgeHTML('amber','Absent');
        else if (rec.manual && !rec.approved) badge = badgeHTML('red','Pending');
        else if (!rec.clockOut) badge = badgeHTML('green','In');
        else badge = badgeHTML('gray','Out');
      } else {
        badge = badgeHTML('amber','Not in');
      }
      html += '<tr><td style="font-weight:500">' + e.name.split(' ')[0] + ' ' + e.name.split(' ').slice(-1) + '</td><td style="font-size:12px;color:var(--text-2)">' + e.dept + '</td><td>' + inT + '</td><td>' + outT + '</td><td>' + badge + '</td></tr>';
    });
    html += '</tbody></table></div>';
  });

  // Pending approvals
  const pending = getPendingManual(null);
  if (pending.length) {
    html += '<div class="sect">Pending approval (' + pending.length + ')</div>';
    pending.forEach(r => {
      html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:14px;font-weight:500">' + r.empName + '</span>' + badgeHTML('red','Manual') + '</div>' +
        '<div style="font-size:12px;color:var(--text-2);margin-bottom:4px">' + r.site + ' · ' + fmtTime(r.clockIn) + ' · ' + (r.note || 'No reason') + '</div>' +
        (r.escalated ? '<div style="font-size:12px;color:#3C3489;margin-bottom:6px">&#8593; Escalated by supervisor</div>' : '') +
        '<div class="alert-actions">' +
        '<button class="btn-xs bx-green" onclick="adminApprove(\'' + r.id + '\')">&#10003; Approve</button>' +
        '<button class="btn-xs bx-red" onclick="adminReject(\'' + r.id + '\')">&#10007; Reject</button>' +
        '<button class="btn-xs bx-blue" onclick="adminEditRecord(\'' + r.id + '\')">&#9998; Edit</button>' +
        '</div></div>';
    });
  }
  return html || '<div class="empty"><div class="ei">&#128202;</div><p>No staff data for today yet.</p></div>';
}

function renderAdminEmployees() {
  const emps = getDB().employees.filter(e => e.role !== 'admin');
  let html = '<div class="tbl-wrap"><table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:35%">Name</th><th style="width:25%">Dept</th><th style="width:20%">Role</th><th style="width:20%">Site</th></tr></thead><tbody>';
  emps.forEach(e => {
    html += '<tr style="cursor:pointer" onclick="adminViewEmployee(\'' + e.id + '\')">' +
      '<td><div style="font-weight:500">' + e.name + '</div><div style="font-size:11px;color:var(--text-3)">' + e.id + '</div></td>' +
      '<td style="font-size:12px">' + e.dept + '</td>' +
      '<td>' + badgeHTML(e.role === 'supervisor' ? 'purple' : 'blue', e.role) + '</td>' +
      '<td style="font-size:12px;color:var(--text-2)">' + e.site.split(' ')[0] + '</td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="display:flex;gap:8px;margin-top:4px">';
  html += '<button class="btn btn-dark" style="flex:1" onclick="showScreen(\'s-admin-add-emp\')">+ Add manually</button>';
  html += '<button class="btn btn-in" style="flex:1" onclick="showScreen(\'s-import\');initImportScreen()">&#8645; Import / sync</button>';
  html += '</div>';
  return html;
}

function renderAdminReports() {
  const d = new Date();
  const staff = getAllStaff();

  let html = '<div class="report-card" onclick="adminMonthlyReport()">' +
    '<div><h4>Monthly summary</h4><p>Hours, days present, absences per employee</p></div><div class="rc-arrow">&#8594;</div></div>' +
    '<div class="report-card" onclick="adminPayrollExport()">' +
    '<div><h4>Payroll export (CSV)</h4><p>Clock in/out times ready for payroll</p></div><div class="rc-arrow">&#8595;</div></div>' +
    '<div class="report-card" onclick="adminDailyLog()">' +
    '<div><h4>Daily log</h4><p>Full log for today across all sites</p></div><div class="rc-arrow">&#8594;</div></div>';

  // Summary table
  html += '<div class="sect">This month — summary</div><div class="tbl-wrap"><table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:30%">Employee</th><th style="width:14%">Days</th><th style="width:16%">Hours</th><th style="width:14%">Manual</th><th style="width:26%">Status</th></tr></thead><tbody>';
  staff.forEach(e => {
    const recs = getMonthRecords(e.id, d.getFullYear(), d.getMonth());
    const days = new Set(recs.filter(r => !r.absent && r.clockOut).map(r => new Date(r.clockIn).toDateString())).size;
    const totalMins = getTotalMinutes(recs);
    const manualCount = recs.filter(r => r.manual).length;
    const status = manualCount > 0 ? badgeHTML('amber','Review') : badgeHTML('green','OK');
    html += '<tr><td><div style="font-weight:500;font-size:13px">' + e.name.split(' ')[0] + '</div></td><td>' + days + '</td><td>' + Math.floor(totalMins/60) + 'h</td><td>' + manualCount + '</td><td>' + status + '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function renderAdminSites() {
  const sites = getSites();
  const allStaff = getAllStaff();
  const today = new Date().toDateString();
  let html = '';
  sites.forEach(s => {
    const staff = allStaff.filter(e => e.site === s.name);
    const active = getDB().records.filter(r => r.site === s.name && !r.clockOut && new Date(r.clockIn).toDateString() === today).length;
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<div><div style="font-size:15px;font-weight:500">' + s.name + '</div>' +
      '<div style="font-size:12px;color:var(--text-2);margin-top:2px">' + staff.length + ' staff · Radius: ' + s.radius + 'm</div></div>' +
      badgeHTML(s.auto ? 'green' : 'amber', s.auto ? 'Auto' : 'Manual') +
      '</div>' +
      '<div style="display:flex;gap:12px;font-size:13px;padding-top:8px;border-top:0.5px solid var(--border)">' +
      '<span style="color:var(--text-2)">In now: <strong style="color:var(--text)">' + active + '</strong></span>' +
      '<span style="color:var(--text-2)">Assigned: <strong style="color:var(--text)">' + staff.length + '</strong></span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<button class="btn-xs bx-gray" onclick="adminEditSite(\'' + s.id + '\')">&#9998; Edit zone</button>' +
      '</div></div>';
  });
  html += '<button class="btn btn-dark" style="margin-top:4px" onclick="adminAddSite()">+ Add site</button>';
  return html;
}

// ── Admin actions ──
function adminApprove(recId) {
  approveRecord(recId);
  toast('&#10003; Entry approved');
  renderAdminHome();
}

function adminReject(recId) {
  confirmDialog('Reject and delete this entry?', () => {
    rejectRecord(recId);
    toast('Entry rejected');
    renderAdminHome();
  });
}

function adminEditRecord(recId) {
  const rec = getDB().records.find(r => r.id === recId);
  if (!rec) return;
  const newIn = prompt('Edit clock-in time (HH:MM):', fmtTime(rec.clockIn));
  if (!newIn) return;
  const d = new Date(rec.clockIn);
  const [h, m] = newIn.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  editRecord(recId, { clockIn: d.toISOString(), approved: true, manual: true });
  toast('Record updated');
  renderAdminHome();
}

function adminViewEmployee(empId) {
  const emp = getEmployee(empId);
  if (!emp) return;
  const recs = getDB().records.filter(r => r.empId === empId).slice(-10);
  const totalMins = getTotalMinutes(recs);
  let info = emp.name + '\n' + emp.id + ' · ' + emp.dept + ' · ' + emp.site + '\nRole: ' + emp.role + '\nRecent hours: ' + minsToHM(totalMins);
  const action = prompt(info + '\n\nEnter new PIN to update (or cancel):');
  if (action && action.length === 4 && !isNaN(action)) {
    updateEmployeePin(empId, action);
    toast('PIN updated for ' + emp.name);
  }
}

function adminMonthlyReport() {
  const d = new Date();
  const staff = getAllStaff();
  let info = 'MONTHLY REPORT — ' + d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '\n\n';
  staff.forEach(e => {
    const recs = getMonthRecords(e.id, d.getFullYear(), d.getMonth());
    const days = new Set(recs.filter(r => !r.absent && r.clockOut).map(r => new Date(r.clockIn).toDateString())).size;
    const mins = getTotalMinutes(recs);
    info += e.name + ': ' + days + ' days, ' + minsToHM(mins) + '\n';
  });
  alert(info);
}

function adminPayrollExport() {
  const d = new Date();
  exportAttendanceCSV(d.getMonth(), d.getFullYear());
  toast('CSV downloading...');
}

function adminDailyLog() {
  const today = new Date().toDateString();
  const recs = getDB().records.filter(r => new Date(r.clockIn).toDateString() === today);
  let info = 'DAILY LOG — Today\n\n';
  recs.forEach(r => {
    info += r.empName + ' · ' + r.site + '\nIn: ' + fmtTime(r.clockIn) + (r.clockOut ? '  Out: ' + fmtTime(r.clockOut) : '  ACTIVE') + (r.manual ? '  [MANUAL]' : '') + '\n\n';
  });
  if (!recs.length) info += 'No records today.';
  alert(info);
}

function adminEditSite(siteId) {
  const site = getDB().sites.find(s => s.id === siteId);
  if (!site) return;
  const newRadius = prompt('Edit geo-fence radius for ' + site.name + ' (meters):', site.radius);
  if (newRadius && !isNaN(newRadius)) {
    site.radius = parseInt(newRadius);
    saveDB();
    toast('Zone updated');
    setAdminTab('sites');
  }
}

function adminAddSite() {
  const name = prompt('New site name:');
  if (!name) return;
  const radius = parseInt(prompt('Geo-fence radius (meters):', '80')) || 80;
  const db = getDB();
  db.sites.push({ id: 'site-' + Date.now(), name, radius, auto: true, coords: { lat: 25.2854, lng: 51.5310 } });
  saveDB();
  toast('Site added');
  setAdminTab('sites');
}

// ── Add employee form ──
function adminAddEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  if (!name) { toast('Please enter a name'); return; }
  const dept = document.getElementById('new-emp-dept').value;
  const site = document.getElementById('new-emp-site').value;
  const role = document.getElementById('new-emp-role').value;
  const pin = document.getElementById('new-emp-pin').value || '1234';
  if (pin.length !== 4 || isNaN(pin)) { toast('PIN must be 4 digits'); return; }
  addEmployee({ name, dept, site, role, pin });
  toast('&#10003; Employee added — PIN: ' + pin);
  showScreen('s-admin-home');
  setAdminTab('employees');
  renderAdminStats();
}

// ── Admin nav ──
function adminNav(tab) {
  adminTab = tab;
  showScreen('s-admin-home');
  renderAdminHome();
}
