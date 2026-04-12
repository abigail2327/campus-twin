import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { loginWithEmail } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/panels/Icon';

const ERROR_MESSAGES = {
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/too-many-requests':      'Too many attempts. Try again later.',
    'auth/user-disabled':          'This account has been disabled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
};

export default function Login() {
    const navigate          = useNavigate();
    const { user, loading } = useAuth();
    const [email,      setEmail]      = useState('');
    const [password,   setPassword]   = useState('');
    const [showPass,   setShowPass]   = useState(false);
    const [error,      setError]      = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!loading && user) return <Navigate to="/" replace />;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!email.trim()) return setError('Please enter your email.');
        if (!password)     return setError('Please enter your password.');
        setSubmitting(true);
        try {
            await loginWithEmail(email.trim(), password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(ERROR_MESSAGES[err.code] ?? 'Sign-in failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', 'Plus Jakarta Sans', sans-serif" }}>

            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
                 style={{ background: 'linear-gradient(150deg, #0f1729 0%, #0a1020 60%, #111827 100%)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                        <Icon name="layers" className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base tracking-tight">SmartTwin</p>
                        <p className="text-slate-500 text-[10px] uppercase tracking-widest">RIT Dubai</p>
                    </div>
                </div>

                <div>
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 text-[11px] font-semibold uppercase tracking-widest mb-6">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            Live Operations Platform
                        </div>
                        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                            Smart Campus<br />Digital Twin
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Real-time IoT monitoring, device management, and environmental control for RIT Dubai's campus infrastructure.
                        </p>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Zones',    value: '9'   },
                            { label: 'Devices',  value: '128' },
                            { label: 'Sensors',  value: '340' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl p-4 border border-white/5"
                                 style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <p className="text-2xl font-bold text-white">{s.value}</p>
                                <p className="text-slate-500 text-xs mt-0.5 uppercase tracking-wider">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-slate-600 text-xs uppercase tracking-widest">
                    Security Certified Platform · {new Date().getFullYear()}
                </p>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#f4f6f9]">
                <div className="w-full max-w-sm">

                    {/* Mobile logo */}
                    <div className="flex items-center gap-2.5 mb-8 lg:hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
                            <Icon name="layers" className="w-4 h-4 text-white" />
                        </div>
                        <p className="font-bold text-slate-800">SmartTwin · RIT Dubai</p>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
                        <p className="text-sm text-slate-500">Enter your administrator credentials to continue.</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                            <Icon name="exclamation" className="w-4 h-4 text-red-500 shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                Admin Email
                            </label>
                            <div className="relative">
                                <Icon name="mail" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" value={email}
                                       onChange={e => { setEmail(e.target.value); setError(''); }}
                                       placeholder="name@rit.edu"
                                       autoComplete="email" disabled={submitting}
                                       className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all disabled:opacity-60" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                                <button type="button" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <Icon name="lock" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type={showPass ? 'text' : 'password'} value={password}
                                       onChange={e => { setPassword(e.target.value); setError(''); }}
                                       placeholder="••••••••••"
                                       autoComplete="current-password" disabled={submitting}
                                       className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all disabled:opacity-60" />
                                <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    <Icon name="eye" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={submitting}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Authenticating…
                                </>
                            ) : 'Sign In to Dashboard'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-6">
                        Access is restricted to authorised RIT Dubai personnel.
                    </p>
                </div>
            </div>
        </div>
    );
}
