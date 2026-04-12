import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── DEV BYPASS ────────────────────────────────────────────────────────────────
// Set to true to skip login during development.
// Set back to false before going to production.
const BYPASS_AUTH = true;
// ─────────────────────────────────────────────────────────────────────────────

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    // Bypass: skip all auth checks and render the page directly
    if (BYPASS_AUTH) return children;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Loading…</p>
                </div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;

    return children;
}