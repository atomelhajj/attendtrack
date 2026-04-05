// ── Auth ──
let currentUser = null;
let clockInterval = null;

function setCurrentUser(emp) { currentUser = emp; }
function getCurrentUser() { return currentUser; }

function logout() {
  currentUser = null;
  clearInterval(clockInterval);
  clockInterval = null;
  showScreen('s-splash');
}

function loginAs(role) {
  const emp = getDB().employees.find(e => e.role === role);
  if (!emp) return;
  currentUser = emp;
  if (role === 'staff') { initStaff(); showScreen('s-staff-home'); }
  else if (role === 'supervisor') { initSupervisor(); showScreen('s-sup-home'); }
  else { initAdmin(); showScreen('s-admin-home'); }
}

function loginWithPin(pin) {
  const emp = getEmployeeByPin(pin);
  if (!emp) return false;
  currentUser = emp;
  if (emp.role === 'staff') { initStaff(); showScreen('s-staff-home'); }
  else if (emp.role === 'supervisor') { initSupervisor(); showScreen('s-sup-home'); }
  else { initAdmin(); showScreen('s-admin-home'); }
  return true;
}

// ── Screen manager ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Toast ──
let toastTimer = null;
function toast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Helpers ──
function greet(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return g + ', ' + name.split(' ')[0];
}

function avClass(role) {
  if (role === 'supervisor') return 'av-purple';
  if (role === 'admin') return 'av-amber';
  return 'av-teal';
}

function badgeHTML(type, text) {
  const map = { green:'b-green', amber:'b-amber', red:'b-red', blue:'b-blue', purple:'b-purple', gray:'b-gray' };
  return '<span class="badge ' + (map[type] || 'b-gray') + '">' + text + '</span>';
}

function confirmDialog(msg, onConfirm) {
  if (window.confirm(msg)) onConfirm();
}

// ── Geo-fence simulation ──
// In production this uses the Geolocation API against real site coords.
// For the demo we simulate being inside the site zone.
let geoSimulated = true;

function checkGeoFence(callback) {
  if (!navigator.geolocation || geoSimulated) {
    // Simulate: 80% of time we're "inside", 20% we test outside
    const inside = Math.random() > 0.15;
    callback({ inside, method: 'simulated', distance: inside ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 200 + 100) });
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const site = getSite(currentUser.site);
    if (!site) { callback({ inside: true, method: 'no-site' }); return; }
    const dist = haversine(pos.coords.latitude, pos.coords.longitude, site.coords.lat, site.coords.lng);
    callback({ inside: dist <= site.radius, method: 'gps', distance: Math.round(dist) });
  }, () => {
    callback({ inside: false, method: 'denied', distance: -1 });
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Live clock ──
function startClock(elId, dateElId) {
  clearInterval(clockInterval);
  function tick() {
    const d = new Date();
    const el = document.getElementById(elId);
    const del = dateElId ? document.getElementById(dateElId) : null;
    if (el) el.textContent = d.toTimeString().slice(0, 5);
    if (del) del.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}

function stopClock() { clearInterval(clockInterval); clockInterval = null; }
