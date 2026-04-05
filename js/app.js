// ── AttendTrack — App bootstrap ──

document.addEventListener('DOMContentLoaded', () => {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Hide loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }, 400);

  // Show splash
  showScreen('s-splash');
});

// ── PIN login ──
let pinValue = '';

function pinKey(digit) {
  if (pinValue.length >= 4) return;
  pinValue += digit;
  renderPinDots();
  if (pinValue.length === 4) {
    setTimeout(() => {
      if (!loginWithPin(pinValue)) {
        toast('Incorrect PIN. Try again.');
        pinValue = '';
        renderPinDots();
      }
    }, 200);
  }
}

function pinDelete() {
  pinValue = pinValue.slice(0, -1);
  renderPinDots();
}

function renderPinDots() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pin-dot-' + i);
    if (el) el.textContent = pinValue.length > i ? '●' : '○';
  }
}

function goToLogin(role) {
  document.getElementById('login-role-hint').textContent =
    role === 'staff' ? 'Staff login' :
    role === 'supervisor' ? 'Supervisor login' : 'Admin login';
  document.getElementById('login-role-hidden').value = role;
  pinValue = '';
  renderPinDots();
  showScreen('s-login');
}

function loginBack() {
  pinValue = '';
  showScreen('s-splash');
}

// ── Demo shortcut: tap role name to bypass PIN ──
function demoLogin(role) {
  loginAs(role);
}

// ── Populate add-employee site dropdown ──
function populateAddEmpDropdowns() {
  const siteEl = document.getElementById('new-emp-site');
  if (!siteEl) return;
  const sites = getSites();
  siteEl.innerHTML = sites.map(s => '<option value="' + s.name + '">' + s.name + '</option>').join('');
}
