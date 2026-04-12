// src/components/panels/Sidebar.jsx
import { NavLink } from 'react-router-dom'

const NAV = [
    { to: '/',          icon: 'home',              label: 'Dashboard' },
    { to: '/building',  icon: 'domain',            label: 'Building Overview' },
    { to: '/rooms',     icon: 'meeting_room',      label: 'Rooms & Zones' },
    { to: '/devices',   icon: 'memory',            label: 'Device Twin' },
    { to: '/alerts',    icon: 'notifications',     label: 'Alerts' },
    { to: '/analytics', icon: 'bar_chart',         label: 'Analytics' },
]

export default function Sidebar() {
    return (
        <aside className="w-72 nav-gradient text-slate-400 flex flex-col shrink-0 h-full border-r border-slate-800/50">
            {/* Logo */}
            <div className="p-8">
                <h1 className="font-heading text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg">domain</span>
          </span>
                    <span>Smart<span className="text-primary">Twin</span></span>
                </h1>
                <p className="text-xs text-slate-500 mt-1 ml-10">RIT Dubai Campus</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1.5 mt-2">
                {NAV.map(({ to, icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3.5 rounded-custom transition-all text-sm font-medium
               ${isActive
                                ? 'bg-white/10 text-white font-semibold'
                                : 'hover:bg-white/5 hover:text-slate-200'
                            }`
                        }
                    >
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Emergency button */}
            <div className="px-6 mb-6">
                <button className="w-full flex items-center justify-center gap-2.5 px-4 py-4 emergency-gradient text-white rounded-custom shadow-xl shadow-red-950/40 hover:scale-[1.02] active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-xl">emergency</span>
                    <span className="font-bold text-sm tracking-wide">RAISE EMERGENCY</span>
                </button>
            </div>

            {/* Settings link */}
            <div className="p-4 border-t border-slate-800/80">
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3.5 rounded-custom transition-all text-sm font-medium
             ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-slate-200'}`
                    }
                >
                    <span className="material-symbols-outlined text-lg">settings</span>
                    Settings
                </NavLink>
            </div>
        </aside>
    )
}