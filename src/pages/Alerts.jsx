import { useState, useMemo } from 'react';
import { Icon } from '../components/panels/Icon';
import { exportAlertLog } from '../services/exportService';
import { MOCK_SENSOR_STATE, deriveAlerts, CAMPUS_TIME } from '../services/sensorState';

// ── MOCK DATA (replace with Firebase subscription in Phase 3) ────────────────
// Active alerts are derived from the live sensor state — no separate mock needed.
// Phase 3: pass Firebase sensorState into deriveAlerts() in real time.

const INITIAL_DERIVED = deriveAlerts(MOCK_SENSOR_STATE, CAMPUS_TIME);

// Static historical event log (will come from Firebase /alertLog in Phase 3)
const EVENT_LOG = [
    { id:1,  ts:'2026-03-23 10:12:45', level:'critical', event:'CO₂ Levels High',              source:'Large Lecture Hall (Node 3)', ack:'unacknowledged' },
    { id:2,  ts:'2026-03-23 09:58:12', level:'warning',  event:'Temperature Fluctuation',       source:'Lecture Hall (Node 3)',        ack:'acknowledged'   },
    { id:3,  ts:'2026-03-23 09:30:05', level:'info',     event:'Fan Speed Changed to 100%',     source:'Mechanical Room (Node 6)',     ack:'resolved'       },
    { id:4,  ts:'2026-03-23 09:15:33', level:'info',     event:'Damper Fully Open (0°)',         source:'Lecture Hall AHU (Node 3)',    ack:'resolved'       },
    { id:5,  ts:'2026-03-23 08:47:01', level:'warning',  event:'Near Full Capacity',             source:'Lecture Hall (Node 3)',        ack:'acknowledged'   },
    { id:6,  ts:'2026-03-23 08:12:44', level:'critical', event:'Motion Detected After Hours',   source:'Classroom 1 (Node 1)',         ack:'resolved'       },
    { id:7,  ts:'2026-03-23 07:55:22', level:'info',     event:'Campus Clock Reset to 07:00',   source:'Digital Twin (DT)',            ack:'resolved'       },
    { id:8,  ts:'2026-03-22 18:03:09', level:'critical', event:'Unauthorized Lab Access',       source:'Computer Lab (Node 5)',        ack:'resolved'       },
    { id:9,  ts:'2026-03-22 18:00:00', level:'info',     event:'PC Automatic Shutdown Triggered',source:'Computer Lab (Node 5)',       ack:'resolved'       },
    { id:10, ts:'2026-03-22 17:45:33', level:'warning',  event:'LED Strips ON — No Class',      source:'Computer Lab (Node 5)',        ack:'acknowledged'   },
    { id:11, ts:'2026-03-22 15:30:00', level:'info',     event:'Faculty Office: Faculty Left',  source:'Faculty Office (Node 4)',      ack:'resolved'       },
    { id:12, ts:'2026-03-22 14:12:55', level:'warning',  event:'Classroom 2 Lights ON — No Class', source:'Classroom 2 (Node 2)',     ack:'resolved'       },
];

const LEVEL_CFG = {
    critical: { pill:'bg-red-50 text-red-700 border-red-200',      label:'Critical', icon:'critical', iconColor:'text-red-500',   iconBg:'bg-red-50',   borderColor:'#ef4444' },
    warning:  { pill:'bg-amber-50 text-amber-700 border-amber-200', label:'Warning',  icon:'warning',  iconColor:'text-amber-500', iconBg:'bg-amber-50', borderColor:'#f59e0b' },
    info:     { pill:'bg-blue-50 text-blue-700 border-blue-200',    label:'Info',     icon:'info',     iconColor:'text-blue-500',  iconBg:'bg-blue-50',  borderColor:'#3b82f6' },
};

const ACK_CFG = {
    unacknowledged: { color:'text-red-600 font-bold',    label:'Unacknowledged' },
    acknowledged:   { color:'text-slate-400',             label:'Acknowledged'   },
    resolved:       { color:'text-emerald-600 font-bold', label:'Resolved'       },
};

const LOG_SIZE = 6;

function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

export default function Alerts() {
    const [filter,   setFilter]  = useState('All');
    const [search,   setSearch]  = useState('');
    const [timeRange,setTime]    = useState('Last 24 Hours');
    const [alerts,   setAlerts]  = useState(() => INITIAL_DERIVED.map((a, i) => ({
        ...a,
        id: i,
        acknowledged: false,
        // Map derived alert severity to display format
        title:    a.message,
        location: `${a.node !== 'BLDG' ? `Node ${a.node} · ` : ''}${a.time}`,
        detected: a.time,
        system:   a.node !== 'BLDG' ? `IoT Node ${a.node}` : 'Building System',
    })));
    const [logPage, setLogPage] = useState(1);

    const critCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
    const warnCount = alerts.filter(a => a.severity === 'warning'  && !a.acknowledged).length;

    function acknowledge(id) { setAlerts(p => p.map(a => a.id === id ? {...a, acknowledged:true} : a)); }
    function dismiss(id)     { setAlerts(p => p.filter(a => a.id !== id)); }
    function markAllRead()   { setAlerts(p => p.map(a => ({...a, acknowledged:true}))); }

    const visibleAlerts = useMemo(() => alerts.filter(a => {
        if (filter === 'Critical')    return a.severity === 'critical';
        if (filter === 'Warning')     return a.severity === 'warning';
        if (filter === 'Information') return a.severity === 'info';
        return true;
    }), [alerts, filter]);

    const filteredLog = useMemo(() => EVENT_LOG.filter(e => {
        const q = search.toLowerCase();
        const ms = !q || e.event.toLowerCase().includes(q) || e.source.toLowerCase().includes(q);
        const mf = filter==='Critical'?e.level==='critical':filter==='Warning'?e.level==='warning':filter==='Information'?e.level==='info':true;
        return ms && mf;
    }), [search, filter]);

    const totalPages = Math.max(1, Math.ceil(filteredLog.length / LOG_SIZE));
    const pagedLog   = filteredLog.slice((logPage-1)*LOG_SIZE, logPage*LOG_SIZE);

    function changeFilter(f) { setFilter(f); setLogPage(1); }

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-lg font-bold text-slate-900">Real-time Alerts & Notifications</h1>
                    {critCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-widest">
              <Icon name="critical" className="w-3 h-3" /> {critCount} Critical
            </span>
                    )}
                    {warnCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded uppercase tracking-widest">
              <Icon name="warning" className="w-3 h-3" /> {warnCount} Warning
            </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={markAllRead}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors flex items-center gap-1.5">
                        <Icon name="check" className="w-3.5 h-3.5" /> Mark All Read
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
                        <Icon name="sliders" className="w-3.5 h-3.5" /> Configure Rules
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <Card className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Filter</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5">
                        {['All','Critical','Warning','Information'].map(f => (
                            <button key={f} onClick={() => changeFilter(f)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all
                        ${filter===f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setLogPage(1);}}
                               placeholder="Search events…"
                               className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44 transition-all" />
                    </div>
                    <select value={timeRange} onChange={e=>setTime(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                        {['Last 24 Hours','Last 7 Days','Last 30 Days'].map(o=><option key={o}>{o}</option>)}
                    </select>
                </div>
            </Card>

            {/* Active alerts — derived from sensorState */}
            <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-800">Active System Events</h3>
                    <span className="text-[10px] text-slate-400 font-medium">— derived from IoT node telemetry</span>
                </div>

                {visibleAlerts.length === 0 ? (
                    <Card className="p-10 text-center">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Icon name="check" className="w-5 h-5 text-emerald-600" />
                        </div>
                        <p className="font-bold text-slate-700 text-sm">All clear</p>
                        <p className="text-xs text-slate-400 mt-1">No active alerts in this category.</p>
                    </Card>
                ) : visibleAlerts.map(alert => {
                    const cfg = LEVEL_CFG[alert.severity] ?? LEVEL_CFG.info;
                    return (
                        <div key={alert.id}
                             className="bg-white rounded-xl border border-slate-200/80 overflow-hidden transition-all hover:shadow-md"
                             style={{ borderLeft:`3px solid ${cfg.borderColor}`, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                            <div className="p-5 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                                        <Icon name={cfg.icon} className={`w-5 h-5 ${cfg.iconColor}`} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-bold text-slate-900 text-sm leading-snug">{alert.title}</span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest ${cfg.pill}`}>
                        {alert.severity}
                      </span>
                                            {alert.node && alert.node !== 'BLDG' && (
                                                <span className="text-[9px] px-2 py-0.5 rounded border font-bold uppercase bg-blue-50 text-blue-600 border-blue-100">
                          Node {alert.node}
                        </span>
                                            )}
                                            {alert.acknowledged && (
                                                <span className="text-[9px] px-2 py-0.5 rounded border font-bold uppercase bg-slate-100 text-slate-500 border-slate-200">Acknowledged</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><Icon name="clock" className="w-3 h-3" /> {alert.time || alert.detected}</span>
                                            <span className="text-slate-200">·</span>
                                            <span className="flex items-center gap-1"><Icon name="settings" className="w-3 h-3" /> {alert.system}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {alert.severity !== 'info' && !alert.acknowledged && (
                                        <button onClick={() => acknowledge(alert.id)}
                                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest active:scale-95">
                                            Acknowledge
                                        </button>
                                    )}
                                    <button onClick={() => dismiss(alert.id)}
                                            className="px-3.5 py-1.5 border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest active:scale-95">
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* Event log */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800">Historical Event Log</h3>
                    <button onClick={() => exportAlertLog(filteredLog, filter)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest transition-all">
                        <Icon name="download" className="w-3.5 h-3.5" /> Export CSV
                    </button>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Timestamp','Level','Event','Source','Status',''].map(h => (
                                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[13px]">
                            {pagedLog.map(entry => {
                                const lc = LEVEL_CFG[entry.level] ?? LEVEL_CFG.info;
                                const ac = ACK_CFG[entry.ack];
                                return (
                                    <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">{entry.ts}</td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${lc.pill}`}>
                          <Icon name={lc.icon} className="w-2.5 h-2.5" /> {lc.label}
                        </span>
                                        </td>
                                        <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{entry.event}</td>
                                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{entry.source}</td>
                                        <td className={`px-5 py-3.5 text-[11px] uppercase tracking-tight whitespace-nowrap ${ac.color}`}>{ac.label}</td>
                                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                            <button className="text-blue-600 hover:text-blue-800 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest">Details</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">
              {Math.min((logPage-1)*LOG_SIZE+1,filteredLog.length)}–{Math.min(logPage*LOG_SIZE,filteredLog.length)} of {filteredLog.length}
            </span>
                        <nav className="flex items-center gap-1">
                            <button onClick={()=>setLogPage(p=>Math.max(1,p-1))} disabled={logPage===1}
                                    className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <Icon name="chevronLeft" className="w-3.5 h-3.5" />
                            </button>
                            {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                                <button key={p} onClick={()=>setLogPage(p)}
                                        className={`w-7 h-7 flex items-center justify-center rounded border text-[11px] font-bold transition-all
                          ${logPage===p ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    {p}
                                </button>
                            ))}
                            <button onClick={()=>setLogPage(p=>Math.min(totalPages,p+1))} disabled={logPage===totalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <Icon name="chevronRight" className="w-3.5 h-3.5" />
                            </button>
                        </nav>
                    </div>
                </Card>
            </section>
        </div>
    );
}