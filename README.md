<div align="center">

<img src="https://img.shields.io/badge/RIT%20Dubai-Capstone%202026-CC0000?style=for-the-badge" />
<img src="https://img.shields.io/badge/Energy%20Saved-48.2%25-00C896?style=for-the-badge" />
<img src="https://img.shields.io/badge/AI%20Accuracy-89%25%20F1-6366F1?style=for-the-badge" />

# SmartTwin
## Smart Campus Digital Twin for Energy & Sustainability

*A fully actuated Cyber-Physical System that proactively predicts and shapes energy usage through autonomous, closed-loop optimization.*

---

[![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js_WebGL-black?style=flat-square&logo=three.js)](https://threejs.org)
[![Firebase](https://img.shields.io/badge/Firebase_RTDB-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Python](https://img.shields.io/badge/Python_3.x-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-FF6600?style=flat-square)](https://xgboost.readthedocs.io)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![LoRaWAN](https://img.shields.io/badge/LoRaWAN-TTN-4B0082?style=flat-square)](https://www.thethingsnetwork.org)
[![Eclipse Ditto](https://img.shields.io/badge/Eclipse_Ditto-2C2255?style=flat-square)](https://eclipse.dev/ditto)

</div>

---

## What is SmartTwin

SmartTwin is a low-cost, modular Smart Campus Digital Twin developed as a Senior Capstone Project at RIT Dubai. It integrates real-time IoT sensor data from three Arduino MKR WAN 1310 nodes with an AI-driven inference engine and a live Three.js WebGL dashboard — all synchronized through Firebase Realtime Database via Eclipse Ditto.

The system moves beyond passive monitoring to implement **fully actuated, closed-loop control** of lighting and HVAC systems, while providing 30-minute occupancy forecasting, fire spike anomaly detection, and energy theft detection.

It directly supports the **UAE Net-Zero 2050 initiative** and **Dubai's Clean Energy Strategy**.

---

## Validated Results

| Metric | Target | Achieved |
|---|---|---|
| Energy reduction vs baseline | 20–25% | **48.2%** |
| AI model accuracy (F1-score) | > 85% | **89%** |
| Fire spike detection rate | — | **95% TPR** |
| Energy theft detection rate | — | **96% TPR** |
| End-to-end pipeline latency | < 3 seconds | **< 3 seconds** |
| LoRaWAN packet delivery | > 95% | **> 95%** |
| Daily energy saving | — | **41.04 kWh/day** |

---

## System Architecture

```
  [Arduino Node 1]  [Arduino Node 2]  [Arduino Node 3]
   PIR / INA219      LDR Ambient       DHT / Pot / Fan
        |                 |                  |
        +------------ LoRa Radio ------------+
                          |
               The Things Network (TTN)
                          |
                   MQTT / Mosquitto
                          |
                   Eclipse Ditto
               (reported vs desired state)
                          |
               Firebase Realtime Database
                /                    \
        predict.py               React Dashboard
        (every 15 min)           Three.js 3D model
        XGBoost + RF             Live sensor uplink
              |                        |
        /predictions/*    Spike panel + power graph
```

---

## Nodes

| Node | Room | Sensors | Function |
|---|---|---|---|
| **Node 1** | Classroom A | PIR motion · INA219 power | Occupancy detection · power metering |
| **Node 2** | Classroom B | LDR ambient light | Adaptive LED dimming via daylight harvesting |
| **Node 3** | Multipurpose Hall | DHT temperature · potentiometer | HVAC Cube Law control · fire spike detection · 30-min occupancy forecast |

---

## Repository Structure

```
smarttwin/
|
├── campus-twin/                    # React + Vite frontend
|   ├── src/
|   |   ├── pages/
|   |   |   ├── Dashboard.jsx       # Live dashboard — uplink + spike panel + power graph
|   |   |   ├── SimulationTab.jsx   # Simulator — trained data + inline AI predictions
|   |   |   ├── ScheduleManager.jsx # Upload timetable Excel → Firebase schedule/*
|   |   |   ├── Alerts.jsx
|   |   |   ├── Analytics.jsx
|   |   |   └── OntologyGraph.jsx
|   |   ├── components/panels/
|   |   |   ├── BuildingTwin3D.jsx  # Three.js WebGL 3D building model
|   |   |   └── PowerGraph.jsx      # Live INA219 power consumption chart
|   |   ├── services/
|   |   |   ├── firebase.js         # Subscriptions + mapFirebaseRoom()
|   |   |   ├── sensorState.js      # useLiveSensorState() hook
|   |   |   └── trainedSimData.js   # Pre-aggregated CSV for simulator
|   |   └── context/
|   |       └── ThemeContext.jsx
|   ├── .env.local.example
|   └── package.json
|
├── smartcampus-ai/                 # Python AI and bridge layer
|   ├── inference.py                # AI brain — pure function, no Firebase, no loop
|   ├── predict.py                  # Glue — reads Firebase, runs model, writes predictions
|   ├── train.py                    # Train XGBoost + Random Forest ensemble
|   ├── bridge.py                   # TTN MQTT → Mosquitto → Eclipse Ditto bridge
|   ├── firebase_sync.py            # Eclipse Ditto → Firebase sync
|   ├── classroom_downlink.py       # Downlink commands → Classroom nodes
|   ├── d_to_t.py                   # Downlink commands → Hall node
|   ├── downlink_schedule.py        # Timetable-based class_active downlink
|   ├── reset_ditto.py              # Reset stale Ditto state (run before cold start)
|   ├── model/
|   |   └── building_brain_v2.pkl   # Trained ensemble — not in repo, run train.py
|   └── data/
|       └── campus_sensor_data_v2.csv  # 17,280-row training dataset
|
└── README.md
```

---

## Dashboard

### Live Dashboard
- **3D building model** — Three.js WebGL, colour-coded room states, click any room for live sensor panel
- **30-min occupancy spike panel** — reads `predictions/lecture-hall/spike_in_30min` from Firebase (written by `predict.py`)
- **Live power graph** — streams `energy.powerDraw` from Firebase in real time (INA219, Node 1)
- **Node cards** — Classroom A (binary PIR), Classroom B (ambient lux), Multipurpose Hall (temperature)

### Simulator tab
- Interactive 24h timeline — click or scrub any hour to see trained occupancy from `campus_sensor_data_v2.csv`
- Day selector Mon–Fri, play/pause with 1x–8x speed
- Per-room AI prediction cards — live from `/predictions/*` when `predict.py` is running
- Manual override controls (binary toggle for PIR rooms, headcount slider for Hall)

### Schedule Manager
- Drag and drop `.xlsx` timetable → parsed → pushed to `schedule/{roomId}/slots` in Firebase
- `predict.py` reads `schedule/*` every cycle to determine `class_scheduled` input feature
- Accepted columns: `room`, `seconds_from_start`, `scheduled` (or `day`/`start`/`end`/`course`)

---

## Firebase Schema

```json
{
  "twinergy": {
    "rooms": {
      "classroom-1": {
        "occupancy": { "pir": 0, "actual": false },
        "lighting":  { "light": 65, "status": "off" },
        "energy":    { "powerDraw": 2327 }
      },
      "classroom-2": {
        "environment": { "ambient": 504, "brightness": 151, "css": true }
      },
      "lecture-hall": {
        "environment": { "temperature": 22, "fireDetected": false, "campusMode": "AUTO" },
        "occupancy":   { "actual": 100 },
        "energy":      { "fanSpeed": 100 }
      }
    }
  },
  "predictions": {
    "lecture-hall": { "spike_in_30min": 1, "predicted_at": "2026-05-01T12:38:57" }
  },
  "schedule": {
    "classroom-1": {
      "slots": {
        "slot_0": { "day": 1, "start": 900, "end": 955, "course": "CS-101" }
      }
    }
  }
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker (Eclipse Ditto)
- Mosquitto MQTT broker
- The Things Network account — 3 devices registered
- Firebase project with Realtime Database enabled

### Frontend

```bash
cd campus-twin
npm install three @react-three/fiber @react-three/drei
npm install firebase react-router-dom tailwindcss xlsx

cp .env.local.example .env.local
# Fill in your Firebase credentials

npm run dev
# Open http://localhost:5173
```

### Python

```bash
cd smartcampus-ai
pip install firebase-admin pandas joblib xgboost scikit-learn

# Mac only — required before xgboost can load
brew install libomp

# Get your service account key:
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# Save as: smartcampus-ai/serviceAccountKey.json
```

### Environment Variables

Create `campus-twin/.env.local`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> Never commit `.env.local` or `serviceAccountKey.json`. Both are in `.gitignore`.

---

## Cold Start Sequence

Run each step in a separate terminal, keep all running simultaneously:

```bash
# 1 — Start Eclipse Ditto
cd ~/ditto-official/deployment/
docker compose up -d

# 2 — Start Mosquitto
mosquitto -c /etc/mosquitto/mosquitto.conf

# 3 — LoRa packet forwarder (on Raspberry Pi)
ssh campususer@<pi_ip>
sudo ./lora_pkt_fwd

# 4 — TTN → Mosquitto → Ditto bridge
python3 bridge.py

# 5 — Ditto → Firebase sync
python3 firebase_sync.py

# 6 — Downlink scripts
python3 d_to_t.py               # Multipurpose Hall
python3 classroom_downlink.py   # Classrooms 1 and 2

# 7 — Schedule simulator
python3 downlink_schedule.py

# 8 — Reset stale Ditto state (run once on each cold start)
python3 reset_ditto.py

# 9 — AI predictions (runs every 15 minutes)
python3 predict.py

# 10 — Frontend dashboard
cd campus-twin && npm run dev
```

---

## AI Model

The Building Brain is an **XGBoost + Random Forest VotingClassifier** trained on 17,280 synthetic records modelled after the RIT Dubai timetable and UAE climate patterns.

```bash
# Retrain the model
cd smartcampus-ai
python3 train.py
# Outputs: model/building_brain_v2.pkl
```

**Occupancy detection rules — identical in `train.py` and `predict.py`:**

```
Classroom_1  →  pir_motion > 0
Classroom_2  →  lux_bh1750 > 50
Lecture_Hall →  potentiometer > 20
```

**Features:** `hour` · `day_of_week` · `class_scheduled` · `ina219_power_ma` · room one-hot encoding · `occ_lag_1/2/3` (15 / 30 / 45 min history)

> `building_brain_v2.pkl` is excluded from the repository due to file size. Run `train.py` to regenerate it, or request it from the project team.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18, Vite |
| Styling | Tailwind CSS |
| 3D visualization | Three.js, @react-three/fiber, @react-three/drei |
| Realtime database | Firebase Realtime Database |
| Digital twin middleware | Eclipse Ditto |
| MQTT broker | Mosquitto |
| LoRaWAN network | The Things Network (TTN) v3 |
| Edge hardware | Arduino MKR WAN 1310 |
| Edge gateway | Raspberry Pi 5 |
| AI / ML | XGBoost, scikit-learn Random Forest |
| Data pipeline | pandas, numpy, joblib |
| Server-side Firebase | firebase-admin (Python) |
| Excel parsing | SheetJS (xlsx) |

---

## Security Notes

- All LoRaWAN communication uses native AES-128 encryption
- Firebase security rules restrict write access by path (`reported` vs `desired` state)
- Each Arduino node has unique TTN credentials (DevEUI / AppKey)
- Service account keys and `.env.local` are excluded from version control via `.gitignore`
- No personally identifiable information is collected — occupancy is determined from motion, light, and temperature signals only

---

## Acknowledgements

**Faculty Mentors:** Dr. Mohamed Abdelraheem · Dr. Ahmed Mostafa

**Fabrication support:** RIT Dubai Mechanical Workshop (3D printing, structural assembly).

**Course:** ISTE-501/502 Senior Development Project · Department of Electrical Engineering & Computing Sciences · RIT Dubai · 2025–2026

---

<div align="center">

**UAE Net-Zero 2050 &nbsp;·&nbsp; Dubai Clean Energy Strategy &nbsp;·&nbsp; RIT Dubai &nbsp;·&nbsp; May 2026**

</div>
