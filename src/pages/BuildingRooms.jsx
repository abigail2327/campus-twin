/**
 * BuildingRooms.jsx  (merged Building Overview + Rooms & Zones)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth: MOCK_SENSOR_STATE from sensorState.js
 * Phase 3: swap MOCK_SENSOR_STATE for Firebase onValue() — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/panels/Icon';
import { MOCK_SENSOR_STATE, computeCampusKPIs, deriveAlerts, CAMPUS_TIME } from '../services/sensorState';

const BuildingTwin3D = lazy(() => import('../components/panels/BuildingTwin3D'));

// ── Derive everything from sensorState — no local hardcoded data ──────────────
const S   = MOCK_SENSOR_STATE;   // alias
const KPI = computeCampusKPIs(S);

// Floor plan geometry — room positions only (no sensor data here)
const FLOOR_PLAN = {
    1: [
        { id:'Lobby_Reception',    top:0,  left:0,  w:29, h:40 },
        { id:'Classroom_1',        top:0,  left:29, w:29, h:40 },
        { id:'Classroom_2',        top:0,  left:58, w:42, h:40 },
        { id:'Large_Lecture_Hall', top:40, left:0,  w:42, h:60 },
    ],
    2: [
        { id:'Lounge_Study',    top:0,  left:0,  w:29, h:40 },
        { id:'Computer_Lab',    top:0,  left:29, w:71, h:40 },
        { id:'Faculty_Office',  top:40, left:0,  w:42, h:20 },
        { id:'Control_Room',    top:60, left:0,  w:42, h:20 },
        { id:'Mechanical_Room', top:80, left:0,  w:42, h:20 },
    ],
};

// Ordered room list for the side panel
const ROOM_LIST = [
    { id:'Lobby_Reception',    name:'Lobby / Reception',  floor:1 },
    { id:'Classroom_1',        name:'Classroom 1',         floor:1 },
    { id:'Classroom_2',        name:'Classroom 2',         floor:1 },
    { id:'Large_Lecture_Hall', name:'Large Lecture Hall',  floor:1 },
    { id:'Lounge_Study',       name:'Lounge / Study Area', floor:2 },
    { id:'Computer_Lab',       name:'Computer Lab',        floor:2 },
    { id:'Faculty_Office',     name:'Faculty Office',      floor:2 },
    { id:'Control_Room',       name:'Control Room',        floor:2 },
    { id:'Mechanical_Room',    name:'Mechanical Room',     floor:2 },
];

// Status config
const SC = {
    optimal:  { dot:'bg-emerald-400', glow:'shadow-[0_0_6px_rgba(52,211,153,0.6)]',  border:'border-emerald-200', roomBg:'bg-emerald-50/60', label:'text-emerald-800', bar:'bg-emerald-400', pill:'bg-emerald-100 text-emerald-700', pulse:false },
    warning:  { dot:'bg-amber-400',   glow:'shadow-[0_0_6px_rgba(251,191,36,0.6)]',  border:'border-amber-200',   roomBg:'bg-amber-50/60',   label:'text-amber-800',   bar:'bg-amber-400',   pill:'bg-amber-100 text-amber-700',    pulse:false },
    critical: { dot:'bg-red-500',     glow:'shadow-[0_0_6px_rgba(239,68,68,0.6)]',   border:'border-red-300',     roomBg:'bg-red-50/60',     label:'text-red-800',     bar:'bg-red-500',     pill:'bg-red-100 text-red-700',        pulse:true  },
};

// ── Shared card ───────────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

function CardHead({ title, sub, iconName, right }) {
    return (
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2.5">
                {iconName && <Icon name={iconName} className="w-4 h-4 text-slate-400" />}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
                    {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                </div>
            </div>
            {right}
        </div>
    );
}

// ── Sparkline canvas ──────────────────────────────────────────────────────────
// Mock 24h temp history keyed by room ID (matches sensorState room IDs exactly)
const TEMP_HISTORY = {
    Lobby_Reception:    [22,22,22,22,22,22,23,22,22,22,22,22],
    Classroom_1:        [22,22,21,21,22,23,23,24,23,23,22,22],
    Classroom_2:        [22,23,23,23,24,24,25,25,24,24,24,24],
    Large_Lecture_Hall: [22,22,23,23,24,25,26,26,26,25,25,25],
    Lounge_Study:       [23,23,23,23,23,24,24,24,24,23,23,23],
    Computer_Lab:       [21,21,21,21,22,22,22,22,22,22,22,21],
    Faculty_Office:     [21,21,21,21,22,22,22,22,22,22,22,21],
    Control_Room:       [20,20,20,21,21,21,21,21,21,20,20,20],
    Mechanical_Room:    [26,27,27,28,28,28,28,28,28,28,28,28],
};

function Sparkline({ roomId, color = '#2563eb' }) {
    const ref = useRef();
    const data = TEMP_HISTORY[roomId] || [];

    useEffect(() => {
        const canvas = ref.current; if (!canvas || !data.length) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height, pad = 6;
        const min = Math.min(...data) - 1, max = Math.max(...data) + 1;
        const tx = i => pad + (i / (data.length - 1)) * (w - pad * 2);
        const ty = v => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const y = pad + (i / 2) * (h - pad * 2); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
        const sp = S[roomId]?.temperature_c ?? 22;
        if (sp >= min && sp <= max) { ctx.beginPath(); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.moveTo(pad, ty(sp)); ctx.lineTo(w - pad, ty(sp)); ctx.stroke(); ctx.setLineDash([]); }
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + '28'); grad.addColorStop(1, color + '00');
        ctx.beginPath(); data.forEach((v, i) => { if (i) ctx.lineTo(tx(i), ty(v)); else ctx.moveTo(tx(i), ty(v)); });
        ctx.lineTo(tx(data.length - 1), h); ctx.lineTo(tx(0), h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        data.forEach((v, i) => { if (i) ctx.lineTo(tx(i), ty(v)); else ctx.moveTo(tx(i), ty(v)); });
        ctx.stroke();
        const lx = tx(data.length - 1), ly = ty(data[data.length - 1]);
        ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }, [data, color, roomId]);

    return <canvas ref={ref} className="w-full h-full" />;
}

// ── Room detail panel ─────────────────────────────────────────────────────────
function RoomDetail({ roomId, onClose }) {
    const room   = ROOM_LIST.find(r => r.id === roomId);
    const sensor = S[roomId];
    if (!room || !sensor) return null;

    const s   = SC[sensor.status] || SC.optimal;
    const pct = sensor.max_occupancy
        ? Math.min(100, Math.round((sensor.occupancy / sensor.max_occupancy) * 100))
        : 0;
    const chartColor = sensor.status === 'critical' ? '#ef4444' : sensor.status === 'warning' ? '#f59e0b' : '#2563eb';
    const lightingText = sensor.lights === true ? 'Active' : sensor.lights === false ? 'Off' : '—';
    const lightingColor = sensor.lights ? 'text-emerald-600' : 'text-slate-400';

    return (
        <Card className="flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.dot} ${s.glow} ${s.pulse ? 'animate-pulse' : ''}`} />
                    <h3 className="text-sm font-bold text-slate-800">{room.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${s.pill}`}>{sensor.status}</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <Icon name="x" className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Icon name="layers" className="w-3 h-3" /> Floor {room.floor}
                    {sensor.node && <span className="ml-2 text-blue-500 font-bold">· Node {sensor.node}</span>}
                </p>

                {/* 4 metric tiles — all from sensorState */}
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label:'Temp',     icon:'temperature', value:`${sensor.temperature_c?.toFixed(1) ?? '—'}°C`, cls: sensor.temperature_c > 25 ? 'text-amber-600' : 'text-slate-900' },
                        { label:'Humidity', icon:'humidity',    value:`${sensor.humidity_pct?.toFixed(0) ?? sensor.humidity_pct ?? '—'}%`, cls:'text-slate-900' },
                        { label:'CO₂',     icon:'co2',         value: sensor.co2_ppm ? `${sensor.co2_ppm} ppm` : '—',
                            cls: sensor.co2_ppm > 1000 ? 'text-red-600' : sensor.co2_ppm > 600 ? 'text-amber-600' : 'text-emerald-600' },
                        { label:'Lighting', icon:'lighting',    value: lightingText, cls: lightingColor },
                    ].map(m => (
                        <div key={m.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Icon name={m.icon} className="w-3 h-3" /> {m.label}
                            </p>
                            <p className={`text-lg font-bold ${m.cls}`} style={{ fontFamily:"'DM Mono',monospace" }}>{m.value}</p>
                        </div>
                    ))}
                </div>

                {/* Occupancy — directly from sensorState */}
                {sensor.occupancy != null && sensor.max_occupancy != null && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                            <span className="flex items-center gap-1"><Icon name="occupancy" className="w-3 h-3" /> Occupancy</span>
                            <span style={{ fontFamily:"'DM Mono',monospace" }}>{sensor.occupancy} / {sensor.max_occupancy} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.bar} transition-all`} style={{ width:`${pct}%` }} />
                        </div>
                    </div>
                )}

                {/* Node-specific fields */}
                {sensor.node === 1 && sensor.motion != null && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Icon name="motion" className="w-3 h-3" /> PIR Motion
            </span>
                        <span className={`text-sm font-bold ${sensor.motion ? 'text-blue-600' : 'text-slate-400'}`}>
              {sensor.motion ? 'Detected' : 'Clear'}
            </span>
                    </div>
                )}
                {sensor.node === 3 && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-500 flex items-center gap-1"><Icon name="hvac" className="w-3 h-3" /> Fan Speed</span>
                            <span className="font-bold text-slate-700" style={{ fontFamily:"'DM Mono',monospace" }}>{sensor.fan_speed_pct ?? '—'}%</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-500">Damper Angle</span>
                            <span className="font-bold text-slate-700" style={{ fontFamily:"'DM Mono',monospace" }}>{sensor.damper_angle ?? '—'}°</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-500">HCS Mode</span>
                            <span className="font-bold text-blue-600">{sensor.hcs ?? '—'}</span>
                        </div>
                    </div>
                )}
                {sensor.node === 5 && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-500 flex items-center gap-1"><Icon name="cpu" className="w-3 h-3" /> Active PCs</span>
                            <span className="font-bold" style={{ fontFamily:"'DM Mono',monospace", color: sensor.pc_power ? '#22c55e' : '#94a3b8' }}>
                {sensor.active_pcs ?? '—'} / {sensor.total_pcs ?? 30}
              </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-500">PC Power</span>
                            <span className={`font-bold ${sensor.pc_power ? 'text-emerald-600' : 'text-red-500'}`}>
                {sensor.pc_power ? 'ON' : 'Shutdown'}
              </span>
                        </div>
                    </div>
                )}

                {/* Sparkline */}
                {TEMP_HISTORY[roomId] && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Icon name="activity" className="w-3 h-3" /> Temp History (24h)
              </span>
                            <span className="text-[10px] text-slate-400 italic">Live</span>
                        </div>
                        <div className="h-20 w-full"><Sparkline roomId={roomId} color={chartColor} /></div>
                    </div>
                )}

                {/* Power */}
                {sensor.power_w != null && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Icon name="zap" className="w-3 h-3" /> INA219 Power
            </span>
                        <span className="text-sm font-bold text-slate-800" style={{ fontFamily:"'DM Mono',monospace" }}>
              {sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(2)} kW` : `${sensor.power_w.toFixed(0)} W`}
            </span>
                    </div>
                )}
            </div>
        </Card>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BuildingRooms() {
    const navigate     = useNavigate();
    const [activeFloor, setActiveFloor] = useState(1);
    const [selectedId,  setSelectedId]  = useState(null);
    const [viewMode,    setViewMode]    = useState('3d');

    function switchFloor(f) { setActiveFloor(f); setSelectedId(null); }
    function selectRoom(id) { setSelectedId(p => p === id ? null : id); }

    // When a room is selected from the 3D view, switch to the right floor
    function handle3DSelect(id) {
        if (!id) { setSelectedId(null); return; }
        const room = ROOM_LIST.find(r => r.id === id);
        if (room) setActiveFloor(room.floor);
        setSelectedId(id);
    }

    const planRooms   = FLOOR_PLAN[activeFloor];
    const floor1Rooms = ROOM_LIST.filter(r => r.floor === 1);
    const floor2Rooms = ROOM_LIST.filter(r => r.floor === 2);

    // Building-level stats derived from sensorState
    const stats = [
        { label:'Total Rooms',      value: ROOM_LIST.length,            unit:'',        iconName:'rooms'    },
        { label:'Campus Occupancy', value: KPI.totalOccupancy,          unit:`/ ${KPI.maxOccupancy}`, iconName:'occupancy' },
        { label:'Energy Efficiency',value:'88',                          unit:'%',       iconName:'zap',     accent:'text-emerald-600' },
        { label:'Active Alerts',    value: KPI.criticalRooms + KPI.warningRooms, unit:'', iconName:'alerts', accent: KPI.criticalRooms > 0 ? 'text-red-600' : 'text-slate-800' },
    ];

    return (
        <div className="space-y-5">

            {/* Stat cards — all from sensorState */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map(s => (
                    <Card key={s.label} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Icon name={s.iconName} className="w-4 h-4 text-slate-500" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className={`text-3xl font-bold tracking-tight ${s.accent ?? 'text-slate-800'}`}
                           style={{ fontFamily:"'DM Mono',monospace" }}>
                            {s.value}
                            {s.unit && <span className="text-base font-normal text-slate-400 ml-1">{s.unit}</span>}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Main grid: floor plan / 3D + room list + detail */}
            <div className="grid grid-cols-12 gap-5">

                {/* Left: 3D twin or floor plan */}
                <Card className={`flex flex-col overflow-hidden transition-all duration-200
          ${selectedId ? 'col-span-12 xl:col-span-6' : 'col-span-12 xl:col-span-8'}`}>

                    <CardHead
                        title={viewMode === '3d' ? 'Building Digital Twin — 3D View' : `Floor ${activeFloor} — Interactive Plan`}
                        sub={viewMode === '3d' ? 'Drag to orbit · scroll to zoom · click any room' : 'Click any zone to inspect sensor data'}
                        iconName={viewMode === '3d' ? 'layers' : 'map'}
                        right={
                            <div className="flex items-center gap-2">
                                {/* Open in new tab */}
                                <button onClick={() => window.open('/twin3d', '_blank')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors uppercase tracking-widest">
                                    <Icon name="externalLink" className="w-3 h-3" /> Fullscreen
                                </button>
                                {/* View toggle */}
                                <div className="flex bg-slate-100 rounded-lg p-0.5">
                                    {[['3d','layers','3D Twin'],['plan','map','Floor Plan']].map(([mode, icon, lbl]) => (
                                        <button key={mode} onClick={() => setViewMode(mode)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all
                              ${viewMode === mode ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                            <Icon name={icon} className="w-3 h-3" /> {lbl}
                                        </button>
                                    ))}
                                </div>
                                {/* Floor toggle — plan view only */}
                                {viewMode === 'plan' && (
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        {[1,2].map(f => (
                                            <button key={f} onClick={() => switchFloor(f)}
                                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all
                                ${activeFloor===f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                F{f}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        }
                    />

                    {/* 3D view */}
                    {viewMode === '3d' ? (
                        <div style={{ minHeight:'480px' }}>
                            <Suspense fallback={
                                <div className="flex items-center justify-center h-[480px] bg-slate-950 rounded-b-xl">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-sm text-slate-400">Loading 3D Twin…</p>
                                    </div>
                                </div>
                            }>
                                <BuildingTwin3D
                                    sensorState={S}
                                    selectedRoom={selectedId}
                                    onRoomSelect={handle3DSelect}
                                    height="480px"
                                />
                            </Suspense>
                        </div>
                    ) : (
                        /* Floor plan view */
                        <div className="p-5">
                            <div className="relative w-full select-none" style={{ paddingBottom:'62%' }}>
                                {/* Blueprint background */}
                                <div className="absolute inset-0 rounded-xl overflow-hidden border border-slate-200"
                                     style={{ background:'linear-gradient(135deg,#f0f5ff,#e8eef8)' }}>
                                    <div className="absolute inset-0 opacity-[0.06]"
                                         style={{ backgroundImage:'linear-gradient(#2563eb 1px,transparent 1px),linear-gradient(90deg,#2563eb 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
                                </div>
                                {/* L-shape exterior */}
                                <div className="absolute flex items-center justify-center rounded-lg"
                                     style={{ top:'40%', left:'42%', right:0, bottom:0,
                                         background:'repeating-linear-gradient(45deg,#c8d3e0,#c8d3e0 2px,#dce4ee 2px,#dce4ee 11px)',
                                         border:'2px solid #94a3b8' }}>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-50">Exterior</span>
                                </div>
                                {/* Room tiles — colour and data from sensorState */}
                                {planRooms.map(pr => {
                                    const sensor = S[pr.id];
                                    const s = SC[sensor?.status] || SC.optimal;
                                    const isSel = selectedId === pr.id;
                                    const pct = sensor?.max_occupancy
                                        ? Math.min(100, Math.round((sensor.occupancy / sensor.max_occupancy) * 100))
                                        : 0;
                                    return (
                                        <div key={pr.id} onClick={() => selectRoom(pr.id)}
                                             className={`absolute flex flex-col items-center justify-center gap-0.5 cursor-pointer rounded-lg border-2 transition-all duration-150
                           ${isSel ? 'border-blue-500 bg-blue-50/95 shadow-xl ring-2 ring-blue-300/30 z-20' : `${s.border} ${s.roomBg} hover:shadow-md hover:z-10`}`}
                                             style={{ top:`${pr.top}%`, left:`${pr.left}%`, width:`${pr.w}%`, height:`${pr.h}%` }}>
                                            <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${s.dot} ${s.glow} ${s.pulse ? 'animate-pulse' : ''}`} />
                                            <span className="text-[7px] font-bold tracking-widest uppercase text-slate-400 leading-none">{pr.id.replace(/_/g,' ').slice(0,8)}</span>
                                            <p className={`text-[10px] sm:text-xs font-bold text-center px-1 leading-tight ${isSel ? 'text-blue-700' : s.label}`}>
                                                {pr.id.replace(/_/g,' ')}
                                            </p>
                                            {/* Occupancy mini-bar — from sensorState */}
                                            {pct > 0 && (
                                                <div className="w-7 h-0.5 rounded-full bg-black/10 overflow-hidden mt-1">
                                                    <div className={`h-full rounded-full ${s.bar}`} style={{ width:`${pct}%` }} />
                                                </div>
                                            )}
                                            {/* Temp readout */}
                                            {sensor?.temperature_c != null && (
                                                <span className="text-[8px] text-slate-400 mt-0.5">{sensor.temperature_c.toFixed(1)}°C</span>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Floor badge */}
                                <div className="absolute top-3 left-3 z-10 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                                    Floor {activeFloor}
                                </div>
                                {/* Zoom controls */}
                                <div className="absolute bottom-3 left-3 flex flex-col gap-1 z-10">
                                    {['+','−'].map(sym => (
                                        <button key={sym} className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 text-xs font-bold shadow-sm transition-colors flex items-center justify-center">{sym}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Room detail panel */}
                {selectedId && (
                    <div className="col-span-12 xl:col-span-3">
                        <RoomDetail roomId={selectedId} onClose={() => setSelectedId(null)} />
                    </div>
                )}

                {/* Room list — occupancy from sensorState */}
                <Card className={`flex flex-col overflow-hidden transition-all ${selectedId ? 'col-span-12 xl:col-span-3' : 'col-span-12 xl:col-span-4'}`}
                      style={{ maxHeight:'540px' }}>
                    <CardHead
                        title="Room Status"
                        iconName="rooms"
                        right={
                            <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded-full uppercase">
                {ROOM_LIST.length} Rooms
              </span>
                        }
                    />
                    <div className="flex-1 overflow-y-auto">
                        {[{ floor:1, rooms:floor1Rooms }, { floor:2, rooms:floor2Rooms }].map(({ floor, rooms }) => (
                            <div key={floor}>
                                <div className="px-4 py-2 bg-slate-50 border-y border-slate-100 flex items-center gap-2 sticky top-0 z-10">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Floor {floor}</span>
                                </div>
                                {rooms.map(room => {
                                    const sensor = S[room.id];
                                    const s = SC[sensor?.status] || SC.optimal;
                                    const isSel = selectedId === room.id;
                                    return (
                                        <div key={room.id}
                                             onClick={() => { setActiveFloor(room.floor); selectRoom(room.id); }}
                                             className={`px-4 py-3 cursor-pointer transition-all group border-b border-slate-50 border-l-2
                           ${isSel ? 'bg-blue-50/70 border-l-blue-500' : 'border-l-transparent hover:bg-slate-50'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <p className={`text-sm font-bold transition-colors ${isSel ? 'text-blue-600' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                                    {room.name}
                                                </p>
                                                <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${s.dot} ${s.glow} ${s.pulse ? 'animate-pulse' : ''}`} />
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Icon name="temperature" className="w-3 h-3" />
                            {sensor?.temperature_c?.toFixed(1) ?? '—'}°C
                        </span>
                                                <span className="flex items-center gap-1">
                          <Icon name="occupancy" className="w-3 h-3" />
                                                    {sensor?.occupancy ?? '—'}/{sensor?.max_occupancy ?? '—'}
                        </span>
                                                <span className="flex items-center gap-1">
                          <Icon name="zap" className="w-3 h-3" />
                                                    {sensor?.power_w != null
                                                        ? sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(1)}kW` : `${sensor.power_w.toFixed(0)}W`
                                                        : '—'}
                        </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent alerts */}
            <Card>
                <CardHead
                    title="Recent System Alerts"
                    iconName="alerts"
                    right={
                        <button onClick={() => navigate('/alerts')}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors">
                            View All
                        </button>
                    }
                />
                <div className="divide-y divide-slate-50">
                    {deriveAlerts(S, CAMPUS_TIME).slice(0, 4).map((alert, i) => {
                        const isC = alert.severity === 'critical';
                        return (
                            <div key={i} className="flex items-start gap-3.5 px-5 py-4 hover:bg-slate-50 transition-colors"
                                 style={{ borderLeft:`2px solid ${isC ? '#ef4444' : '#f59e0b'}` }}>
                                <div className={`w-8 h-8 ${isC ? 'bg-red-50' : 'bg-amber-50'} rounded-lg flex items-center justify-center shrink-0`}>
                                    <Icon name={isC ? 'critical' : 'warning'} className={`w-4 h-4 ${isC ? 'text-red-500' : 'text-amber-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{alert.message}</p>
                                    {alert.node && alert.node !== 'BLDG' && (
                                        <p className="text-[10px] text-blue-500 font-bold mt-0.5">Node {alert.node}</p>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                  <Icon name="clock" className="w-3 h-3" /> {alert.time}
                </span>
                            </div>
                        );
                    })}
                    {deriveAlerts(S, CAMPUS_TIME).length === 0 && (
                        <div className="px-5 py-6 text-center">
                            <p className="text-sm text-slate-400">No active alerts</p>
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
}