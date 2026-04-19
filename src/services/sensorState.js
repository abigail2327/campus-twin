/**
 * sensorState.js — Phase 3
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for live sensor data.
 *
 * useLiveSensorState() is the main React hook — import it in any page that
 * needs sensor data. It subscribes to Firebase Realtime Database and returns
 * { sensorState, campusTime, loading } which update in real time.
 *
 * All pages that previously imported MOCK_SENSOR_STATE now call this hook.
 * The mock data is kept as FALLBACK_STATE — used when Firebase has no data
 * yet (e.g. before the seed script runs or sensors come online).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import {
    subscribeToTelemetry,
    subscribeToCampusClock,
} from './firebase';

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK / INITIAL STATE
// Used when Firebase has no data yet. Identical shape to what the Raspberry Pi
// will write — so the UI works identically with mock or live data.
// ─────────────────────────────────────────────────────────────────────────────

function hvacFromOccupancy(occ, maxOcc, hcs) {
    if (hcs === 'ON') return { damper_angle: 0, fan_speed_pct: 100 };
    const pct = occ / maxOcc;
    if (pct === 0)  return { damper_angle: 90, fan_speed_pct: 0   };
    if (pct < 0.5) return { damper_angle: 30, fan_speed_pct: 40  };
    return              { damper_angle: 0,  fan_speed_pct: 100 };
}

const lhHvac = hvacFromOccupancy(85, 100, 'AUTO');

export const FALLBACK_STATE = {
    Lobby_Reception: {
        node: null, lights: true, power_w: 43.6, occupancy: 8,
        max_occupancy: 50, temperature_c: 22.5, status: 'optimal',
        fire_alert: false, smoke: false,
    },
    Classroom_1: {
        node: 1, lss: 'ON', motion: true, power_w: 28.4,
        temperature_c: 23.1, lux: 420, los: null, lcs: 'AUTO',
        css: true, lights: true, occupancy: 24, max_occupancy: 30,
        status: 'optimal', fire_alert: false,
    },
    Classroom_2: {
        node: 2, lss: 'ON', ambient_dark: true, power_w: 38.7,
        temperature_c: 24.8, lux: 85, los: null, lcs: 'AUTO',
        css: true, lights: true, occupancy: 29, max_occupancy: 30,
        status: 'warning', fire_alert: false,
    },
    Large_Lecture_Hall: {
        node: 3, lss: 'ON', occupancy: 85, max_occupancy: 100,
        damper_angle: lhHvac.damper_angle, fan_speed_pct: lhHvac.fan_speed_pct,
        temperature_c: 25.8, co2_ppm: 1124, power_w: 148.2,
        los: null, lcs: 'AUTO', hcs: 'AUTO', lights: true,
        status: 'critical', fire_alert: false,
    },
    Lounge_Study: {
        node: null, lights: true, power_w: 58.4, occupancy: 18,
        max_occupancy: 20, temperature_c: 23.4, status: 'warning',
        fire_alert: false,
    },
    Computer_Lab: {
        node: 5, pc_power: true, active_pcs: 22, total_pcs: 30,
        led_strips: true, power_w: 8241.4, temperature_c: 22.1,
        humidity_pct: 48.2, css: true, lights: true, occupancy: 15,
        max_occupancy: 30, status: 'optimal', fire_alert: false,
        shutdown_warning: false,
    },
    Faculty_Office: {
        node: 4, faculty_present: false, fss: false, lights: false,
        power_w: 6.4, temperature_c: 21.8, occupancy: 0,
        max_occupancy: 3, status: 'optimal', fire_alert: false,
    },
    Control_Room: {
        node: null, lights: true, power_w: 22.1, occupancy: 3,
        max_occupancy: 5, temperature_c: 20.5, status: 'optimal',
        fire_alert: false,
    },
    Mechanical_Room: {
        node: 6, damper_angle: lhHvac.damper_angle,
        fan_speed_pct: lhHvac.fan_speed_pct,
        fan_active: lhHvac.fan_speed_pct > 0,
        power_w: 312.1, lights: false, status: 'optimal',
        fire_alert: false, smoke: false,
    },
};

// Keep MOCK_SENSOR_STATE as alias so old imports don't break during migration
export const MOCK_SENSOR_STATE = FALLBACK_STATE;
export const CAMPUS_TIME = 1015;

// ─────────────────────────────────────────────────────────────────────────────
// MERGE helper — merges live Firebase data with fallback defaults
// Ensures every room always has all required fields even if Firebase
// only sends partial data (e.g. just power_w and temperature_c)
// ─────────────────────────────────────────────────────────────────────────────
function mergeWithFallback(liveData) {
    const merged = {};
    Object.keys(FALLBACK_STATE).forEach(roomId => {
        merged[roomId] = {
            ...FALLBACK_STATE[roomId],           // start with all defaults
            ...(liveData[roomId] ?? {}),         // overlay live data
        };

        // Derive status from live sensor values if not explicitly set
        const r = merged[roomId];
        if (!liveData[roomId]?.status) {
            if (r.fire_alert || r.co2_ppm > 1000 || r.temperature_c > 27) {
                merged[roomId].status = 'critical';
            } else if (
                (r.occupancy && r.max_occupancy && r.occupancy / r.max_occupancy > 0.85) ||
                r.temperature_c > 25
            ) {
                merged[roomId].status = 'warning';
            } else {
                merged[roomId].status = 'optimal';
            }
        }

        // Derive HVAC state for Lecture Hall + Mechanical Room
        if (roomId === 'Large_Lecture_Hall' && liveData[roomId]?.occupancy != null) {
            const hvac = hvacFromOccupancy(
                r.occupancy, r.max_occupancy, r.hcs ?? 'AUTO'
            );
            merged[roomId].damper_angle  = r.damper_angle  ?? hvac.damper_angle;
            merged[roomId].fan_speed_pct = r.fan_speed_pct ?? hvac.fan_speed_pct;
        }
        if (roomId === 'Mechanical_Room') {
            const lh = merged.Large_Lecture_Hall;
            merged[roomId].damper_angle  = r.damper_angle  ?? lh?.damper_angle  ?? 90;
            merged[roomId].fan_speed_pct = r.fan_speed_pct ?? lh?.fan_speed_pct ?? 0;
            merged[roomId].fan_active    = (merged[roomId].fan_speed_pct ?? 0) > 0;
        }

        // Derive PC shutdown warning (within 30 min of 18:00)
        if (roomId === 'Computer_Lab') {
            const ct = merged[roomId].campus_clock ?? CAMPUS_TIME;
            merged[roomId].shutdown_warning = ct >= 1730 && ct < 1800 && r.pc_power;
            merged[roomId].pc_power = ct < 1800 ? r.pc_power : false;
        }
    });
    return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK — use in any page component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useLiveSensorState()
 *
 * Returns:
 *   sensorState  — merged live + fallback data for all 9 rooms
 *   campusTime   — live campus clock (HHMM integer)
 *   loading      — true until first Firebase snapshot arrives
 *   isLive       — true if receiving real Firebase data (false = fallback only)
 *
 * Usage:
 *   const { sensorState, campusTime, loading } = useLiveSensorState();
 */
export function useLiveSensorState() {
    const [sensorState, setSensorState] = useState(FALLBACK_STATE);
    const [campusTime,  setCampusTime]  = useState(CAMPUS_TIME);
    const [loading,     setLoading]     = useState(true);
    const [isLive,      setIsLive]      = useState(false);

    // Track if we've received real data
    const hasLiveData = useRef(false);

    useEffect(() => {
        // Subscribe to all room telemetry
        const unsubTelemetry = subscribeToTelemetry((liveData) => {
            // If Firebase returns empty object, stay on fallback
            if (!liveData || Object.keys(liveData).length === 0) {
                setLoading(false);
                return;
            }
            hasLiveData.current = true;
            setIsLive(true);
            setSensorState(mergeWithFallback(liveData));
            setLoading(false);
        });

        // Subscribe to campus clock
        const unsubClock = subscribeToCampusClock((time) => {
            setCampusTime(time);
        });

        // Timeout fallback — if no data in 5 seconds, use mock
        const timeout = setTimeout(() => {
            if (!hasLiveData.current) {
                setLoading(false);
            }
        }, 5000);

        return () => {
            unsubTelemetry();
            unsubClock();
            clearTimeout(timeout);
        };
    }, []);

    return { sensorState, campusTime, loading, isLive };
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED DATA HELPERS (unchanged — work with live or mock data)
// ─────────────────────────────────────────────────────────────────────────────

export function computeCampusKPIs(state) {
    const rooms      = Object.values(state);
    const totalPower = rooms.reduce((sum, r) => sum + (r.power_w ?? 0), 0);
    const totalOcc   = rooms.reduce((sum, r) => sum + (r.occupancy ?? 0), 0);
    const maxOcc     = rooms.reduce((sum, r) => sum + (r.max_occupancy ?? 0), 0);
    return {
        totalPower_w:   totalPower,
        totalPower_kw:  (totalPower / 1000).toFixed(2),
        totalOccupancy: totalOcc,
        maxOccupancy:   maxOcc,
        occupancyPct:   maxOcc ? Math.round((totalOcc / maxOcc) * 100) : 0,
        anyFire:        rooms.some(r => r.fire_alert),
        anySmoke:       rooms.some(r => r.smoke),
        criticalRooms:  rooms.filter(r => r.status === 'critical').length,
        warningRooms:   rooms.filter(r => r.status === 'warning').length,
    };
}

export function deriveAlerts(state, campusTime = CAMPUS_TIME) {
    const alerts = [];
    const ts = () => new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' });

    const lh   = state.Large_Lecture_Hall;
    const cr1  = state.Classroom_1;
    const cr2  = state.Classroom_2;
    const cl   = state.Computer_Lab;
    const mech = state.Mechanical_Room;

    if (lh?.temperature_c > 27)
        alerts.push({ id: 'n3-temp',   node: 3,      severity: 'critical', message: `Node 3: High Temp Alert — ${lh.temperature_c.toFixed(1)}°C in Lecture Hall`, time: ts() });
    if (lh?.co2_ppm > 1000)
        alerts.push({ id: 'n3-co2',    node: 3,      severity: 'critical', message: `Node 3: CO₂ Alert — ${lh.co2_ppm} ppm exceeds 1000 ppm safe limit`, time: ts() });
    if (lh?.occupancy >= (lh?.max_occupancy ?? 100) * 0.95)
        alerts.push({ id: 'n3-occ',    node: 3,      severity: 'warning',  message: `Node 3: Lecture Hall at full capacity (${lh?.occupancy}/${lh?.max_occupancy})`, time: ts() });
    if (cr1?.motion && !cr1?.css)
        alerts.push({ id: 'n1-motion', node: 1,      severity: 'warning',  message: 'Node 1: Motion detected in Classroom 1 — no class scheduled', time: ts() });
    if (cr2?.lights && !cr2?.css)
        alerts.push({ id: 'n2-lights', node: 2,      severity: 'warning',  message: 'Node 2: Classroom 2 lights ON with no class scheduled', time: ts() });
    if (campusTime >= 1800 && cl?.pc_power)
        alerts.push({ id: 'n5-unauth', node: 5,      severity: 'critical', message: 'Node 5: Unauthorized Lab Access — PCs active after 18:00', time: ts() });
    if (cl?.shutdown_warning)
        alerts.push({ id: 'n5-warn',   node: 5,      severity: 'warning',  message: 'Node 5: PC shutdown in less than 30 minutes (campus clock approaching 18:00)', time: ts() });

    Object.entries(state)
        .filter(([, r]) => r.fire_alert)
        .forEach(([roomId]) =>
            alerts.push({ id: `fire-${roomId}`, node: 'BLDG', severity: 'critical', message: `FIRE ALERT — ${roomId.replace(/_/g, ' ')} — Evacuate immediately`, time: ts() })
        );

    if (mech?.smoke)
        alerts.push({ id: 'smoke-bldg', node: 'BLDG', severity: 'critical', message: 'Building: Smoke Detected — Fire suppression activated', time: ts() });

    const kpi = computeCampusKPIs(state);
    if (kpi.totalPower_w > 15000)
        alerts.push({ id: 'power-high', node: 'BLDG', severity: 'warning', message: `Building: Total power load at ${kpi.totalPower_kw} kW — above threshold`, time: ts() });

    return alerts;
}