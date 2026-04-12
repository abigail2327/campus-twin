import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/panels/Icon';
import { MOCK_SENSOR_STATE, computeCampusKPIs, deriveAlerts, CAMPUS_TIME } from '../services/sensorState';

// Lazy-load the heavy Three.js canvas
const BuildingTwin3D = lazy(() => import('../components/panels/BuildingTwin3D'));

// ── MOCK DATA (replace with Firebase subscription in Phase 3) ────────────────
const SENSOR_STATE = MOCK_SENSOR_STATE;
const KPI          = computeCampusKPIs(SENSOR_STATE);
const LIVE_ALERTS  = deriveAlerts(SENSOR_STATE, CAMPUS_TIME);

const HVAC_ZONES = [
    { label:'Zone A — Classroom Block', val:94, room:'Classroom_1'       },
    { label:'Zone B — Lecture Hall',    val:78, room:'Large_Lecture_Hall' },
    { label:'Zone C — Computer Lab',    val:88, room:'Computer_Lab'       },
    { label:'Zone D — Faculty Wing',    val:61, room:'Faculty_Office'     },
    { label:'Zone E — Lounge',          val:91, room:'Lounge_Study'       },
    { label:'Zone F — Mechanical',      val:85, room:'Mechanical_Room'    },
];

// ── Node summary for quick status strip ───────────────────────────────────────
const NODE_STRIP = [
    { node:1, room:'Classroom_1',        label:'CR-1', iconName:'lighting'    },
    { node:2, room:'Classroom_2',        label:'CR-2', iconName:'lighting'    },
    { node:3, room:'Large_Lecture_Hall', label:'LH-3', iconName:'hvac'        },
    { node:4, room:'Faculty_Office',     label:'FAC-4',iconName:'user'        },
    { node:5, room:'Computer_Lab',       label:'LAB-5',iconName:'cpu'         },
    { node:6, room:'Mechanical_Room',    label:'MCH-6',iconName:'zap'         },
];

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

const SC = {
    optimal:  'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]',
    warning:  'bg-amber-400   shadow-[0_0_5px_rgba(251,191,36,0.6)]',
    critical: 'bg-red-500     shadow-[0_0_5px_rgba(239,68,68,0.6)]',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Format campus clock HHMM → "HH:MM"
    const clockStr = String(CAMPUS_TIME).padStart(4,'0');
    const clockDisplay = `${clockStr.slice(0,2)}:${clockStr.slice(2)}`;

    return (
        <div className="space-y-5">

            {/* ── Row 1: Campus KPI cards ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

                {/* Total Campus Power */}
                <Card className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Icon name="zap" className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1
              ${KPI.totalPower_w > 15000 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Icon name={KPI.totalPower_w > 15000 ? 'trendUp' : 'trendDown'} className="w-2.5 h-2.5" />
                            {KPI.totalPower_w > 15000 ? 'High' : 'Normal'}
            </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Campus Load</p>
                    <p className="text-3xl font-bold text-slate-900" style={{ fontFamily:"'DM Mono',monospace" }}>
                        {KPI.totalPower_kw}<span className="text-base font-normal text-slate-400 ml-1">kW</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">INA219 across all 6 nodes</p>
                </Card>

                {/* Building Occupancy */}
                <Card className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Icon name="occupancy" className="w-4 h-4 text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Building Occupancy</p>
                    <p className="text-3xl font-bold text-slate-900" style={{ fontFamily:"'DM Mono',monospace" }}>
                        {KPI.totalOccupancy}<span className="text-base font-normal text-slate-400 ml-1">/ {KPI.maxOccupancy}</span>
                    </p>
                    <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${KPI.occupancyPct > 85 ? 'bg-red-500' : KPI.occupancyPct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                             style={{ width:`${KPI.occupancyPct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{KPI.occupancyPct}% capacity</p>
                </Card>

                {/* Campus Clock */}
                <Card className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Icon name="clock" className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Simulated</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Campus Clock (CC)</p>
                    <p className="text-3xl font-bold text-slate-900" style={{ fontFamily:"'DM Mono',monospace" }}>
                        {clockDisplay}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        {CAMPUS_TIME >= 1800 ? '⚠ After hours — PC shutdown active' : 'Normal operating hours'}
                    </p>
                </Card>

                {/* Alert summary */}
                <Card className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                            <Icon name="alerts" className="w-4 h-4 text-red-500" />
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Alerts</p>
                    <p className="text-3xl font-bold text-slate-900" style={{ fontFamily:"'DM Mono',monospace" }}>
                        {LIVE_ALERTS.length}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        {KPI.criticalRooms} critical · {KPI.warningRooms} warning
                        {KPI.anyFire ? ' · 🔴 FIRE' : ''}
                    </p>
                </Card>
            </div>

            {/* ── Row 2: Node status strip ── */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
                {NODE_STRIP.map(n => {
                    const s = SENSOR_STATE[n.room];
                    const status = s?.status ?? 'optimal';
                    const dotCls = SC[status] || SC.optimal;
                    return (
                        <Card key={n.node}
                              className={`p-3.5 cursor-pointer transition-all hover:shadow-md ${selectedRoom === n.room ? 'ring-2 ring-blue-500' : ''}`}
                              onClick={() => setSelectedRoom(selectedRoom === n.room ? null : n.room)}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Icon name={n.iconName} className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Node {n.node}</p>
                            <p className="text-[11px] font-bold text-slate-700 mt-0.5">{n.label}</p>
                            <p className="text-[10px] font-bold mt-1" style={{ fontFamily:"'DM Mono',monospace",
                                color: status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981' }}>
                                {s?.power_w != null ? (s.power_w >= 1000 ? `${(s.power_w/1000).toFixed(1)}kW` : `${s.power_w.toFixed(0)}W`) : '—'}
                            </p>
                        </Card>
                    );
                })}
            </div>

            {/* ── Row 3: 3D Twin + Alert log ── */}
            <div className="grid grid-cols-12 gap-5">

                {/* 3D Digital Twin — main centrepiece */}
                <div className="col-span-12 xl:col-span-8">
                    <Card className="overflow-hidden">
                        <CardHead
                            title="Building Digital Twin — 3D View"
                            sub="Drag to orbit · scroll to zoom · click any room for live sensor data"
                            iconName="layers"
                            right={
                                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Mock Data
                  </span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => navigate('/building')}
                                                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest transition-colors flex items-center gap-1">
                                            <Icon name="map" className="w-3 h-3" /> Floor Plan
                                        </button>
                                        <button onClick={() => window.open('/twin3d', '_blank')}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors flex items-center gap-1 border border-blue-100 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg">
                                            <Icon name="externalLink" className="w-3 h-3" /> Open 3D Tab
                                        </button>
                                    </div>
                                </div>
                            }
                        />
                        <Suspense fallback={
                            <div className="flex items-center justify-center h-[480px] bg-slate-950 rounded-b-xl">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm text-slate-400 font-medium">Loading 3D Twin…</p>
                                    <p className="text-xs text-slate-600">Three.js + @react-three/fiber</p>
                                </div>
                            </div>
                        }>
                            <BuildingTwin3D
                                sensorState={SENSOR_STATE}
                                selectedRoom={selectedRoom}
                                onRoomSelect={setSelectedRoom}
                                height="480px"
                                compact={false}
                            />
                        </Suspense>
                    </Card>
                </div>

                {/* Alert log */}
                <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">

                    {/* Live alert feed */}
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHead
                            title="Alert Log"
                            sub="Derived from IoT node telemetry"
                            iconName="alerts"
                            right={
                                <button onClick={() => navigate('/alerts')}
                                        className="text-[11px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors">
                                    View All
                                </button>
                            }
                        />
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                            {LIVE_ALERTS.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-2">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                                        <Icon name="check" className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">All systems nominal</p>
                                </div>
                            ) : LIVE_ALERTS.map((alert, i) => {
                                const borderColor = alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
                                const iconName    = alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info';
                                const iconColor   = alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500';
                                const iconBg      = alert.severity === 'critical' ? 'bg-red-50' : alert.severity === 'warning' ? 'bg-amber-50' : 'bg-blue-50';
                                return (
                                    <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                                         style={{ borderLeft:`2px solid ${borderColor}` }}>
                                        <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                                            <Icon name={iconName} className={`w-3.5 h-3.5 ${iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-semibold text-slate-800 leading-tight">{alert.message}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                <Icon name="clock" className="w-3 h-3" /> {alert.time}
                                                {alert.node !== 'BLDG' && <span className="ml-1 font-bold text-blue-500">Node {alert.node}</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Selected room quick stats */}
                    {selectedRoom && SENSOR_STATE[selectedRoom] && (() => {
                        const s = SENSOR_STATE[selectedRoom];
                        const roomLabel = selectedRoom.replace(/_/g,' ');
                        return (
                            <Card className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`w-2 h-2 rounded-full ${SC[s.status] || SC.optimal}`} />
                                    <h3 className="text-sm font-bold text-slate-800">{roomLabel}</h3>
                                    <button onClick={() => setSelectedRoom(null)} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">
                                        <Icon name="x" className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        s.power_w      != null && { label:'Power',    value: s.power_w >= 1000 ? `${(s.power_w/1000).toFixed(1)} kW` : `${s.power_w.toFixed(0)} W`  },
                                        s.temperature_c!= null && { label:'Temp',     value: `${s.temperature_c.toFixed(1)}°C` },
                                        s.occupancy    != null && { label:'Occupancy',value: `${s.occupancy}${s.max_occupancy ? '/'+s.max_occupancy : ''}` },
                                        s.co2_ppm      != null && { label:'CO₂',     value: `${s.co2_ppm} ppm` },
                                        s.fan_speed_pct!= null && { label:'Fan',      value: `${s.fan_speed_pct}%` },
                                        s.damper_angle != null && { label:'Damper',   value: `${s.damper_angle}°` },
                                        s.humidity_pct != null && { label:'Humidity', value: `${s.humidity_pct.toFixed(0)}%` },
                                        s.active_pcs   != null && { label:'PCs',      value: `${s.active_pcs} active` },
                                    ].filter(Boolean).slice(0, 6).map(({ label, value }) => (
                                        <div key={label} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                                            <p className="text-sm font-bold text-slate-800 mt-0.5" style={{ fontFamily:"'DM Mono',monospace" }}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        );
                    })()}
                </div>
            </div>

            {/* ── Row 4: HVAC efficiency + Power breakdown ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* HVAC efficiency matrix */}
                <Card>
                    <CardHead title="HVAC Efficiency Matrix" iconName="hvac"
                              right={<button className="text-[11px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700">Details</button>} />
                    <div className="p-4 grid grid-cols-3 gap-2.5">
                        {HVAC_ZONES.map(z => {
                            const color = z.val >= 85 ? 'bg-emerald-500' : z.val >= 70 ? 'bg-amber-400' : 'bg-red-400';
                            const text  = z.val >= 85 ? 'text-emerald-600' : z.val >= 70 ? 'text-amber-600' : 'text-red-500';
                            return (
                                <div key={z.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors"
                                     onClick={() => setSelectedRoom(z.room)}>
                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                                        <div className={`h-full rounded-full ${color}`} style={{ width:`${z.val}%` }} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-semibold text-slate-500 leading-tight">{z.label}</span>
                                        <span className={`text-[11px] font-bold ${text}`} style={{ fontFamily:"'DM Mono',monospace" }}>{z.val}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="px-4 pb-4">
                        <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3 border border-blue-100">
                            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Icon name="zap" className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-blue-700">AHU Status: Fan {SENSOR_STATE.Mechanical_Room.fan_speed_pct}% · Damper {SENSOR_STATE.Mechanical_Room.damper_angle}°</p>
                                <p className="text-[11px] text-blue-500">Node 3 → Node 6 signal chain active</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Per-room power breakdown */}
                <Card>
                    <CardHead title="Room Power Consumption" iconName="energy" sub="Live INA219 readings — 12V bus" />
                    <div className="divide-y divide-slate-50">
                        {Object.entries(SENSOR_STATE)
                            .filter(([, s]) => s.power_w != null)
                            .sort(([,a],[,b]) => b.power_w - a.power_w)
                            .map(([roomId, s]) => {
                                const maxPower = 15000;
                                const pct = Math.min(100, (s.power_w / maxPower) * 100);
                                const barColor = s.power_w > 5000 ? 'bg-red-400' : s.power_w > 1000 ? 'bg-amber-400' : 'bg-emerald-400';
                                const dotCls   = SC[s.status] ?? SC.optimal;
                                return (
                                    <div key={roomId}
                                         className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${selectedRoom===roomId?'bg-blue-50/50':''}`}
                                         onClick={() => setSelectedRoom(selectedRoom===roomId?null:roomId)}>
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                                        <p className="text-[12px] font-semibold text-slate-700 w-36 truncate shrink-0">
                                            {roomId.replace(/_/g,' ')}
                                        </p>
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${barColor}`} style={{ width:`${pct}%` }} />
                                        </div>
                                        <p className="text-[12px] font-bold text-slate-700 shrink-0 w-16 text-right"
                                           style={{ fontFamily:"'DM Mono',monospace" }}>
                                            {s.power_w >= 1000 ? `${(s.power_w/1000).toFixed(1)} kW` : `${s.power_w.toFixed(0)} W`}
                                        </p>
                                    </div>
                                );
                            })
                        }
                    </div>
                </Card>
            </div>

        </div>
    );
}