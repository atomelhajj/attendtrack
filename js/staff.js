// ── Staff Module ──

function initStaff() {
  startClock('staff-clock', 'staff-date');
  renderStaffHome();
}

function renderStaffHome() {
  if (!currentUser) return;
  document.getElementById('staff-greeting').textContent = greet(currentUser.name);
  document.getElementById('staff-site-sub').textContent = 'Staff · ' + currentUser.site;
  document.getElementById('s-assigned-site').textContent = currentUser.site;

  const active = getActiveRecord(currentUser.id);
  const todayRecs = getTodayRecords(currentUser.id);
  const totalMins = todayRecs.reduce((a, r) => {
    if (r.absent) return a;
    if (r.clockOut) return a + calcHours(r);
    return a + Math.floor((Date.now() - new Date(r.clockIn)) / 60000);
  }, 0);

  document.getElementById('s-hours-today').textContent = minsToHM(totalMins);

  const actionArea = document.getElementById('staff-action-area');
  const statusBadge = document.getElementById('s-status-badge');
  const geoPill = document.getElementById('geo-pill');

  if (active) {
    actionArea.innerHTML = '<button class="btn btn-out" onclick="staffShowClockOut()">Clock out</button>';
    statusBadge.innerHTML = badgeHTML('green', '&#10003; Clocked in since ' + fmtTime(active.clockIn));
    if (geoPill) { geoPill.className = 'geo-pill in'; geoPill.innerHTML = '<div class="geo-dot in"></div><span>Within site zone</span>'; }
  } else {
    checkGeoFence(geo => {
      if (geoPill) {
        if (geo.inside) {
          geoPill.className = 'geo-pill in';
          geoPill.innerHTML = '<div class="geo-dot in"></div><span>Within site zone' + (geo.distance >= 0 ? ' · ' + geo.distance + 'm' : '') + '</span>';
          actionArea.innerHTML = '<button class="btn btn-in" onclick="staffShowClockIn(true)">Clock in</button>';
        } else {
          geoPill.className = 'geo-pill out';
          geoPill.innerHTML = '<div class="geo-dot out"></div><span>Outside site zone' + (geo.distance > 0 ? ' · ' + geo.distance + 'm away' : '') + '</span>';
          actionArea.innerHTML = '<button class="btn btn-in" onclick="staffShowClockIn(false)">Manual clock in</button>';
        }
      } else {
        actionArea.innerHTML = '<button class="btn btn-in" onclick="staffShowClockIn(true)">Clock in</button>';
      }
    });
    statusBadge.innerHTML = badgeHTML('amber', 'Not clocked in');
  }
}

let _clockInGeo = true;

function staffShowClockIn(inZone) {
  _clockInGeo = inZone;
  const d = new Date();
  document.getElementById('confirm-hdr').className = 'hdr teal';
  document.getElementById('confirm-title').textContent = 'Confirm clock in';
  document.getElementById('confirm-site-line').textContent = currentUser.site;
  document.getElementById('confirm-time-val').textContent = d.toTimeString().slice(0, 5);
  document.getElementById('confirm-site-val').textContent = currentUser.site;
  document.getElementById('confirm-geo-val').innerHTML = inZone
    ? '<span style="color:#085041">&#10003; Within geo-zone</span>'
    : '<span style="color:#791F1F">&#9888; Outside geo-zone — will be flagged</span>';
  document.getElementById('confirm-method-val').textContent = inZone ? 'Auto (geo-fence)' : 'Manual';
  document.getElementById('confirm-note-in').value = '';
  document.getElementById('confirm-btn').textContent = 'Confirm clock in';
  document.getElementById('confirm-btn').className = 'btn btn-in';
  document.getElementById('confirm-btn').onclick = staffDoClockIn;

  if (!inZone) {
    document.getElementById('confirm-warn').innerHTML = '<div class="info-box warn">&#9888; You are outside the site zone. This entry will be flagged for supervisor review.</div>';
  } else {
    document.getElementById('confirm-warn').innerHTML = '';
  }
  showScreen('s-staff-confirm');
}

function staffShowClockOut() {
  const active = getActiveRecord(currentUser.id);
  if (!active) return;
  const d = new Date();
  document.getElementById('confirm-hdr').className = 'hdr coral';
  document.getElementById('confirm-title').textContent = 'Confirm clock out';
  document.getElementById('confirm-site-line').textContent = currentUser.site;
  document.getElementById('confirm-time-val').textContent = d.toTimeString().slice(0, 5);
  document.getElementById('confirm-site-val').textContent = currentUser.site;
  document.getElementById('confirm-geo-val').innerHTML = '<span style="color:#085041">&#10003; Location recorded</span>';
  document.getElementById('confirm-method-val').textContent = 'Clock out';
  document.getElementById('confirm-note-in').value = '';
  document.getElementById('confirm-warn').innerHTML = '';
  const mins = Math.floor((Date.now() - new Date(active.clockIn)) / 60000);
  document.getElementById('confirm-btn').innerHTML = 'Confirm clock out &nbsp;·&nbsp; ' + minsToHM(mins) + ' on site';
  document.getElementById('confirm-btn').className = 'btn btn-out';
  document.getElementById('confirm-btn').onclick = staffDoClockOut;
  showScreen('s-staff-confirm');
}

function staffDoClockIn() {
  const note = document.getElementById('confirm-note-in').value;
  clockIn(currentUser.id, note, !_clockInGeo);
  toast(_clockInGeo ? '&#10003; Clocked in successfully' : '&#9888; Manual entry submitted for review');
  showScreen('s-staff-home');
  renderStaffHome();
}

function staffDoClockOut() {
  const note = document.getElementById('confirm-note-in').value;
  clockOut(currentUser.id, note);
  toast('&#10003; Clocked out successfully');
  showScreen('s-staff-home');
  renderStaffHome();
}

function staffCancelConfirm() {
  showScreen('s-staff-home');
  renderStaffHome();
}

// ── History ──
function renderStaffHistory() {
  const records = getDB().records
    .filter(r => r.empId === currentUser.id)
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));

  const d = new Date();
  document.getElementById('hist-period').textContent = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const presentDays = new Set(records.filter(r => !r.absent && r.clockOut).map(r => new Date(r.clockIn).toDateString())).size;
  const totalMins = getTotalMinutes(records);
  const manual = records.filter(r => r.manual && !r.absent).length;

  document.getElementById('hist-days').textContent = presentDays;
  document.getElementById('hist-hours').textContent = Math.floor(totalMins / 60) + 'h';

  const list = document.getElementById('hist-list');
  if (!records.length) {
    list.innerHTML = '<div class="empty"><div class="ei">&#128203;</div><p>No records yet.<br>Clock in to get started.</p></div>';
    return;
  }

  let html = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:30%">Date</th><th style="width:20%">In</th><th style="width:20%">Out</th><th style="width:20%">Hours</th><th style="width:10%"></th></tr></thead><tbody>';
  records.forEach(r => {
    const mins = (r.clockOut && !r.absent) ? calcHours(r) : null;
    const typeBadge = r.absent ? badgeHTML('amber','Absent') : r.manual ? badgeHTML('red','Manual') : '';
    const outCell = r.absent ? '—' : r.clockOut ? fmtTime(r.clockOut) : badgeHTML('green','Active');
    html += '<tr><td>' + fmtDate(r.clockIn) + '</td><td>' + fmtTime(r.clockIn) + '</td><td>' + outCell + '</td><td>' + (mins !== null ? minsToHM(mins) : '—') + '</td><td>' + typeBadge + '</td></tr>';
  });
  html += '</tbody></table></div>';
  list.innerHTML = html;
}

// ── Profile ──
function renderStaffProfile() {
  if (!currentUser) return;
  document.getElementById('p-avatar-txt').textContent = currentUser.initials;
  document.getElementById('p-avatar-wrap').className = 'profile-avatar-big ' + avClass(currentUser.role);
  document.getElementById('p-name').textContent = currentUser.name;
  document.getElementById('p-role-line').textContent = currentUser.dept + ' · ' + currentUser.site;
  document.getElementById('p-id').textContent = currentUser.id;
  document.getElementById('p-dept').textContent = currentUser.dept;
  document.getElementById('p-site-val').textContent = currentUser.site;
}

function staffChangePin() {
  const newPin = prompt('Enter new 4-digit PIN:');
  if (!newPin || newPin.length !== 4 || isNaN(newPin)) { toast('PIN must be 4 digits'); return; }
  updateEmployeePin(currentUser.id, newPin);
  toast('PIN updated successfully');
}

// ── Staff nav ──
function staffNav(tab) {
  if (tab === 'home') { showScreen('s-staff-home'); renderStaffHome(); }
  else if (tab === 'history') { showScreen('s-staff-history'); renderStaffHistory(); }
  else if (tab === 'profile') { showScreen('s-staff-profile'); renderStaffProfile(); }
  document.querySelectorAll('#staff-nav .nav-item').forEach(n => n.classList.remove('on-t'));
  const idx = { home:0, history:1, profile:2 };
  const items = document.querySelectorAll('#staff-nav .nav-item');
  if (items[idx[tab]]) items[idx[tab]].classList.add('on-t');
}
