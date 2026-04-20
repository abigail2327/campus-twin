import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Emergency contacts
// ─────────────────────────────────────────────────────────────────────────────
const EMERGENCY_CONTACTS = [
    { id: 'police',    label: 'Dubai Police',        number: '999',            dial: '999',           desc: 'General emergency & security',    color: 'bg-blue-700   hover:bg-blue-800',  border: 'border-blue-600'   },
    { id: 'ambulance', label: 'Ambulance / Medical',  number: '998',            dial: '998',           desc: 'Medical emergency services',       color: 'bg-red-700    hover:bg-red-800',   border: 'border-red-600'    },
    { id: 'fire',      label: 'Civil Defence',        number: '997',            dial: '997',           desc: 'Fire & rescue operations',          color: 'bg-orange-700 hover:bg-orange-800',border: 'border-orange-600' },
    { id: 'rit',       label: 'RIT Dubai Admin',      number: '+971 4 371 2000', dial: '+97143712000', desc: 'Campus emergency coordinator',      color: 'bg-slate-600  hover:bg-slate-700', border: 'border-slate-500'  },
];

function EmergencyModal({ onClose }) {
    const [calling, setCalling] = useState(null);

    function handleCall(c) {
        setCalling(c.id);
        setTimeout(() => {
            window.location.href = `tel:${c.dial}`;
            setTimeout(() => setCalling(null), 3000);
        }, 500);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-5 border-b border-red-200" style={{ background: 'linear-gradient(135deg,#b91c1c,#991b1b)' }}>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Icon name="exclamation" className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Emergency Response</h2>
                    </div>
                    <p className="text-red-200 text-sm ml-11">Select a service. Your device dialler will open immediately.</p>
                </div>

                {/* Contacts */}
                <div className="p-4 space-y-2.5 bg-slate-50">
                    {EMERGENCY_CONTACTS.map(c => (
                        <button key={c.id} onClick={() => handleCall(c)} disabled={!!calling}
                                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-white
                      transition-all active:scale-[0.98] disabled:opacity-60 border ${c.border} ${c.color} shadow-md`}>
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <Icon name="phone" className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold leading-tight">{c.label}</p>
                                <p className="text-white/60 text-xs mt-0.5">{c.desc}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                                {calling === c.id
                                    ? <div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                                    : <span className="font-mono text-sm font-bold text-white/90">{c.number}</span>
                                }
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-600">RIT Dubai, Dubai Silicon Oasis</p>
                        <p className="text-[11px] text-slate-400">Academic City, Dubai, UAE</p>
                    </div>
                    <button onClick={onClose}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav items
// ─────────────────────────────────────────────────────────────────────────────
const NAV = [
    { to: '/',          label: 'Dashboard',         icon: 'dashboard'  },
    { to: '/building',  label: 'Building Overview', icon: 'building'   },
    { to: '/devices',   label: 'Device Twin',       icon: 'device'     },
    { to: '/alerts',    label: 'Alerts',            icon: 'alerts',    badge: 3 },
    { to: '/analytics', label: 'Reports',           icon: 'analytics'  },
    { to: '/ontology',  label: 'Ontology',          icon: 'activity'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────
export default function Layout({ children, pageTitle = 'Dashboard' }) {
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const bg    = darkMode ? '#f4f6f9'     : '#ffffff';
    const mainBg = darkMode ? '#f4f6f9'   : '#f8faff';

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: mainBg }} style={{ fontFamily: "'DM Sans', 'Plus Jakarta Sans', sans-serif" }}>

            {/* ── Sidebar ── */}
            <aside className="w-60 flex flex-col shrink-0 h-full"
                   style={{ background: 'linear-gradient(175deg, #0f1729 0%, #0a1020 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

                {/* Logo */}
                <div className="px-5 pt-6 pb-5 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                             style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                            <Icon name="layers" className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white tracking-tight leading-none">SmartTwin</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">RIT Dubai</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    <p className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Navigation</p>
                    {NAV.map(item => (
                        <NavLink key={item.to} to={item.to} end={item.to === '/'}
                                 className={({ isActive }) =>
                                     `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-100 group relative
                       ${isActive
                                         ? 'bg-blue-600/15 text-blue-400'
                                         : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`
                                 }>
                            {({ isActive }) => (
                                <>
                                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r-full" />}
                                    <Icon name={item.icon} className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && (
                                        <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{item.badge}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Emergency */}
                <div className="px-3 pb-3">
                    <button onClick={() => setEmergencyOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-white text-[13px] font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98] border border-red-700/50"
                            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 4px 16px rgba(185,28,28,0.3)' }}>
                        <Icon name="exclamation" className="w-4 h-4 text-white" />
                        RAISE EMERGENCY
                    </button>
                </div>

                {/* Settings */}
                <div className="px-3 pb-5 border-t border-white/5 pt-3">
                    <NavLink to="/settings"
                             className={({ isActive }) =>
                                 `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all
                     ${isActive ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`
                             }>
                        <Icon name="settings" className="w-4 h-4" />
                        Settings
                    </NavLink>
                </div>
            </aside>

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Topbar */}
                <header className="h-14 flex items-center justify-between px-6 shrink-0 border-b border-slate-200/80"
                        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest">Smart Campus</span>
                        <Icon name="chevronRight" className="w-3 h-3 text-slate-300" />
                        <span className="text-sm font-bold text-slate-800">{pageTitle}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text" placeholder="Search facilities..."
                                   className="pl-8 pr-4 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48 transition-all" />
                        </div>
                        <button onClick={() => setDarkMode(d => !d)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border"
                                style={{ background: darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                                    borderColor: darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                    color: darkMode ? '#94a3b8' : '#64748b' }}>
                            {darkMode ? '☀ Light' : '🌙 Dark'}
                        </button>
                        <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm shadow-blue-600/20">
                            <Icon name="share" className="w-3.5 h-3.5" />
                            Share Report
                        </button>
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-700 leading-tight">Jane Doe</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Facility Admin</p>
                            </div>
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">JD</div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-5" style={{ background: mainBg }}>
                    {children}
                </main>
            </div>

            {emergencyOpen && <EmergencyModal onClose={() => setEmergencyOpen(false)} />}
        </div>
    );
}