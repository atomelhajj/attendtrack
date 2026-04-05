# AttendTrack — Deployment Guide

## What you have
A complete Progressive Web App (PWA) that works on any phone or tablet.  
All three roles are built and functional: **Staff · Supervisor · Admin**

---

## Step 1 — Upload to a web host (15 minutes)

You need to put the files on a web server so employees can access them via a URL.

### Option A — Netlify (FREE, easiest, recommended)
1. Go to https://netlify.com and create a free account
2. Click **"Add new site" → "Deploy manually"**
3. Drag the entire `attendtrack` folder onto the upload area
4. Netlify gives you a URL like `https://attendtrack-abc123.netlify.app`
5. You can set a custom domain (e.g. `attend.yourcompany.com`) in site settings

### Option B — GitHub Pages (FREE)
1. Go to https://github.com and create a free account
2. Create a new repository called `attendtrack`
3. Upload all files from the `attendtrack` folder
4. Go to Settings → Pages → Source: main branch
5. Your app is live at `https://yourusername.github.io/attendtrack`

### Option C — Any web hosting (cPanel, etc.)
1. Upload all files to your `public_html` folder via FTP or File Manager
2. Make sure `index.html` is in the root

---

## Step 2 — Add to phone home screen

Once deployed, share the URL with your employees. They install it like this:

### Android (Chrome):
1. Open the URL in Chrome
2. Tap the **three-dot menu** → "Add to Home Screen"
3. Tap "Add" — the app icon appears on their home screen

### iPhone (Safari):
1. Open the URL in Safari (must be Safari, not Chrome on iOS)
2. Tap the **Share button** (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" — the app icon appears

---

## Step 3 — Set up your employees

1. Open the app and sign in as **Admin** (PIN: 9999)
2. Go to **Employees tab → "+ Add employee"**
3. Enter name, department, site, and a temporary PIN
4. Share the URL + PIN with each employee via WhatsApp

---

## Demo credentials

| Role | PIN |
|------|-----|
| Staff (Ahmed Khalil) | 1234 |
| Supervisor (Nour Al-Rashid) | 0000 |
| Admin | 9999 |

---

## Data storage

All attendance data is stored in the browser's **localStorage** on the device being used.

> **Important:** This means data is stored on the device. For a shared admin panel, the admin should always use the same device/browser.

### For a shared database (next step):
When you're ready to have all devices share the same data, a backend developer needs to add:
- A database (e.g. Firebase, Supabase — both have free tiers)
- An API layer (replace the `db.js` file with API calls)

This is a ~1–2 week job for a developer and the rest of the app stays exactly the same.

---

## File structure

```
attendtrack/
├── index.html          ← Main app (all screens)
├── manifest.json       ← PWA config
├── sw.js               ← Service worker (offline)
├── css/
│   └── app.css         ← All styles
├── js/
│   ├── db.js           ← Data layer (localStorage)
│   ├── auth.js         ← Login + utilities
│   ├── staff.js        ← Staff screens
│   ├── supervisor.js   ← Supervisor screens
│   ├── admin.js        ← Admin screens
│   └── app.js          ← Bootstrap + PIN keypad
└── icons/
    ├── icon-192.png    ← App icon (small)
    └── icon-512.png    ← App icon (large)
```

---

## Features included

- ✅ Clock in / clock out with timestamp
- ✅ Geo-fence status detection (GPS on real devices)
- ✅ Manual clock-in with flag for review
- ✅ Staff attendance history
- ✅ Supervisor team view, alerts, overrides, site report
- ✅ Admin live dashboard, employee management, reports, sites
- ✅ CSV payroll export
- ✅ PIN-based login (4 digits)
- ✅ Add / remove employees
- ✅ Offline support (service worker)
- ✅ Installable on iOS and Android
- ✅ Works on any modern browser

---

## Integration with your main app

The app is designed to be modular. To connect to your main application:

1. Replace `js/db.js` with API calls to your main app's backend
2. The function signatures stay the same — only the data source changes
3. Key endpoints needed:
   - `GET /employees` — list employees
   - `POST /clock-in` — record a clock-in
   - `PUT /clock-out/:id` — record a clock-out
   - `GET /records` — fetch attendance records
   - `GET /reports/monthly` — payroll summary

---

## Support

Built for: Cleaning · Pest Control · Hospitality · Disinfecting · Maintenance  
Designed by: Claude (Anthropic) — April 2026
