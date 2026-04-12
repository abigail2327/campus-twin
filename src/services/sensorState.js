/**
 * sensorState.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all IoT node sensor data across every page.
 *
 * Structure mirrors the Firebase Realtime Database schema:
 *   /telemetry/{roomId}/latest → { ...sensor fields }
 *   /signals/{roomId} → { LOS, LCS, HCS, CSS, FSS, CC, ... }
 *   /alerts → [ { id, node, type, message, ts } ]
 *
 * Phase 3 swap: replace MOCK_SENSOR_STATE with:
 *   import { ref, onValue } from 'firebase/database';
 *   onValue(ref(db, 'telemetry'), snap => setSensorState(snap.val()));
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Campus simulated clock (HHMM format, e.g. 1430 = 14:30)
export const CAMPUS_TIME = 1015; // 10:15 AM — mid-morning class session

// Derive HVAC state from occupancy (Node 3 logic)
function hvacFromOccupancy(occ, maxOcc, hcs) {
    if (hcs === 'ON') return { damper_angle: 0, fan_speed_pct: 100 };
    const pct = occ / maxOcc;
    if (pct === 0)    return { damper_angle: 90, fan_speed_pct: 0   };
    if (pct < 0.5)   return { damper_angle: 30, fan_speed_pct: 40  };
    return               { damper_angle: 0,  fan_speed_pct: 100 };
}

const lhHvac = hvacFromOccupancy(85, 100, 'AUTO');

// ── MOCK SENSOR STATE ─────────────────────────────────────────────────────────
// Each key = roomId matching floor plan + Firebase path
export const MOCK_SENSOR_STATE = {

    // ── Lobby / Reception (no IoT node — passive monitoring) ──────────────────
    Lobby_Reception: {
        node:         null,
        lights:       true,
        power_w:      43.6,
        occupancy:    8,
        max_occupancy:50,
        temperature_c:22.5,
        status:       'optimal',
        fire_alert:   false,
        smoke:        false,
    },

    // ── Classroom 1 — Node 1 (Motion-activated lighting, PIR + lux + temp) ───
    Classroom_1: {
        node:         1,
        // Signals OUT (Node → DT)
        lss:          'ON',          // Digital Light State Signal
        motion:       true,          // PIR detected
        power_w:      28.4,          // INA219 reading
        temperature_c:23.1,
        lux:          420,           // ambient lux reading
        // Signals IN (DT → Node) — what DT is currently commanding
        los:          null,          // null = no override active
        lcs:          'AUTO',        // listening to sensor
        css:          true,          // class scheduled
        // Derived
        lights:       true,
        occupancy:    24,
        max_occupancy:30,
        status:       'optimal',
        fire_alert:   false,
    },

    // ── Classroom 2 — Node 2 (Ambient lux-based lighting) ────────────────────
    Classroom_2: {
        node:         2,
        lss:          'ON',
        ambient_dark: true,          // below 2nd lux threshold → lights needed
        power_w:      38.7,
        temperature_c:24.8,
        lux:          85,            // low ambient → lights ON
        los:          null,
        lcs:          'AUTO',
        css:          true,
        lights:       true,
        occupancy:    29,
        max_occupancy:30,
        status:       'warning',     // near capacity
        fire_alert:   false,
    },

    // ── Large Lecture Hall — Node 3 (DCV + HVAC servo) ───────────────────────
    Large_Lecture_Hall: {
        node:         3,
        lss:          'ON',
        occupancy:    85,
        max_occupancy:100,
        damper_angle: lhHvac.damper_angle,   // 0° = fully open
        fan_speed_pct:lhHvac.fan_speed_pct,  // 100%
        temperature_c:25.8,
        co2_ppm:      1124,                  // air quality sensor
        power_w:      148.2,
        los:          null,
        lcs:          'AUTO',
        hcs:          'AUTO',
        lights:       true,
        status:       'critical',    // near-full + high CO2
        fire_alert:   false,
    },

    // ── Lounge / Study Area (no IoT node) ─────────────────────────────────────
    Lounge_Study: {
        node:         null,
        lights:       true,
        power_w:      58.4,
        occupancy:    18,
        max_occupancy:20,
        temperature_c:23.4,
        status:       'warning',     // near capacity
        fire_alert:   false,
    },

    // ── Computer Lab — Node 5 (PC shutdown after 18:00) ──────────────────────
    Computer_Lab: {
        node:         5,
        pc_power:     true,          // PCs still ON (time < 18:00)
        active_pcs:   22,            // active computer count
        total_pcs:    30,            // total workstations in lab
        led_strips:   true,          // LED strips active
        power_w:      8241.4,        // high — all PCs running
        temperature_c:22.1,
        humidity_pct: 48.2,
        campus_clock: CAMPUS_TIME,   // CC signal from DT
        css:          true,
        lights:       true,
        occupancy:    15,
        max_occupancy:30,
        status:       'optimal',
        fire_alert:   false,
        shutdown_warning: false,     // true when CC approaches 1800
    },

    // ── Faculty Office — Node 4 ───────────────────────────────────────────────
    Faculty_Office: {
        node:         4,
        faculty_present: false,      // PIR / manual FSS
        fss:          false,         // Faculty Status Signal
        lights:       false,         // off — no faculty
        power_w:      6.4,           // standby power
        temperature_c:21.8,
        occupancy:    0,
        max_occupancy:3,
        status:       'optimal',
        fire_alert:   false,
    },

    // ── Control Room (no IoT node) ────────────────────────────────────────────
    Control_Room: {
        node:         null,
        lights:       true,
        power_w:      22.1,
        occupancy:    3,
        max_occupancy:5,
        temperature_c:20.5,
        status:       'optimal',
        fire_alert:   false,
    },

    // ── Mechanical Room — Node 6 (AHU fan + damper) ──────────────────────────
    Mechanical_Room: {
        node:         6,
        // Receives damper_angle from Node 3 via DT
        damper_angle: lhHvac.damper_angle,
        fan_speed_pct:lhHvac.fan_speed_pct,
        fan_active:   lhHvac.fan_speed_pct > 0,
        power_w:      312.1,         // AHU power (INA219 on 12V bus)
        lights:       false,
        status:       'optimal',
        fire_alert:   false,
        smoke:        false,         // building-wide smoke detector
    },
};

// ── Derived campus-wide KPIs ──────────────────────────────────────────────────
export function computeCampusKPIs(state) {
    const rooms     = Object.values(state);
    const totalPower= rooms.reduce((sum, r) => sum + (r.power_w ?? 0), 0);
    const totalOcc  = rooms.reduce((sum, r) => sum + (r.occupancy ?? 0), 0);
    const maxOcc    = rooms.reduce((sum, r) => sum + (r.max_occupancy ?? 0), 0);
    const anyFire   = rooms.some(r => r.fire_alert);
    const anySmoke  = rooms.some(r => r.smoke);
    const critCount = rooms.filter(r => r.status === 'critical').length;
    const warnCount = rooms.filter(r => r.status === 'warning').length;

    return {
        totalPower_w:  totalPower,
        totalPower_kw: (totalPower / 1000).toFixed(2),
        totalOccupancy:totalOcc,
        maxOccupancy:  maxOcc,
        occupancyPct:  Math.round((totalOcc / maxOcc) * 100),
        anyFire,
        anySmoke,
        criticalRooms: critCount,
        warningRooms:  warnCount,
    };
}

// ── Alert log derived from sensor state ───────────────────────────────────────
export function deriveAlerts(state, campusTime = CAMPUS_TIME) {
    const alerts = [];
    const ts = () => new Date().toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' });

    const lh  = state.Large_Lecture_Hall;
    const cr1 = state.Classroom_1;
    const cr2 = state.Classroom_2;
    const cl  = state.Computer_Lab;
    const mech= state.Mechanical_Room;

    if (lh?.temperature_c > 27)
        alerts.push({ id:'n3-temp',  node:3, severity:'critical', message:`Node 3: High Temp Alert — ${lh.temperature_c.toFixed(1)}°C in Lecture Hall`, time:ts() });

    if (lh?.co2_ppm > 1000)
        alerts.push({ id:'n3-co2',   node:3, severity:'critical', message:`Node 3: CO₂ Alert — ${lh.co2_ppm} ppm exceeds 1000 ppm safe limit`,          time:ts() });

    if (lh?.occupancy >= lh?.max_occupancy * 0.95)
        alerts.push({ id:'n3-occ',   node:3, severity:'warning',  message:`Node 3: Lecture Hall at full capacity (${lh.occupancy}/${lh.max_occupancy})`,  time:ts() });

    if (cr1?.motion && !cr1?.css)
        alerts.push({ id:'n1-motion',node:1, severity:'warning',  message:'Node 1: Motion detected in Classroom 1 — no class scheduled',                  time:ts() });

    if (cr2?.lights && !cr2?.css)
        alerts.push({ id:'n2-lights',node:2, severity:'warning',  message:'Node 2: Classroom 2 lights ON with no class scheduled',                        time:ts() });

    if (campusTime >= 1800 && cl?.pc_power)
        alerts.push({ id:'n5-unauth',node:5, severity:'critical', message:'Node 5: Unauthorized Lab Access — PCs active after 18:00',                     time:ts() });

    if (campusTime >= 1800 && !cl?.pc_power === false)
        alerts.push({ id:'n5-pcs',   node:5, severity:'info',     message:'Node 5: PCs automatically shut down (campus clock: 18:00)',                    time:ts() });

    const anyFire = Object.entries(state).filter(([,r]) => r.fire_alert);
    anyFire.forEach(([roomId]) =>
        alerts.push({ id:`fire-${roomId}`, node:'BLDG', severity:'critical', message:`FIRE ALERT — ${roomId.replace(/_/g,' ')} — Evacuate immediately`,   time:ts() })
    );

    if (mech?.smoke)
        alerts.push({ id:'smoke-bldg', node:'BLDG', severity:'critical', message:'Building: Smoke Detected — Fire suppression activated',                  time:ts() });

    const kpi = computeCampusKPIs(state);
    if (kpi.totalPower_w > 15000)
        alerts.push({ id:'power-high', node:'BLDG', severity:'warning',  message:`Building: Total power load at ${kpi.totalPower_kw} kW — above threshold`, time:ts() });

    return alerts;
}