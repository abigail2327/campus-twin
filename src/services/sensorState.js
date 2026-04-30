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
    subscribeToRooms,
    subscribeToTelemetry,
    subscribeToCampusClock,
    subscribeToPredictions,
} from './firebase';

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK / INITIAL STATE
// Mirrors the EXACT Firebase schema from real hardware.
// Sensor map:
//   Classroom_1        → motion (PIR, 0/1)
//   Classroom_2        → lux (LDR, analog)
//   Large_Lecture_Hall → temperature_c (DHT), fire_alert (potentiometer spike)
//   All rooms          → campus_power_w (INA219 central node)
// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK_STATE — only used for rooms that have no Firebase node at all
// The 3 active sensor rooms (Classroom_1, Classroom_2, Large_Lecture_Hall)
// must show OFFLINE if Firebase has no live data — never show fake values
const FALLBACK_STATE = {
    // Active sensor rooms — no fake values, status offline until Firebase delivers
    Classroom_1:        { status: 'offline', online: false },
    Classroom_2:        { status: 'offline', online: false },
    Large_Lecture_Hall: { status: 'offline', online: false },
    // Non-sensor rooms — always show as optimal (no node deployed)
    Mechanical_Room:    { status: 'optimal', online: true },
    Faculty_Office:     { status: 'optimal', online: true },
    Computer_Lab:       { status: 'optimal', online: true },
    Control_Room:       { status: 'optimal', online: true },
    Lobby_Reception:    { status: 'optimal', online: true },
    Lounge_Study:       { status: 'optimal', online: true },
};

// Keep MOCK_SENSOR_STATE as alias so old imports don't break
export const MOCK_SENSOR_STATE = FALLBACK_STATE;
export const CAMPUS_TIME = 1015;

// Active sensor rooms — these MUST come from Firebase live uplink
const SENSOR_ROOMS = new Set(['Classroom_1', 'Classroom_2', 'Large_Lecture_Hall']);

// ── MERGE helper ──────────────────────────────────────────────────────────────
// For active sensor rooms: only use live Firebase data. If no live data, mark
// as offline. Never inject fake sensor values.
// For non-sensor rooms: keep fallback defaults (they have no Arduino node).
function mergeWithFallback(liveData) {
    const merged = {};

    Object.keys(FALLBACK_STATE).forEach(roomId => {
        if (SENSOR_ROOMS.has(roomId)) {
            // Active sensor room — use ONLY what Firebase sends
            const live = liveData[roomId];
            if (!live || live.status === 'offline' || Object.keys(live).length === 0) {
                // No uplink received yet — show as offline, no fake values
                merged[roomId] = { status: 'offline', online: false };
            } else {
                // Live data received from LoRa → TTN → Ditto → Firebase pipeline
                merged[roomId] = { ...live };
                // Derive status from real sensor values
                if (!live.status || live.status === 'optimal') {
                    if (live.fire_alert || live.temperature_c > 35) {
                        merged[roomId].status = 'critical';
                    } else if (live.temperature_c > 28) {
                        merged[roomId].status = 'warning';
                    } else {
                        merged[roomId].status = 'optimal';
                    }
                }
            }
        } else {
            // Non-sensor room — no Arduino node, use fallback
            merged[roomId] = {
                ...FALLBACK_STATE[roomId],
                ...(liveData[roomId] ?? {}),
            };
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
        // Primary: subscribe to real twinergy/rooms/* schema
        const unsubRooms = subscribeToRooms((mappedData) => {
            if (!mappedData || Object.keys(mappedData).length === 0) return;
            hasLiveData.current = true;
            setIsLive(true);
            setSensorState(mergeWithFallback(mappedData));
            setLoading(false);
        });

        // Fallback: also watch legacy /telemetry path (for inference.py compatibility)
        const unsubTelemetry = subscribeToTelemetry((liveData) => {
            if (!liveData || Object.keys(liveData).length === 0) {
                setLoading(false);
                return;
            }
            // Only use if rooms subscription hasn't delivered data yet
            if (!hasLiveData.current) {
                hasLiveData.current = true;
                setIsLive(true);
                setSensorState(mergeWithFallback(liveData));
                setLoading(false);
            }
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
            unsubRooms();
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
    if (!state) return {
        totalPower_w: 0, totalPower_kw: '0.00',
        totalOccupancy: 0, maxOccupancy: 135, occupancyPct: 0,
        anyFire: false, criticalRooms: 0, warningRooms: 0,
        energyToday_kwh: 0, wasteToday_kwh: 0, wastePct: 0,
    };
    const rooms = Object.values(state);
    // Power comes from the single campus INA219 on Mechanical_Room
    const campusPower = state.Mechanical_Room?.campus_power_w ?? 0;
    const anyFire     = rooms.some(r => r.fire_alert);
    return {
        totalPower_w:   campusPower,
        totalPower_kw:  (campusPower / 1000).toFixed(2),
        totalOccupancy: 0,   // no occupancy sensor
        maxOccupancy:   135, // fixed campus capacity
        occupancyPct:   0,
        anyFire,
        criticalRooms:  rooms.filter(r => r.status === 'critical' || r.fire_alert).length,
        warningRooms:   rooms.filter(r => r.status === 'warning').length,
        energyToday_kwh: 0,
        wasteToday_kwh:  0,
        wastePct:        0,
    };
}

export function deriveAlerts(state, campusTime) {
    if (!state) return [];
    const alerts = [];
    const ts = () => {
        if (!campusTime) return '—';
        const s = String(campusTime).padStart(4,'0');
        return `${s.slice(0,2)}:${s.slice(2)} PM`;
    };

    const lh  = state.Large_Lecture_Hall ?? {};
    const cr1 = state.Classroom_1 ?? {};
    const cr2 = state.Classroom_2 ?? {};
    const mech= state.Mechanical_Room ?? {};

    // Fire alert — potentiometer spike in lecture hall
    if (lh.fire_alert)
        alerts.push({ id:'lh-fire', node:3, severity:'critical',
            message:'⚠ Fire Alert — Temperature spike detected in Lecture Hall', time: ts() });

    // High temperature in lecture hall
    if (lh.temperature_c > 35 && !lh.fire_alert)
        alerts.push({ id:'lh-temp', node:3, severity:'critical',
            message:`Node 3: High Temp — ${lh.temperature_c.toFixed(1)}°C exceeds 35°C threshold`, time: ts() });

    if (lh.temperature_c > 28 && lh.temperature_c <= 35)
        alerts.push({ id:'lh-temp-warn', node:3, severity:'warning',
            message:`Node 3: Temp Warning — ${lh.temperature_c.toFixed(1)}°C rising`, time: ts() });

    // Energy theft — power draw with no motion in Classroom 1
    if (cr1.motion === false && (mech.campus_power_w ?? 0) > 500)
        alerts.push({ id:'cr1-theft', node:1, severity:'warning',
            message:'Node 1: Energy anomaly — power draw with no motion detected', time: ts() });

    // Low lux in Classroom 2 during campus hours
    const hour = campusTime ? Math.floor(campusTime / 100) : 0;
    if (cr2.lux != null && cr2.lux < 80 && hour >= 8 && hour < 18)
        alerts.push({ id:'cr2-lux', node:2, severity:'warning',
            message:`Node 2: Low ambient light — ${cr2.lux} lx, LEDs at full brightness`, time: ts() });

    return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI PREDICTIONS — written by inference_server.py to Firebase /predictions
// ─────────────────────────────────────────────────────────────────────────────

// Fallback shown while inference_server.py warms up or is offline
const FALLBACK_PREDICTIONS = {
    Classroom_1: {
        occupancy_class: 1, occupancy_label: 'scheduled',
        energy_mode: 'auto', lighting: 1,
        override_needed: false, confidence: 0.94,
        probabilities: { empty: 0.03, scheduled: 0.94, unscheduled: 0.03 },
    },
    Classroom_2: {
        occupancy_class: 0, occupancy_label: 'empty',
        energy_mode: 'standby', lighting: 0,
        override_needed: false, confidence: 0.91,
        probabilities: { empty: 0.91, scheduled: 0.07, unscheduled: 0.02 },
    },
    Large_Lecture_Hall: {
        occupancy_class: 2, occupancy_label: 'unscheduled',
        energy_mode: 'auto', lighting: 1,
        override_needed: true, confidence: 0.88,
        probabilities: { empty: 0.05, scheduled: 0.07, unscheduled: 0.88 },
    },
};

/**
 * useAIPredictions()
 *
 * Subscribes to /predictions in Firebase (written every 5s by inference_server.py).
 * Falls back to mock predictions if the server hasn't written yet.
 *
 * Returns:
 *   predictions   — { Classroom_1: {...}, Classroom_2: {...}, Large_Lecture_Hall: {...} }
 *   aiLive        — true if receiving real predictions from inference_server.py
 *
 * Each prediction shape:
 *   occupancy_class   0=empty | 1=scheduled | 2=unscheduled
 *   occupancy_label   'empty' | 'scheduled' | 'unscheduled'
 *   energy_mode       'off' | 'eco' | 'standby' | 'auto'
 *   lighting          0 | 1
 *   override_needed   true when AI disagrees with schedule (UC-7 detection)
 *   confidence        0.0 – 1.0
 *   probabilities     { empty, scheduled, unscheduled }
 *
 * Usage:
 *   const { predictions, aiLive } = useAIPredictions();
 *   const lh = predictions.Large_Lecture_Hall;
 *   lh.override_needed  → true when common hour spike detected
 *   lh.occupancy_label  → 'unscheduled'
 *   lh.confidence       → 0.88
 */
export function useAIPredictions() {
    const [predictions, setPredictions] = useState(FALLBACK_PREDICTIONS);
    const [aiLive,      setAiLive]      = useState(false);

    useEffect(() => {
        const unsub = subscribeToPredictions((data) => {
            if (!data || Object.keys(data).length === 0) return;
            setPredictions(prev => ({ ...FALLBACK_PREDICTIONS, ...data }));
            setAiLive(true);
        });
        return () => unsub();
    }, []);

    return { predictions, aiLive };
}

/**
 * Helper badge configs for rendering prediction results.
 *
 * Usage:
 *   const badge = OCC_BADGE[predictions.Large_Lecture_Hall?.occupancy_class ?? 0];
 */
export const OCC_BADGE = {
    0: { label:'Empty',       color:'#64748b', bg:'bg-slate-100',  text:'text-slate-600'  },
    1: { label:'Scheduled',   color:'#2563eb', bg:'bg-blue-50',    text:'text-blue-700'   },
    2: { label:'Unscheduled', color:'#ef4444', bg:'bg-red-50',     text:'text-red-700'    },
};

export const ENERGY_BADGE = {
    off:     { label:'Off',     color:'#64748b', bg:'bg-slate-100',  text:'text-slate-500'  },
    eco:     { label:'Eco',     color:'#16a34a', bg:'bg-green-50',   text:'text-green-700'  },
    standby: { label:'Standby', color:'#f59e0b', bg:'bg-amber-50',   text:'text-amber-700'  },
    auto:    { label:'Active',  color:'#10b981', bg:'bg-emerald-50', text:'text-emerald-700'},
};

// computeDatasetKPIs and getHourlyForRoom are exported directly from datasetState.js