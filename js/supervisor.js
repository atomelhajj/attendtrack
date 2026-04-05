// ── Supervisor Module ──

function initSupervisor() {
  renderSupHome();
}

function renderSupHome() {
  if (!currentUser) return;
  document.getElementById('sup-greeting').textContent = greet(currentUser.name);
  document.getElementById('sup-site-sub').textContent = 'Supervisor · ' + currentUser.site;

  const site = currentUser.site;
  const staff = getSiteStaff(site);
  const active = getActiveOnSite(site);
  const pending = getPendingManual(site);
  const today = new Date().toDateString();
  const notIn = staff.filter(e => !active.find(r => r.empId === e.id));
  const alertCount = notIn.length + pending.length;

  document.getElementById('sup-stat-present').textContent = active.length;
  document.getElementById('sup-stat-pending').textContent = notIn.length;
  document.getElementById('sup-stat-alerts').textContent = alertCount;

  // own status
  const supActive = getActiveRecord(currentUser.id);
  const ownEl = document.getElementById('sup-own-status');
  if (supActive) {
    ownEl.innerHTML = '<div class="card" style="padding:10px 14px;display:flex;align-items:center;gap:10px">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:#1D9E75;flex-shrink:0"></div>' +
      '<div style="flex:1;font-size:13px;">Clocked in since <strong>' + fmtTime(supActive.clockIn) + '</strong></div>' +
      badgeHTML('green','On site') +
      '<button class="btn-xs bx-gray" style="margin-left:4px" onclick="supClockOut()">Clock out</button>' +
      '</div>';
  } else {
    ownEl.innerHTML = '<div class="card"><div style="font-size:13px;color:var(--text-2);margin-bottom:10px">You are not clocked in for today.</div>' +
      '<button class="btn btn-purple" onclick="supClockIn()">Clock in as supervisor</button></div>';
  }

  // alerts
  let alertsHtml = '';
  pending.slice(0, 3).forEach(r => {
    alertsHtml += '<div class="alert-box red">' +
      '<div class="at">' + r.empName + ' — manual entry</div>' +
      '<div class="as">Clocked in outside geo-zone at ' + fmtTime(r.clockIn) + '</div>' +
      '<div class="alert-actions">' +
      '<button class="btn-xs bx-green" onclick="supApprove(\'' + r.id + '\')">Approve</button>' +
      '<button class="btn-xs bx-red" onclick="supReject(\'' + r.id + '\')">Reject</button>' +
      '<button class="btn-xs bx-gray" onclick="supEscalate(\'' + r.id + '\')">Escalate</button>' +
      '</div></div>';
  });
  notIn.slice(0, 3).forEach(e => {
    alertsHtml += '<div class="alert-box amber">' +
      '<div class="at">' + e.name + ' — not clocked in</div>' +
      '<div class="as">' + e.dept + ' · Shift has started</div>' +
      '<div class="alert-actions">' +
      '<button class="btn-xs bx-blue" onclick="openOverride(\'' + e.id + '\')">Clock in for staff</button>' +
      '<button class="btn-xs bx-red" onclick="supMarkAbsent(\'' + e.id + '\')">Mark absent</button>' +
      '</div></div>';
  });
  if (!alertsHtml) alertsHtml = '<div class="info-box success">&#10003; All clear — no alerts for your site.</div>';
  document.getElementById('sup-alerts-home').innerHTML = alertsHtml;
}

function supClockIn() {
  clockIn(currentUser.id, '', false);
  toast('&#10003; Clocked in');
  renderSupHome();
}

function supClockOut() {
  clockOut(currentUser.id, '');
  toast('&#10003; Clocked out');
  renderSupHome();
}

function supApprove(recId) {
  approveRecord(recId);
  toast('&#10003; Entry approved');
  renderSupHome();
  if (document.getElementById('s-sup-alerts').classList.contains('active')) renderSupAlerts();
}

function supReject(recId) {
  confirmDialog('Reject and delete this clock-in entry?', () => {
    rejectRecord(recId);
    toast('Entry rejected and removed');
    renderSupHome();
    if (document.getElementById('s-sup-alerts').classList.contains('active')) renderSupAlerts();
  });
}

function supEscalate(recId) {
  editRecord(recId, { escalated: true });
  toast('Escalated to admin');
  renderSupHome();
}

function supMarkAbsent(empId) {
  confirmDialog('Mark this employee as absent for today?', () => {
    markAbsent(empId, currentUser.id);
    toast('Marked as absent');
    renderSupHome();
    if (document.getElementById('s-sup-team').classList.contains('active')) renderSupTeam();
  });
}

// ── Team ──
function renderSupTeam() {
  if (!currentUser) return;
  const site = currentUser.site;
  const staff = getSiteStaff(site);
  const active = getActiveOnSite(site);
  const activeIds = active.map(r => r.empId);
  document.getElementById('sup-team-sub').textContent = site + ' · ' + staff.length + ' staff today';

  const inStaff = staff.filter(e => activeIds.includes(e.id));
  const outStaff = staff.filter(e => !activeIds.includes(e.id));

  let html = '';
  if (inStaff.length) {
    html += '<div class="sect">Clocked in (' + inStaff.length + ')</div><div class="card" style="padding:6px 14px">';
    inStaff.forEach(e => {
      const rec = active.find(r => r.empId === e.id);
      const mins = rec ? Math.floor((Date.now() - new Date(rec.clockIn)) / 60000) : 0;
      html += '<div class="staff-row">' +
        '<div class="avatar ' + avClass(e.role) + '">' + e.initials + '</div>' +
        '<div class="staff-info"><div class="sn">' + e.name + '</div><div class="sr">' + e.dept + '</div></div>' +
        '<div style="text-align:right">' +
        '<div style="font-size:12px;color:var(--text-2)">In ' + fmtTime(rec && rec.clockIn) + '</div>' +
        (rec && rec.manual && !rec.approved ? badgeHTML('red','Manual') : badgeHTML('green','Active')) +
        '</div></div>';
    });
    html += '</div>';
  }

  if (outStaff.length) {
    html += '<div class="sect">Not yet in (' + outStaff.length + ')</div><div class="card" style="padding:6px 14px">';
    outStaff.forEach(e => {
      const today = new Date().toDateString();
      const absRec = getDB().records.find(r => r.empId === e.id && r.absent && new Date(r.clockIn).toDateString() === today);
      html += '<div class="staff-row">' +
        '<div class="avatar av-amber">' + e.initials + '</div>' +
        '<div class="staff-info"><div class="sn">' + e.name + '</div><div class="sr">' + e.dept + '</div></div>' +
        '<div style="display:flex;gap:5px;align-items:center">' +
        (absRec ? badgeHTML('amber','Absent') : badgeHTML('amber','Pending')) +
        (!absRec ? '<button class="btn-xs bx-blue" onclick="openOverride(\'' + e.id + '\')" style="margin-left:4px">Override</button>' : '') +
        '</div></div>';
    });
    html += '</div>';
  }

  if (!html) html = '<div class="empty"><div class="ei">&#128101;</div><p>No staff assigned to this site.</p></div>';
  document.getElementById('sup-team-list').innerHTML = html;
}

// ── Alerts ──
function renderSupAlerts() {
  if (!currentUser) return;
  const site = currentUser.site;
  const staff = getSiteStaff(site);
  const active = getActiveOnSite(site);
  const activeIds = active.map(r => r.empId);
  const notIn = staff.filter(e => !activeIds.includes(e.id) && !getDB().records.find(r => r.empId === e.id && r.absent && new Date(r.clockIn).toDateString() === new Date().toDateString()));
  const manual = getPendingManual(site);
  const total = notIn.length + manual.length;

  document.getElementById('sup-alerts-sub').textContent = total + ' item' + (total !== 1 ? 's' : '') + ' need attention';

  let html = '';
  manual.forEach(r => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:14px;font-weight:500">' + r.empName + '</span>' + badgeHTML('red','Needs review') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-2);margin-bottom:4px">Manual clock-in at ' + fmtTime(r.clockIn) + ' — outside geo-zone</div>' +
      (r.note ? '<div style="font-size:12px;color:var(--text-2);margin-bottom:8px">Note: ' + r.note + '</div>' : '') +
      '<div class="alert-actions">' +
      '<button class="btn-xs bx-green" onclick="supApprove(\'' + r.id + '\')">&#10003; Approve</button>' +
      '<button class="btn-xs bx-red" onclick="supReject(\'' + r.id + '\')">&#10007; Reject</button>' +
      '<button class="btn-xs bx-gray" onclick="supEscalate(\'' + r.id + '\')">&#8593; Escalate</button>' +
      '</div></div>';
  });

  notIn.forEach(e => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:14px;font-weight:500">' + e.name + '</span>' + badgeHTML('amber','Not clocked in') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-2);margin-bottom:8px">' + e.dept + ' · No activity recorded today</div>' +
      '<div class="alert-actions">' +
      '<button class="btn-xs bx-blue" onclick="openOverride(\'' + e.id + '\')">Clock in for staff</button>' +
      '<button class="btn-xs bx-red" onclick="supMarkAbsent(\'' + e.id + '\')">Mark absent</button>' +
      '</div></div>';
  });

  if (!html) html = '<div class="info-box success" style="margin-top:8px">&#10003; No alerts — all clear for your site!</div>';
  document.getElementById('sup-alerts-body').innerHTML = html;
}

// ── Override ──
function openOverride(empId) {
  const sel = document.getElementById('override-emp-sel');
  const staff = getSiteStaff(currentUser.site);
  sel.innerHTML = staff.map(e => '<option value="' + e.id + '"' + (e.id === empId ? ' selected' : '') + '>' + e.name + ' (' + e.dept + ')</option>').join('');
  const now = new Date();
  document.getElementById('override-time-inp').value = now.toTimeString().slice(0, 5);
  document.getElementById('override-note-inp').value = '';
  showScreen('s-sup-override');
}

function submitOverride() {
  const empId = document.getElementById('override-emp-sel').value;
  const timeStr = document.getElementById('override-time-inp').value;
  const reason = document.getElementById('override-reason-sel').value;
  const note = document.getElementById('override-note-inp').value;
  if (!empId || !timeStr) { toast('Please fill in all fields'); return; }
  const fullNote = reason + (note ? ' — ' + note : '');
  clockInAt(empId, timeStr, fullNote, true, currentUser.id);
  toast('Override submitted — flagged for admin review');
  showScreen('s-sup-alerts');
  renderSupAlerts();
  renderSupHome();
}

// ── Report ──
function renderSupReport() {
  if (!currentUser) return;
  const site = currentUser.site;
  const staff = getSiteStaff(site);
  const today = new Date().toDateString();
  const todayRecs = getAllTodayRecords(site);
  const presentIds = new Set(todayRecs.filter(r => !r.absent).map(r => r.empId));
  const manualCount = todayRecs.filter(r => r.manual).length;
  const issues = manualCount + staff.filter(e => !presentIds.has(e.id)).length;

  document.getElementById('sup-report-sub').textContent = site + ' · ' + fmtDateFull(new Date().toISOString()).split(',')[0];
  document.getElementById('sup-r-scheduled').textContent = staff.length;
  document.getElementById('sup-r-present').textContent = presentIds.size;
  document.getElementById('sup-r-issues').textContent = issues;

  let rows = '';
  staff.forEach(e => {
    const rec = todayRecs.find(r => r.empId === e.id);
    if (rec && !rec.absent) {
      const mins = rec.clockOut ? calcHours(rec) : Math.floor((Date.now() - new Date(rec.clockIn)) / 60000);
      rows += '<tr><td>' + e.name + '</td><td>' + fmtTime(rec.clockIn) + '</td><td>' + (rec.clockOut ? fmtTime(rec.clockOut) : badgeHTML('green', 'In')) + '</td><td>' + minsToHM(mins) + '</td><td>' + (rec.manual ? badgeHTML('red','Manual') : badgeHTML('green','Auto')) + '</td></tr>';
    } else if (rec && rec.absent) {
      rows += '<tr><td>' + e.name + '</td><td colspan="4">' + badgeHTML('amber','Absent') + '</td></tr>';
    } else {
      rows += '<tr><td>' + e.name + '</td><td colspan="4">' + badgeHTML('amber','Not in') + '</td></tr>';
    }
  });

  document.getElementById('sup-report-tbl').innerHTML =
    '<div class="tbl-wrap"><table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:28%">Employee</th><th style="width:15%">In</th><th style="width:15%">Out</th><th style="width:18%">Hours</th><th style="width:24%">Type</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function supSendReport() {
  toast('Report sent to admin &#10003;');
}

// ── Sup nav ──
function supNav(tab) {
  const screens = { home:'s-sup-home', team:'s-sup-team', alerts:'s-sup-alerts', report:'s-sup-report' };
  showScreen(screens[tab]);
  if (tab === 'home') renderSupHome();
  else if (tab === 'team') renderSupTeam();
  else if (tab === 'alerts') renderSupAlerts();
  else if (tab === 'report') renderSupReport();
  document.querySelectorAll('#sup-nav .nav-item').forEach(n => n.classList.remove('on-p'));
  const idx = { home:0, team:1, alerts:2, report:3 };
  const items = document.querySelectorAll('#sup-nav .nav-item');
  if (items[idx[tab]]) items[idx[tab]].classList.add('on-p');
}
