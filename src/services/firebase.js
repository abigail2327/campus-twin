/**
 * firebase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase Realtime Database integration
 *
 * Real Firebase schema (twinergy project):
 *   /twinergy/rooms/{roomId}/environment  → live sensor readings from Arduino
 *   /twinergy/rooms/{roomId}/attributes   → room metadata
 *   /twinergy/meta                        → sync status
 *
 * Field mapping from Firebase → Dashboard:
 *   classroom-1  → Classroom_1  (PIR: environment.active, css: environment.css)
 *   classroom-2  → Classroom_2  (lux: environment.ambient, pot: environment.pot)
 *   lecture-hall → Large_Lecture_Hall (temp: environment.active, fire: environment.pot)
 *
 * Simulation / downlink writes go to:
 *   /twinergy/rooms/{roomId}/environment  (same path, bidirectional)
 *
 * AI predictions (written by inference.py):
 *   /predictions/{roomId}
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp }                          from 'firebase/app';
import { getAuth, signInWithEmailAndPassword,
    signOut, onAuthStateChanged }            from 'firebase/auth';
import { getDatabase, ref, onValue, set,
    update, push, serverTimestamp, get }     from 'firebase/database';

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);

// ── Field mapper: Firebase room data → Dashboard sensor format ────────────────
// Handles the real schema at twinergy/rooms/{roomId}/environment
export function mapFirebaseRoom(roomId, roomData) {
    const env = roomData?.environment ?? {};
    const attr = roomData?.attributes ?? {};

    switch (roomId) {
        case 'classroom-1':
            return {
                status:    attr.status ?? 'optimal',
                // PIR — environment.active is occupancy count (>0 = motion)
                motion:    env.active != null ? env.active > 0 : null,
                occupancy: env.active ?? null,
                lights:    env.css ?? null,
                override:  env.override ?? false,
                _raw:      env,
            };
        case 'classroom-2':
            return {
                status:    attr.status ?? 'optimal',
                // LDR — environment.ambient is lux reading
                lux:       env.ambient ?? null,
                lights:    env.css ?? null,
                override:  env.override ?? false,
                pot:       env.pot ?? null,
                _raw:      env,
            };
        case 'lecture-hall':
            return {
                status:      attr.status ?? 'optimal',
                // Temperature — environment.active carries temp in lecture hall
                temperature_c: env.active ?? null,
                // Fire sim — potentiometer spike (>900 = fire alert threshold)
                fire_alert:  env.pot != null ? env.pot > 900 : false,
                pot:         env.pot ?? null,
                lights:      env.css ?? null,
                override:    env.override ?? false,
                _raw:        env,
            };
        default:
            return { status: 'optimal', _raw: env };
    }
}

// Dashboard room ID mapping (Firebase id → Dashboard id)
export const ROOM_ID_MAP = {
    'classroom-1':  'Classroom_1',
    'classroom-2':  'Classroom_2',
    'lecture-hall': 'Large_Lecture_Hall',
};
export const ROOM_ID_REVERSE = {
    'Classroom_1':        'classroom-1',
    'Classroom_2':        'classroom-2',
    'Large_Lecture_Hall': 'lecture-hall',
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
}
export async function logout() { await signOut(auth); }
export function onAuthChange(callback) { return onAuthStateChanged(auth, callback); }

// ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL live room data from twinergy/rooms/*.
 * Callback receives mapped sensor state:
 * { Classroom_1: { motion, lights, ... }, Classroom_2: { lux, ... }, ... }
 */
export function subscribeToRooms(callback) {
    const roomsRef = ref(db, 'twinergy/rooms');
    return onValue(roomsRef, (snap) => {
        const raw = snap.val() ?? {};
        const mapped = {};
        Object.entries(raw).forEach(([fbId, roomData]) => {
            const dashId = ROOM_ID_MAP[fbId];
            if (dashId) mapped[dashId] = mapFirebaseRoom(fbId, roomData);
        });
        callback(mapped);
    });
}

/**
 * Subscribe to a single room.
 */
export function subscribeToRoom(fbRoomId, callback) {
    const roomRef = ref(db, `twinergy/rooms/${fbRoomId}`);
    return onValue(roomRef, (snap) => {
        callback(mapFirebaseRoom(fbRoomId, snap.val() ?? {}));
    });
}

/**
 * Subscribe to the twinergy meta node (sync status).
 */
export function subscribeToMeta(callback) {
    const metaRef = ref(db, 'twinergy/meta');
    return onValue(metaRef, (snap) => callback(snap.val() ?? {}));
}

/**
 * Subscribe to AI predictions written by inference.py
 * Path: /predictions/{roomId}
 * Shape: { scenario_label, energy_mode, recommended_action,
 *           override_required, confidence, timestamp }
 */
export function subscribeToPredictions(callback) {
    const predRef = ref(db, 'predictions');
    return onValue(predRef, (snap) => callback(snap.val() ?? {}));
}

/**
 * Legacy: subscribe to flat /telemetry path (fallback if inference.py uses it)
 */
export function subscribeToTelemetry(callback) {
    const telRef = ref(db, 'telemetry');
    return onValue(telRef, (snap) => callback(snap.val() ?? {}));
}

/**
 * Subscribe to campus clock (HHMM integer).
 * Kept for backward compatibility with sensorState.js
 */
export function subscribeToCampusClock(callback) {
    const clockRef = ref(db, 'campus_clock');
    return onValue(clockRef, (snap) => {
        callback(snap.val() ?? 1015);
    });
}

/**
 * Write campus clock value.
 */
export async function writeCampusClock(hhmm) {
    await set(ref(db, 'campus_clock'), hhmm);
}

export function subscribeToAlerts(callback) {
    const alertRef = ref(db, 'alerts');
    return onValue(alertRef, (snap) => {
        const raw = snap.val();
        if (!raw) return callback([]);
        const list = Object.entries(raw)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
        callback(list);
    });
}

// ── WRITES (downlink: Dashboard → Arduino via Firebase) ───────────────────────

/**
 * Write a control signal to a room's environment.
 * This is the DOWNLINK — dashboard sends commands back to Arduino via Firebase.
 * dashRoomId: 'Classroom_1' | 'Classroom_2' | 'Large_Lecture_Hall'
 * patch: { css: true, override: false, ... }
 */
export async function writeRoomControl(dashRoomId, patch) {
    const fbId = ROOM_ID_REVERSE[dashRoomId];
    if (!fbId) return;
    await update(ref(db, `twinergy/rooms/${fbId}/environment`), {
        ...patch,
        _updatedAt: Date.now(),
    });
}

/**
 * writeSimulatedState — removed in production mode.
 * Arduino nodes write to Firebase directly via LoRa → TTN → Ditto → Firebase.
 * This stub is kept so existing imports don't break during transition.
 */
export async function writeSimulatedState(dashRoomId, sensorPatch) {
    console.warn('[SmartTwin] writeSimulatedState called but disabled in production mode.');
    return Promise.resolve();
}

/**
 * Write a DT→Node signal (legacy path for compatibility).
 */
export async function writeSignals(roomId, signals) {
    await update(ref(db, `signals/${roomId}`), {
        ...signals,
        updatedAt: serverTimestamp(),
    });
}

export async function pushAlert(alert) {
    await push(ref(db, 'alerts'), { ...alert, ts: serverTimestamp() });
}
export async function dismissAlert(alertId) {
    await set(ref(db, `alerts/${alertId}`), null);
}
export async function getTelemetryOnce() {
    const snap = await get(ref(db, 'twinergy/rooms'));
    return snap.val() ?? {};
}