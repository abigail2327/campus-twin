/**
 * firebase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — Full Firebase Realtime Database integration
 *
 * Database schema:
 *   /telemetry/{roomId}          → live sensor readings per room
 *   /signals/{roomId}            → DT→Node command signals (LOS, LCS, HCS, etc.)
 *   /campus_clock                → simulated campus time (HHMM integer)
 *   /alerts                      → active alert log
 *
 * Auth: Email/Password via Firebase Authentication
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp }                          from 'firebase/app';
import { getAuth, signInWithEmailAndPassword,
    signOut, onAuthStateChanged }            from 'firebase/auth';
import { getDatabase, ref, onValue, set,
    update, push, serverTimestamp, get }     from 'firebase/database';

// ── Firebase config (from .env.local) ─────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export async function loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
}

export async function logout() {
    await signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS (read) — each returns an unsubscribe function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL room telemetry in one call.
 * Callback receives: { Classroom_1: {...}, Large_Lecture_Hall: {...}, ... }
 * Falls back to MOCK_SENSOR_STATE shape if a room has no data yet.
 */
export function subscribeToTelemetry(callback) {
    const telRef = ref(db, 'telemetry');
    return onValue(telRef, (snap) => {
        const data = snap.val() ?? {};
        callback(data);
    });
}

/**
 * Subscribe to a single room's telemetry.
 */
export function subscribeToRoom(roomId, callback) {
    const roomRef = ref(db, `telemetry/${roomId}`);
    return onValue(roomRef, (snap) => {
        callback(snap.val() ?? {});
    });
}

/**
 * Subscribe to DT→Node signals for a room.
 */
export function subscribeToSignals(roomId, callback) {
    const sigRef = ref(db, `signals/${roomId}`);
    return onValue(sigRef, (snap) => {
        callback(snap.val() ?? {});
    });
}

/**
 * Subscribe to campus clock (HHMM integer).
 */
export function subscribeToCampusClock(callback) {
    const clockRef = ref(db, 'campus_clock');
    return onValue(clockRef, (snap) => {
        callback(snap.val() ?? 1015);
    });
}

/**
 * Subscribe to the active alert log.
 */
export function subscribeToAlerts(callback) {
    const alertRef = ref(db, 'alerts');
    return onValue(alertRef, (snap) => {
        const raw = snap.val();
        if (!raw) return callback([]);
        // Firebase stores as object — convert to array sorted by timestamp
        const list = Object.entries(raw)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
        callback(list);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITES — DT → Node signals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a sensor telemetry reading (used by the seed script / Raspberry Pi).
 * roomId: 'Classroom_1', 'Large_Lecture_Hall', etc.
 * data:   { temperature_c, occupancy, power_w, ... }
 */
export async function writeTelemetry(roomId, data) {
    await update(ref(db, `telemetry/${roomId}`), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Write a DT→Node control signal.
 * roomId:  'Classroom_1'
 * signals: { los: 'ON', lcs: 'AUTO', css: true }
 */
export async function writeSignals(roomId, signals) {
    await update(ref(db, `signals/${roomId}`), {
        ...signals,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Write campus clock (HHMM).
 */
export async function writeCampusClock(hhmm) {
    await set(ref(db, 'campus_clock'), hhmm);
}

/**
 * Push an alert to the log.
 */
export async function pushAlert(alert) {
    await push(ref(db, 'alerts'), {
        ...alert,
        ts: serverTimestamp(),
    });
}

/**
 * Dismiss / delete an alert by its key.
 */
export async function dismissAlert(alertId) {
    await set(ref(db, `alerts/${alertId}`), null);
}

/**
 * Write desired state for a device (Phase 3.5 controls).
 * Writes to /signals/{roomId}/{signalKey}
 */
export async function writeDesiredState(roomId, patch) {
    await update(ref(db, `signals/${roomId}`), {
        ...patch,
        updatedAt: serverTimestamp(),
    });
}

/**
 * One-time read of the full telemetry snapshot (for seeding checks).
 */
export async function getTelemetryOnce() {
    const snap = await get(ref(db, 'telemetry'));
    return snap.val() ?? {};
}