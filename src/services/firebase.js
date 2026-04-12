import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';

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

/** Sign in with email + password — throws on bad credentials */
export async function loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
}

/** Sign out the current user */
export async function logout() {
    await signOut(auth);
}

/** Subscribe to auth state changes — returns unsubscribe fn */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ── Realtime DB stubs (swap out in Phase 3) ───────────────────────────────────
export function subscribeToAllZones() {
    console.log('[STUB] Firebase subscribeToAllZones — wire up in Phase 3');
    return () => {};
}

export async function writeDesiredState(zoneId, patch) {
    console.log('[STUB] writeDesiredState', zoneId, patch);
}