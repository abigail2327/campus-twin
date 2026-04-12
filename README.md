# SmartTwin — Smart Campus Digital Twin

> Real-time IoT monitoring and control dashboard for RIT Dubai's campus building.
> Built as a capstone project connecting physical Arduino/Raspberry Pi sensor nodes to an interactive 3D web dashboard via Firebase.

---

## Live Stats

| Rooms Monitored | IoT Nodes | Dashboard Pages | Dataset Rows |
|:-:|:-:|:-:|:-:|
| 9 | 6 | 8 | 235,881 |

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [IoT Nodes & Sensors](#iot-nodes--sensors)
- [Dashboard Pages](#dashboard-pages)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Firebase Configuration](#firebase-configuration)
- [Seeding the Database](#seeding-the-database)
- [Raspberry Pi Integration](#raspberry-pi-integration)
- [Development Phases](#development-phases)
- [Security](#security)

---

## Overview

SmartTwin is a digital twin of the RIT Dubai mini-campus building. It connects six IoT Arduino nodes (classrooms, lecture hall, computer lab, faculty office, mechanical room) through a Raspberry Pi gateway to Firebase Realtime Database, which the React dashboard subscribes to in real time.

The centrepiece is an interactive Three.js 3D model of the actual building — photorealistic exterior, transparent walls showing interiors, room colours driven by live sensor status, animated HVAC dampers and fans, and 30 individual computer workstations in the lab that glow green (in use) or red (idle).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| 3D Model | Three.js + @react-three/fiber + @react-three/drei |
| Charts | D3.js |
| Auth | Firebase Authentication (Email/Password) |
| Database | Firebase Realtime Database |
| IoT Hardware | Arduino Nodes + Raspberry Pi gateway |
| Power Monitoring | INA219 (on 12V bus, per room) |
| Font | DM Sans + DM Mono |

---

## System Architecture

```
[Arduino Node 1–6]
  PIR / lux / temp / CO₂ / INA219 / servo / fan
        |
        | serial / MQTT
        ↓
[Raspberry Pi — Edge Gateway]
  reads sensor packets → writes /telemetry/{roomId} to Firebase
  reads /signals/{roomId} from Firebase → forwards to Arduino
        |
        | Firebase Realtime Database
        ↓
[React Dashboard]
  useLiveSensorState() hook → onValue() subscription
  renders 3D model, KPI cards, alerts, charts
  writes /signals/{roomId} when operator sends a command
```

### Firebase Database Schema

```
/telemetry/{roomId}     ← live sensor readings (written by Raspberry Pi)
/signals/{roomId}       ← DT→Node commands (written by dashboard)
/campus_clock           ← simulated campus time, HHMM integer (e.g. 1430 = 14:30)
/alerts                 ← active alert log with severity, node, timestamp
```

---

## IoT Nodes & Sensors

### Node 1 — Classroom 1 · Motion-Activated Lighting

**Hardware:** PIR sensor, ambient lux sensor, temperature sensor, INA219, LED module

| Signal | Direction | Description |
|---|---|---|
| `LSS` | Node → DT | Actual light state (ON/OFF) |
| `motion` | Node → DT | PIR detection (TRUE/FALSE) |
| `power_w` | Node → DT | INA219 reading (Wh) |
| `LOS` | DT → Node | Light override signal (ON/OFF) |
| `LCS` | DT → Node | Light control mode (ON/AUTO) |
| `CSS` | DT → Node | Class scheduled (TRUE/FALSE) |

---

### Node 2 — Classroom 2 · Ambient-Light Lighting

**Hardware:** Ambient lux sensor (potentiometer sim), PIR, temperature, INA219, dimmable LED

Lights dim or switch off based on ambient lux thresholds. If `CSS = FALSE` (no class scheduled), lights turn off to conserve energy regardless of sensor values.

---

### Node 3 — Large Lecture Hall · Demand Controlled Ventilation

**Hardware:** Occupancy counter, temperature sensor, CO₂ air quality sensor, INA219, servo damper

| Occupancy | Damper Angle | Fan Speed | Reason |
|---|---|---|---|
| 0% (empty) | 90° (closed) | 0% | Maximum energy saving |
| < 50% | 30° (min position) | 40% | Fresh air without waste |
| ≥ 50% (full house) | 0° (fully open) | 100% | Max cooling for crowd heat + CO₂ |

If `HCS = ON`, damper is forced to 0° and fan to 100% regardless of occupancy.

---

### Node 4 — Faculty Office

**Hardware:** PIR, temperature sensor, INA219

| Signal | Direction | Description |
|---|---|---|
| `FSS` | DT → Node | Faculty Status Signal (TRUE/FALSE) |
| `power_w` | Node → DT | INA219 reading |

---

### Node 5 — Computer Lab · PC Shutdown After 18:00

**Hardware:** Temperature, humidity, active PC count, LED strips, INA219

| Signal | Direction | Description |
|---|---|---|
| `CC` | DT → Node | Campus Clock (HHMM, e.g. 1800 = 6PM) |
| `CSS` | DT → Node | Class scheduled (TRUE/FALSE) |
| `power_w` | Node → DT | INA219 — all PCs on 12V bus |

PCs auto-shutdown at `CC = 1800`. Dashboard shows a 30-minute warning. Unauthorised access after 18:00 triggers a critical alert.

---

### Node 6 — Mechanical Room · AHU Fan

**Hardware:** 12V DC fan, MOSFET controller, INA219

| Signal | Direction | Description |
|---|---|---|
| `damper_angle` | DT → Node | 0–90° (forwarded from Node 3) |
| `power_w` | Node → DT | AHU power consumption (INA219) |

---

## Dashboard Pages

| Route | Page | Description |
|---|---|---|
| `/` | Main Dashboard | KPI cards, 3D twin, live alert log, HVAC matrix, power breakdown |
| `/building` | Building & Rooms | 3D/floor-plan toggle, per-room sensor detail, sparkline charts |
| `/devices` | Device Twin | All 6 IoT nodes — reported vs desired state diff, signal direction |
| `/alerts` | Alerts | Real-time alert feed derived from sensor state, historical log, CSV export |
| `/analytics` | Analytics | D3 temperature chart, energy bar chart, occupancy heatmap |
| `/twin3d` | 3D Twin (Fullscreen) | Opens in a separate browser tab — no sidebar |
| `/login` | Login | Firebase email/password authentication |

---

## Project Structure

```
campus-twin/
├── src/
│   ├── services/
│   │   ├── firebase.js          ← Firebase init, auth, all DB subscriptions + writes
│   │   ├── sensorState.js       ← useLiveSensorState() hook, fallback data, KPI helpers
│   │   └── exportService.js     ← CSV export with injection sanitisation
│   ├── components/
│   │   └── panels/
│   │       ├── BuildingTwin3D.jsx  ← Three.js 3D model (exterior + interiors + furniture)
│   │       ├── Layout.jsx          ← Sidebar, topbar, emergency modal
│   │       ├── Icon.jsx            ← 50+ inline SVG icons (no emojis)
│   │       └── ProtectedRoute.jsx  ← Auth guard
│   ├── pages/
│   │   ├── Dashboard.jsx        ← Main dashboard with 3D twin centrepiece
│   │   ├── BuildingRooms.jsx    ← Building overview + rooms (merged page)
│   │   ├── DeviceTwin.jsx       ← IoT device management
│   │   ├── Alerts.jsx           ← Real-time alert log
│   │   ├── Analytics.jsx        ← D3 charts from 235K-row synthetic dataset
│   │   ├── Twin3DPage.jsx       ← Fullscreen 3D tab (no layout wrapper)
│   │   └── Login.jsx            ← Auth page
│   ├── context/
│   │   └── AuthContext.jsx      ← Firebase auth state provider
│   ├── main.jsx                 ← Routes
│   └── index.css                ← Global styles, DM Sans font, font-size bump
├── seedFirebase.js              ← One-time DB seed script (run once after setup)
├── serviceAccountKey.json       ← ⚠️ DO NOT COMMIT — Firebase admin key
└── .env.local                   ← ⚠️ DO NOT COMMIT — Firebase credentials
```

---

## Setup & Installation

### 1. Install dependencies

```bash
cd campus-twin
npm install

# Required for 3D model
npm install three @react-three/fiber @react-three/drei

# Required for analytics charts
npm install d3
```

### 2. Configure Firebase (see below)

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in.

---

## Firebase Configuration

### Step 1 — Create a web app

Firebase Console → your project → Project Settings → General → Your apps → `</>` Register app → copy the config object.

### Step 2 — Enable Authentication

Firebase Console → Authentication → Get started → Sign-in method → Email/Password → Enable → Save

Then go to Users → Add user → enter your email + password.

### Step 3 — Enable Realtime Database

Firebase Console → Realtime Database → Create database → Start in test mode → Enable

### Step 4 — Fill `.env.local`

Create `campus-twin/.env.local`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123...
```

> **Twinergy project values:**
> `AUTH_DOMAIN=twinergy-c8145.firebaseapp.com`
> `DATABASE_URL=https://twinergy-c8145-default-rtdb.firebaseio.com`
> `PROJECT_ID=twinergy-c8145`

### Step 5 — Restart the dev server

Vite does not hot-reload `.env.local` — a restart is required after any changes.

```bash
npm run dev
```

---

## Seeding the Database

Run once after enabling Realtime Database. This writes initial sensor values so the dashboard shows data immediately before real Arduino nodes come online.

```bash
# 1. Download service account key:
#    Firebase Console → Project Settings → Service accounts → Generate new private key
#    Save as serviceAccountKey.json in campus-twin/

# 2. Install admin SDK
npm install firebase-admin dotenv

# 3. Run the seed script
node seedFirebase.js
```

You should see:
```
✅  Seed complete! Your dashboard will now show live data.
```

---

## Raspberry Pi Integration

The Pi writes sensor data to Firebase and reads back control signals.

### Writing telemetry (Pi → Firebase)

```python
import firebase_admin
from firebase_admin import credentials, db
import time

cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://twinergy-c8145-default-rtdb.firebaseio.com'
})

# Write Classroom 1 telemetry
db.reference('telemetry/Classroom_1').update({
    'lss':           'ON',
    'motion':        True,
    'power_w':       28.4,
    'temperature_c': 23.1,
    'lux':           420,
    'lights':        True,
    'updatedAt':     int(time.time() * 1000)
})
```

### Reading control signals (Firebase → Pi → Arduino)

```python
def on_signal_change(event):
    data = event.data
    send_to_arduino(node=1, payload={
        'LOS': data.get('los'),
        'LCS': data.get('lcs'),
        'CSS': data.get('css'),
    })

db.reference('signals/Classroom_1').listen(on_signal_change)
```

### Room IDs (match exactly in Firebase paths)

```
Lobby_Reception
Classroom_1
Classroom_2
Large_Lecture_Hall
Lounge_Study
Computer_Lab
Faculty_Office
Control_Room
Mechanical_Room
```

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Scaffolding — Vite + React + Tailwind + Firebase + routing | ✅ Complete |
| Phase 2 | Three.js 3D Building Model — photorealistic exterior, interiors, furniture | ✅ Complete |
| Phase 4 | Full UI — all 8 pages, mature design, no emojis, SVG icons | ✅ Complete |
| Phase 5 | D3 Charts — temperature line, energy bar, occupancy heatmap | ✅ Complete |
| Phase 3 | Firebase Live Data — `useLiveSensorState()` hook, all pages wired | ✅ Complete |
| Phase 6 | CSV Pipeline — upload 235K-row synthetic dataset to Firebase | 🔲 Pending |
| Phase 3.5 | Controls — HVAC/lighting/PC write-back to Firebase `/signals` | 🔲 Pending |
| Phase 7 | Testing & Hardening — error boundaries, security rules, offline | 🔲 Pending |
| Phase 8 | Deployment — Firebase Hosting, production env, PWA manifest | 🔲 Pending |

---

## Security

> ⚠️ **Never commit `.env.local` or `serviceAccountKey.json` to version control.**
> Add both to `.gitignore` immediately.

### Current state (development)

- Realtime Database is in **test mode** — open read/write for 30 days
- All dashboard routes are protected by Firebase Authentication via `ProtectedRoute`
- CSV exports sanitise all cell values against formula injection (cells starting with `=`, `+`, `-`, `@` are prefixed with a tab)

### Production rules (Phase 7)

Replace test mode rules in Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "telemetry":    { ".read": "auth != null", ".write": "auth != null" },
    "signals":      { ".read": "auth != null", ".write": "auth != null" },
    "campus_clock": { ".read": "auth != null", ".write": "auth != null" },
    "alerts":       { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

---

## Emergency Contacts (built into dashboard)

| Service | Number |
|---|---|
| Dubai Police | 999 |
| Ambulance / Medical | 998 |
| Civil Defence (Fire) | 997 |
| RIT Dubai Admin | +971 4 371 2000 |

---

*RIT Dubai · Smart Campus Digital Twin · IoT Capstone 2025–2026*
*Dubai Silicon Oasis, Academic City, Dubai, UAE*