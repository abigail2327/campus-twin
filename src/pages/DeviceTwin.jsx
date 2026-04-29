import { useState, useMemo } from 'react';
import Icon from '../components/panels/Icon';
import { exportDeviceData } from '../services/exportService';
import { useLiveSensorState } from '../services/sensorState';

// Build device list from live sensorState — no more MOCK_SENSOR_STATE
function buildDevices(s = {}) {
    const cr1  = s.Classroom_1        ?? {};
    const cr2  = s.Classroom_2        ?? {};
    const lh   = s.Large_Lecture_Hall ?? {};
    const mech = s.Mechanical_Room    ?? {};

    return [
        {
            id:'SNSR-PIR-CR1',
            name:'PIR Motion Sensor — Classroom A',
            type:'Motion / Occupancy',
            floor:1, room:'Classroom A', node:1,
            status: cr1.status ?? 'online',
            firmware:'v2.4.1', power:'mains', iconName:'motion',
            reported: { motion: cr1.motion },
            desired:  { lighting: cr1.lights ? 'on' : 'off' },
            desc: 'HC-SR501 passive infrared. Triggers LED lighting when motion detected. Cross-referenced with INA219 for energy theft detection: power draw + no motion = anomaly flag.',
        },
        {
            id:'SNSR-LDR-CR2',
            name:'LDR Ambient Light Sensor — Classroom B',
            type:'Adaptive Lighting',
            floor:1, room:'Classroom B', node:2,
            status: cr2.lux != null && cr2.lux < 80 ? 'warning' : cr2.status ?? 'online',
            firmware:'v2.1.0', power:'mains', iconName:'lighting',
            reported: { lux: cr2.lux },
            desired:  { lighting: cr2.lights ? 'on' : 'off' },
            desc: 'Light Dependent Resistor. Measures ambient brightness. AI model uses lux + time-of-day + schedule to issue dimming commands — not a simple threshold. High lux = LEDs dim. Low lux = full brightness.',
        },
        {
            id:'SNSR-DHT-LH3',
            name:'DHT Temperature Sensor — Lecture Hall',
            type:'Temperature / HVAC',
            floor:1, room:'Lecture Hall', node:3,
            status: lh.fire_alert ? 'critical' : lh.temperature_c > 35 ? 'critical' : lh.temperature_c > 28 ? 'warning' : lh.status ?? 'online',
            firmware:'v3.0.2', power:'mains', iconName:'temperature',
            reported: { temperature_c: lh.temperature_c, fire_alert: lh.fire_alert, fan_active: lh.fan_active },
            desired:  { fan: lh.fan_active ? 'on' : 'off' },
            desc: 'DHT-compatible indoor temperature sensor. Controls HVAC fan. Paired with potentiometer fire simulator — AI distinguishes gradual heat (hot day) from sudden spike (fire event).',
        },
        {
            id:'SNSR-POT-LH3',
            name:'Potentiometer Fire Simulator — Lecture Hall',
            type:'Emergency Anomaly',
            floor:1, room:'Lecture Hall', node:3,
            status: lh.fire_alert ? 'critical' : 'online',
            firmware:'v1.0.0', power:'mains', iconName:'alerts',
            reported: { fire_alert: lh.fire_alert, temperature_c: lh.temperature_c },
            desired:  { alert_active: lh.fire_alert },
            desc: 'Potentiometer configured as fire emergency simulator. Turning the dial creates an instantaneous temperature spike — simulating the thermal signature of a fire. AI is trained to distinguish this pattern from gradual hot-day heat rise.',
        },
        {
            id:'INA219-BLDG',
            name:'INA219 Power Sensor — Central (All Rooms)',
            type:'Energy Metering',
            floor:0, room:'All Rooms', node:null,
            status: (mech.campus_power_w ?? 0) > 8000 ? 'warning' : 'online',
            firmware:'v1.2.0', power:'mains', iconName:'zap',
            reported: { campus_power_w: mech.campus_power_w ?? 0 },
            desired:  {},
            desc: 'Single INA219 power monitor for the entire building. Measures total campus energy consumption. Cross-referenced with PIR sensor in Classroom A: power draw with no motion detected = Energy Theft anomaly.',
        },
    ];
}

const STATUS_FILTERS = ['All','Online','Offline','Warning'];
const PAGE_SIZE      = 6;

const SC = {
    online:   { pill:'bg-emerald-50 text-emerald-700 border-emerald-200', dot:'bg-emerald-500', label:'Online',   pulse:true  },
    offline:  { pill:'bg-red-50 text-red-700 border-red-200',             dot:'bg-red-500',     label:'Offline',  pulse:false },
    warning:  { pill:'bg-amber-50 text-amber-700 border-amber-200',       dot:'bg-amber-400',   label:'Warning',  pulse:true  },
    critical: { pill:'bg-red-50 text-red-700 border-red-200',             dot:'bg-red-500',     label:'Critical', pulse:true  },
};
const SC_DEFAULT = SC.online;
const getSC = status => SC[status] ?? SC_DEFAULT;

function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

// ── Signal direction key ──────────────────────────────────────────────────────
function SignalLabel({ dir, label }) {
    return (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest
      ${dir === 'IN' ? 'bg-blue-950 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
      {dir} · {label}
    </span>
    );
}

// ── Device drawer ─────────────────────────────────────────────────────────────
function DeviceDrawer({ device, onClose }) {
    const sc = getSC(device.status);
    const hasDelta = Object.keys(device.desired).some(
        k => device.reported[k] !== undefined && String(device.reported[k]) !== String(device.desired[k])
    );

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50 sticky top-0 z-10">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Icon name={device.iconName} className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-slate-900 text-sm leading-tight" style={{ fontFamily:"'DM Mono',monospace" }}>{device.id}</h2>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{device.name}</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors">
                        <Icon name="x" className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 p-5 space-y-5">
                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { label:'Status',   val: <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${sc.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}</span> },
                            { label:'Type',     val: device.type },
                            { label:'Floor',    val: device.floor === 0 ? 'Building' : `Floor ${device.floor}` },
                            { label:'Room',     val: device.room },
                            { label:'Firmware', val: <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">{device.firmware}</code> },
                            { label:'IoT Node', val: device.node ? `Node ${device.node}` : 'Building-wide' },
                        ].map(({ label, val }) => (
                            <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                <div className="text-sm font-semibold text-slate-800">{val}</div>
                            </div>
                        ))}
                    </div>

                    {/* Reported state — signals OUT from node */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported State</p>
                            <SignalLabel dir="OUT" label="Node → DT" />
                        </div>
                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[12px] space-y-1.5">
                            {Object.entries(device.reported).map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                    <span className="text-blue-400">{k}:</span>
                                    <span className={typeof v === 'boolean' ? (v ? 'text-emerald-400' : 'text-red-400') : 'text-amber-300'}>
                    {String(v)}
                  </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Desired state — signals IN to node */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desired State</p>
                            <SignalLabel dir="IN" label="DT → Node" />
                        </div>
                        <div className="bg-blue-950 rounded-xl p-4 font-mono text-[12px] space-y-1.5">
                            {Object.entries(device.desired).map(([k, v]) => {
                                const rv   = device.reported[k];
                                const diff = rv !== undefined && String(rv) !== String(v);
                                return (
                                    <div key={k} className="flex gap-2 items-center flex-wrap">
                                        <span className="text-blue-400">{k}:</span>
                                        <span className={typeof v === 'boolean' ? (v ? 'text-emerald-400' : 'text-red-400') : 'text-amber-300'}>
                      {v === null ? 'null (no override)' : String(v)}
                    </span>
                                        {diff && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-sans">≠ {String(rv)}</span>}
                                    </div>
                                );
                            })}
                        </div>
                        {hasDelta && (
                            <p className="text-[11px] text-amber-600 font-semibold mt-2 flex items-center gap-1">
                                <Icon name="warning" className="w-3 h-3" /> State diverges — sync pending
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                            <Icon name="upload" className="w-4 h-4" /> Push Desired State
                        </button>
                        <button className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                            <Icon name="refresh" className="w-4 h-4" /> Reboot Device
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeviceTwin() {
    const { sensorState, campusTime, isLive } = useLiveSensorState();

    // Rebuild device list from live sensor state
    const DEVICES = useMemo(() => buildDevices(sensorState), [sensorState]);
    const TYPES   = useMemo(() => ['All Types', ...Array.from(new Set(DEVICES.map(d => d.type)))], [DEVICES]);

    const [search,         setSearch]         = useState('');
    const [typeFilter,     setTypeFilter]     = useState('All Types');
    const [statusFilter,   setStatusFilter]   = useState('All');
    const [page,           setPage]           = useState(1);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const filtered = useMemo(() => DEVICES.filter(d => {
        const q = search.toLowerCase();
        return (
            (!q || d.id.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)) &&
            (typeFilter   === 'All Types' || d.type   === typeFilter) &&
            (statusFilter === 'All'       || d.status === statusFilter.toLowerCase())
        );
    }), [search, typeFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    function applyFilter(key, val) {
        if (key === 'search') setSearch(val);
        if (key === 'type')   setTypeFilter(val);
        if (key === 'status') setStatusFilter(val);
        setPage(1);
    }

    const counts = {
        total:   DEVICES.length,
        online:  DEVICES.filter(d => d.status === 'online').length,
        offline: DEVICES.filter(d => d.status === 'offline').length,
        warning: DEVICES.filter(d => d.status === 'warning').length,
    };

    return (
        <div className="space-y-5">

            {/* Stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label:'Total Devices',  value:counts.total,   color:'text-slate-800',   bg:'bg-white border-slate-200/80',     iconName:'cpu',     iconColor:'text-slate-500'   },
                    { label:'Online',         value:counts.online,  color:'text-emerald-700', bg:'bg-emerald-50 border-emerald-100', iconName:'wifi',    iconColor:'text-emerald-500' },
                    { label:'Offline',        value:counts.offline, color:'text-red-600',     bg:'bg-red-50 border-red-100',         iconName:'power',   iconColor:'text-red-400'     },
                    { label:'Warning',        value:counts.warning, color:'text-amber-700',   bg:'bg-amber-50 border-amber-100',     iconName:'warning', iconColor:'text-amber-500'   },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl border p-5`}
                         style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                            <Icon name={s.iconName} className={`w-4 h-4 ${s.iconColor}`} />
                        </div>
                        <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily:"'DM Mono',monospace" }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Signal legend */}
            <div className="flex items-center gap-4 px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px]">
                <span className="font-bold text-slate-400 uppercase tracking-widest">Signal Direction:</span>
                <SignalLabel dir="OUT" label="Node → DT (reported state)" />
                <SignalLabel dir="IN"  label="DT → Node (desired state)" />
                <span className="ml-auto text-slate-600 font-mono text-[10px]">
          Campus Clock: {campusTime ? `${String(campusTime).padStart(4,'0').slice(0,2)}:${String(campusTime).padStart(4,'0').slice(2)}` : '—'}
                    {campusTime >= 1800 ? '  ⚠ AFTER HOURS' : ''}
        </span>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/40">
                    <div className="relative flex-1 min-w-44">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" value={search} onChange={e => applyFilter('search', e.target.value)}
                               placeholder="Search devices…"
                               className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                    <select value={typeFilter} onChange={e => applyFilter('type', e.target.value)}
                            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div className="flex gap-1">
                        {STATUS_FILTERS.map(f => (
                            <button key={f} onClick={() => applyFilter('status', f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                        ${statusFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="ml-auto flex gap-2">
                        <button onClick={() => exportDeviceData(filtered)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors">
                            <Icon name="download" className="w-3.5 h-3.5" /> Export CSV
                        </button>
                        <button className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-blue-600/15">
                            <Icon name="plus" className="w-3.5 h-3.5" /> Add Device
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            {['Device ID & Name','Type','Node','Status','Firmware','Actions'].map(h => (
                                <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                        {paged.length === 0
                            ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">No devices match your filters.</td></tr>
                            : paged.map(device => {
                                const sc = getSC(device.status);
                                return (
                                    <tr key={device.id} onClick={() => setSelectedDevice(device)}
                                        className="group hover:bg-blue-50/20 transition-colors cursor-pointer">
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                                    <Icon name={device.iconName} className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="text-[12px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                                                       style={{ fontFamily:"'DM Mono',monospace" }}>{device.id}</p>
                                                    <p className="text-xs text-slate-400">{device.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{device.type}</td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {device.node
                                                ? <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Node {device.node}</span>
                                                : <span className="text-[11px] text-slate-400">Building</span>
                                            }
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${sc.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${sc.pulse ? 'animate-pulse' : ''}`} />
                              {sc.label}
                          </span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <code className="text-[12px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{device.firmware}</code>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-0.5">
                                                {[
                                                    { name:'eye',     fn: () => setSelectedDevice(device) },
                                                    { name:'edit',    fn: () => {} },
                                                    { name:'refresh', fn: () => window.confirm(`Reboot ${device.id}?`) },
                                                ].map(a => (
                                                    <button key={a.name} onClick={a.fn}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all">
                                                        <Icon name={a.name} className="w-4 h-4" />
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        }
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-400">
                        Page <span className="text-slate-700">{page}</span> of <span className="text-slate-700">{totalPages}</span>
                        <span className="ml-2 text-slate-400">· {filtered.length} devices</span>
                    </p>
                    <div className="flex gap-1.5">
                        <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <Icon name="chevronLeft" className="w-3 h-3" /> Prev
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            Next <Icon name="chevronRight" className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </Card>

            {selectedDevice && <DeviceDrawer device={selectedDevice} onClose={() => setSelectedDevice(null)} />}
        </div>
    );
}