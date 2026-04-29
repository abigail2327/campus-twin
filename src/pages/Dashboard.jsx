/**
 * Dashboard.jsx — Simplified Smart Campus View
 * ─────────────────────────────────────────────────────────────────────────────
 * Designed for facility managers, not engineers.
 *
 * Layout:
 *   Top    — Critical alert banner (only when alert exists)
 *   Middle — 3 node status cards | 3D model | Energy summary
 *   Bottom — Quick action buttons
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/panels/Icon';
import { useTheme } from '../context/ThemeContext';
import { DATASET_CAMPUS_KPIS, computeDatasetKPIs } from '../services/datasetState';
import AIPredictionPanel from './AIPredictionPanel';
import SimulationTab     from './SimulationTab';
import { subscribeToRooms, subscribeToPredictions } from '../services/firebase';
import { useLiveSensorState, computeCampusKPIs, deriveAlerts } from '../services/sensorState';

const BuildingTwin3D = lazy(() => import('../components/panels/BuildingTwin3D'));

// ── The 3 active MVP nodes ────────────────────────────────────────────────────
const NODES = [
    {
        id:       'Classroom_1',
        label:    'Classroom 1',
        node:     1,
        type:     'PIR Motion → LED Lighting',
        capacity: 30,
        icon:     'motion',
        color:    '#3b82f6',
    },
    {
        id:       'Classroom_2',
        label:    'Classroom 2',
        node:     2,
        type:     'LDR Lux → Adaptive Dimming',
        capacity: 30,
        icon:     'lighting',
        color:    '#fbbf24',
    },
    {
        id:       'Large_Lecture_Hall',
        label:    'Lecture Hall',
        node:     3,
        type:     'PIR + DHT Temp + Fire Sim + Fan',
        capacity: 75,
        icon:     'temperature',
        color:    '#10b981',
    },
];

// ── Derive a simple status from sensor readings ───────────────────────────────
function getRoomStatus(sensor) {
    if (!sensor) return { level: 'unknown', label: 'No Data',    color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
    if (sensor.fire_alert)                return { level: 'critical', label: 'Fire Alert!',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  };
    if (sensor.temperature_c > 35)        return { level: 'critical', label: 'Temp Spike',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   };
    if (sensor.temperature_c > 28)        return { level: 'warning',  label: 'High Temp',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  };
    if (sensor.lux != null && sensor.lux < 80) return { level: 'warning', label: 'Low Light',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  };
    if (sensor.motion)                    return { level: 'normal',   label: 'Motion Detected', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  };
    if (sensor.occupancy > 0)             return { level: 'normal',   label: 'Occupied',       color: '#10b981', bg: 'rgba(16,185,129,0.1)'  };
    return                                 { level: 'normal',   label: 'Available',     color: '#10b981', bg: 'rgba(16,185,129,0.1)'  };
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusDot({ level, size = 10 }) {
    const colors = { critical:'#ef4444', warning:'#f59e0b', normal:'#10b981', unknown:'#64748b' };
    const col = colors[level] ?? '#64748b';
    return (
        <span className={`rounded-full inline-block shrink-0 ${level === 'critical' ? 'animate-pulse' : ''}`}
              style={{ width: size, height: size, background: col, boxShadow: `0 0 6px ${col}88` }} />
    );
}

// ── Node status card ──────────────────────────────────────────────────────────
function NodeCard({ node, sensor, selected, onSelect, dark }) {
    const status  = getRoomStatus(sensor);
    const occ     = sensor?.occupancy ?? 0;
    const cap     = node.capacity;
    const occPct  = Math.round((occ / cap) * 100);
    // Power is campus-wide (single INA219), not per room — show campus total on LH card only
    const campusPowerW = sensor?.campus_power_w ?? null;
    const powerStr = sensor?.room_id === 'Large_Lecture_Hall' || campusPowerW
        ? (campusPowerW != null ? (campusPowerW >= 1000 ? `${(campusPowerW/1000).toFixed(1)} kW` : `${Math.round(campusPowerW)} W`) : '—')
        : null;

    const bg     = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
    const border = selected
        ? `2px solid ${node.color}`
        : dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
    const textPrimary   = dark ? '#f1f5f9' : '#0f172a';
    const textSecondary = dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)';

    return (
        <div onClick={() => onSelect(selected ? null : node.id)}
             className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
             style={{ background: bg, border, boxShadow: selected ? `0 0 20px ${node.color}33` : '0 2px 12px rgba(0,0,0,0.08)' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                         style={{ background: `${node.color}20` }}>
                        <Icon name={node.icon} className="w-4 h-4" style={{ color: node.color }} />
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight" style={{ color: textPrimary }}>{node.label}</p>
                        <p className="text-[10px] font-semibold" style={{ color: node.color }}>Node {node.node}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <StatusDot level={status.level} />
                </div>
            </div>

            {/* Status label */}
            <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>
            </div>

            {/* Key metrics — 2 most important things */}
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2.5"
                     style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                       style={{ color: textSecondary }}>Occupancy</p>
                    <p className="text-sm font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                        {occ}<span className="text-[10px] font-normal" style={{ color: textSecondary }}>/{cap}</span>
                    </p>
                    <div className="mt-1.5 h-1 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        <div className="h-full rounded-full transition-all"
                             style={{ width:`${occPct}%`, background: occPct > 85 ? '#ef4444' : occPct > 60 ? '#f59e0b' : node.color }} />
                    </div>
                </div>
                <div className="rounded-xl p-2.5"
                     style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                       style={{ color: textSecondary }}>Campus Load</p>
                    <p className="text-sm font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                        {powerStr}
                    </p>
                    {/* Show the primary sensor for this room */}
                    {sensor?.motion != null && node.id === 'Classroom_1' && (
                        <p className="text-[10px] mt-1 font-semibold" style={{ color: sensor.motion ? '#3b82f6' : textSecondary }}>
                            {sensor.motion ? '● Motion detected' : '○ No motion'}
                        </p>
                    )}
                    {sensor?.lux != null && node.id === 'Classroom_2' && (
                        <p className="text-[10px] mt-1 font-semibold" style={{ color: sensor.lux < 80 ? '#f59e0b' : '#10b981', fontFamily:"'DM Mono',monospace" }}>
                            {sensor.lux} lx ambient
                        </p>
                    )}
                    {sensor?.temperature_c != null && node.id === 'Large_Lecture_Hall' && (
                        <p className="text-[10px] mt-1 font-semibold" style={{ color: sensor.temperature_c > 35 ? '#ef4444' : sensor.temperature_c > 28 ? '#f59e0b' : '#10b981', fontFamily:"'DM Mono',monospace" }}>
                            {sensor.temperature_c.toFixed(1)}°C indoor
                        </p>
                    )}
                </div>
            </div>

            {/* Sensor type label */}
            <p className="text-[9px] mt-2.5 font-semibold uppercase tracking-widest"
               style={{ color: textSecondary }}>{node.type}</p>
        </div>
    );
}

// ── Energy summary card ───────────────────────────────────────────────────────
function EnergySummary({ kpi, dark }) {
    const bg          = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
    const border      = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
    const textPrimary = dark ? '#f1f5f9' : '#0f172a';
    const textMuted   = dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.4)';
    const wastePct    = kpi.wastePct ?? 12.3;
    const wasteColor  = wastePct > 20 ? '#ef4444' : wastePct > 10 ? '#f59e0b' : '#10b981';

    return (
        <div className="rounded-2xl p-4 flex flex-col gap-3"
             style={{ background: bg, border, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                Today's Energy
            </p>

            {/* Main energy number */}
            <div>
                <p className="text-3xl font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                    {kpi.energyToday_kwh ?? DATASET_CAMPUS_KPIS.total_energy_kwh}
                    <span className="text-base font-normal ml-1" style={{ color: textMuted }}>kWh</span>
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>across 3 active nodes</p>
            </div>

            {/* Waste */}
            <div className="rounded-xl p-3" style={{ background: `${wasteColor}12`, border:`1px solid ${wasteColor}30` }}>
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: wasteColor }}>
                        Energy Wasted
                    </p>
                    <p className="text-sm font-bold" style={{ color: wasteColor, fontFamily:"'DM Mono',monospace" }}>
                        {wastePct}%
                    </p>
                </div>
                <p className="text-lg font-bold" style={{ color: wasteColor, fontFamily:"'DM Mono',monospace" }}>
                    {kpi.wasteToday_kwh ?? DATASET_CAMPUS_KPIS.total_waste_kwh}
                    <span className="text-sm font-normal ml-1" style={{ color: wasteColor, opacity:0.7 }}>kWh</span>
                </p>
                <p className="text-[10px] mt-1" style={{ color: wasteColor, opacity:0.7 }}>
                    Lights/HVAC on in empty rooms
                </p>
            </div>

            {/* Outdoor temp */}
            <div className="flex items-center justify-between pt-1 border-t"
                 style={{ borderColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                <p className="text-[11px]" style={{ color: textMuted }}>Outdoor temp</p>
                <p className="text-sm font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                    {DATASET_CAMPUS_KPIS.outdoor_temp_c ?? 34}°C
                </p>
            </div>
        </div>
    );
}

// ── Occupancy Spike Prediction Panel ─────────────────────────────────────────
// Reads from /predictions/* (written by inference.py every 5s)
// Shows WHERE and WHEN occupancy is about to spike across all 3 nodes
const SPIKE_NODES = [
    { dashId:'Classroom_1',        fbId:'classroom-1',  label:'Classroom A', color:'#3b82f6', cap:30  },
    { dashId:'Classroom_2',        fbId:'classroom-2',  label:'Classroom B', color:'#fbbf24', cap:30  },
    { dashId:'Large_Lecture_Hall', fbId:'lecture-hall', label:'Lecture Hall',color:'#f87171', cap:75  },
];

function OccupancySpikePanel({ sensorState, dark }) {
    const [predictions, setPredictions] = useState({});
    const [lastUpdate,  setLastUpdate]  = useState(null);

    useEffect(() => {
        const unsub = subscribeToPredictions(data => {
            if (data && Object.keys(data).length > 0) {
                setPredictions(data);
                setLastUpdate(new Date());
            }
        });
        return unsub;
    }, []);

    // For each node determine: current state + 30-min forecast from inference.py
    const spikes = SPIKE_NODES.map(node => {
        const sensor = sensorState?.[node.dashId] ?? {};
        const pred   = predictions[node.fbId] ?? predictions[node.dashId] ?? null;

        // Current occupancy signal
        const isOccupiedNow = node.dashId === 'Classroom_1' ? !!sensor.motion
            : node.dashId === 'Classroom_2' ? (sensor.lux ?? 0) > 50
                : (sensor.temperature_c ?? 0) > 0;

        const forecast    = pred?.forecast_30min ?? null;   // "OCCUPIED" | "EMPTY"
        const confidence  = pred?.confidence ?? null;
        const alerts      = pred?.alerts ?? [];
        const hasFireAlert = sensor.fire_alert || alerts.includes('FIRE_ANOMALY');
        const hasPowerLeak = alerts.includes('POWER_LEAK');

        // Spike = currently empty but forecast says OCCUPIED in 30 min
        const isSpiking   = !isOccupiedNow && forecast === 'OCCUPIED';
        // Waste  = currently occupied but forecast says EMPTY (lights/power wasted)
        const isWaste     = isOccupiedNow  && forecast === 'EMPTY';

        return { ...node, sensor, pred, isOccupiedNow, forecast, confidence,
            isSpiking, isWaste, hasFireAlert, hasPowerLeak, alerts };
    });

    const hasSpike    = spikes.some(s => s.isSpiking);
    const hasAlert    = spikes.some(s => s.hasFireAlert || s.hasPowerLeak);
    const hasPred     = spikes.some(s => s.forecast !== null);

    const panelBg     = dark ? 'rgba(8,14,26,0.95)' : 'rgba(255,255,255,0.97)';
    const panelBorder = dark ? '1px solid rgba(30,58,95,0.8)' : '1px solid rgba(226,232,240,1)';
    const labelColor  = dark ? '#64748b' : '#94a3b8';
    const textColor   = dark ? '#e2e8f0' : '#0f172a';

    return (
        <div style={{ background: panelBg, border: panelBorder, borderRadius: 16,
            padding: '14px 16px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>

            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔮</span>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: textColor, margin: 0 }}>
                            30-Min Occupancy Forecast
                        </p>
                        <p style={{ fontSize: 9, color: labelColor, margin: 0, letterSpacing:'0.05em' }}>
                            {hasPred
                                ? `inference.py · updated ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
                                : 'Run inference.py to see live predictions'}
                        </p>
                    </div>
                </div>
                {hasAlert && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding:'3px 8px', borderRadius: 20,
                        background:'rgba(239,68,68,0.12)', color:'#ef4444',
                        border:'1px solid rgba(239,68,68,0.3)', letterSpacing:'0.08em' }}>
            ⚠ ALERT ACTIVE
          </span>
                )}
                {!hasAlert && hasSpike && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding:'3px 8px', borderRadius: 20,
                        background:'rgba(245,158,11,0.12)', color:'#f59e0b',
                        border:'1px solid rgba(245,158,11,0.3)', letterSpacing:'0.08em' }}>
            SPIKE INCOMING
          </span>
                )}
                {!hasAlert && !hasSpike && hasPred && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding:'3px 8px', borderRadius: 20,
                        background:'rgba(16,185,129,0.1)', color:'#10b981',
                        border:'1px solid rgba(16,185,129,0.25)', letterSpacing:'0.08em' }}>
            ALL NORMAL
          </span>
                )}
            </div>

            {/* Node rows */}
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                {spikes.map(node => {
                    const conf    = node.confidence != null ? Math.round(node.confidence * 100) : null;
                    const rowBg   = node.hasFireAlert  ? 'rgba(239,68,68,0.08)'
                        : node.hasPowerLeak ? 'rgba(245,158,11,0.08)'
                            : node.isSpiking    ? 'rgba(59,130,246,0.08)'
                                : 'transparent';
                    const rowBorder = node.hasFireAlert  ? '1px solid rgba(239,68,68,0.25)'
                        : node.hasPowerLeak ? '1px solid rgba(245,158,11,0.2)'
                            : node.isSpiking    ? '1px solid rgba(59,130,246,0.2)'
                                : `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`;

                    const forecastColor = node.hasFireAlert ? '#ef4444'
                        : node.isSpiking   ? '#f59e0b'
                            : node.forecast === 'OCCUPIED' ? '#10b981'
                                : node.forecast === 'EMPTY'    ? '#64748b'
                                    : '#334155';

                    const forecastLabel = node.hasFireAlert  ? '⚠ FIRE ALERT'
                        : node.hasPowerLeak ? '⚡ POWER LEAK'
                            : node.isSpiking    ? '↑ Spike in 30min'
                                : node.isWaste      ? '↓ Will Empty Soon'
                                    : node.forecast === 'OCCUPIED' ? '✓ Stays Occupied'
                                        : node.forecast === 'EMPTY'    ? '○ Will Stay Empty'
                                            : '— Awaiting data';

                    return (
                        <div key={node.dashId}
                             style={{ display:'flex', alignItems:'center', gap: 10, padding:'7px 10px',
                                 borderRadius: 10, background: rowBg, border: rowBorder }}>
                            {/* Color bar */}
                            <div style={{ width: 3, height: 28, borderRadius: 2, background: node.color, flexShrink: 0 }} />

                            {/* Room name + current */}
                            <div style={{ minWidth: 90 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: textColor, margin: 0 }}>{node.label}</p>
                                <p style={{ fontSize: 9, color: labelColor, margin: 0, fontFamily:"'DM Mono',monospace" }}>
                                    {node.dashId === 'Classroom_1'
                                        ? (node.isOccupiedNow ? '● Motion' : '○ Clear')
                                        : node.dashId === 'Classroom_2'
                                            ? (node.sensor.lux != null ? `${node.sensor.lux} lx` : '— lx')
                                            : (node.sensor.temperature_c != null ? `${node.sensor.temperature_c.toFixed(1)}°C` : '—')}
                                </p>
                            </div>

                            {/* Now → arrow → 30min */}
                            <div style={{ display:'flex', alignItems:'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, fontFamily:"'DM Mono',monospace",
                    padding:'2px 7px', borderRadius: 6,
                    background: node.isOccupiedNow ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                    color: node.isOccupiedNow ? '#10b981' : '#64748b',
                    border: `1px solid ${node.isOccupiedNow ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.15)'}` }}>
                  {node.isOccupiedNow ? 'OCC' : 'EMPTY'}
                </span>
                                <span style={{ fontSize: 9, color: labelColor }}>→ +30m →</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: forecastColor,
                                    fontFamily:"'DM Mono',monospace" }}>
                  {forecastLabel}
                </span>
                            </div>

                            {/* Confidence */}
                            {conf != null && (
                                <div style={{ textAlign:'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: 9, color: labelColor, margin: 0 }}>confidence</p>
                                    <p style={{ fontSize: 11, fontWeight: 700, margin: 0, fontFamily:"'DM Mono',monospace",
                                        color: conf > 80 ? '#10b981' : '#f59e0b' }}>{conf}%</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer hint */}
            {!hasPred && (
                <p style={{ fontSize: 9, color: labelColor, marginTop: 8, textAlign:'center', letterSpacing:'0.05em' }}>
                    Start inference.py on your laptop · or use Simulation tab to inject test data
                </p>
            )}
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
    const navigate    = useNavigate();
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [activeTab,    setActiveTab]    = useState('dashboard');
    const { dark } = useTheme();

    const { sensorState, campusTime, isLive } = useLiveSensorState();
    const liveKPI   = computeCampusKPIs(sensorState);
    const dataKPI   = computeDatasetKPIs();
    const KPI       = { ...dataKPI, ...liveKPI };
    KPI.energyToday_kwh = DATASET_CAMPUS_KPIS.total_energy_kwh;
    KPI.wasteToday_kwh  = DATASET_CAMPUS_KPIS.total_waste_kwh;
    KPI.wastePct        = DATASET_CAMPUS_KPIS.waste_pct;

    const ALERTS      = deriveAlerts(sensorState, campusTime);
    const topAlert    = ALERTS.find(a => a.severity === 'critical') ?? ALERTS[0];
    const critCount   = ALERTS.filter(a => a.severity === 'critical').length;
    const warnCount   = ALERTS.filter(a => a.severity === 'warning').length;

    // Theme colours
    const pageBg     = dark ? '#0d0f14' : '#f0f4ff';
    const textPrimary  = dark ? '#f1f5f9' : '#0f172a';
    const textSecondary = dark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)';
    const gridColor  = dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.04)';

    return (
        <div className="-m-5 flex flex-col" style={{ minHeight:'calc(100vh - 3.5rem)', background: pageBg }}>

            {/* Grid texture */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px),
                          linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
            }} />

            <div className="relative z-10 flex flex-col flex-1 gap-4 p-6">

                {/* ── Tab navigation ──────────────────────────────────────────── */}
                <div className="flex border-b" style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)' }}>
                    {[
                        { id:'dashboard',  label:'Live Dashboard', icon:'⬡' },
                        { id:'ai',         label:'AI Predictions',  icon:'◈' },
                        { id:'simulation', label:'Simulation',      icon:'◷' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold -mb-px transition-all"
                                style={{
                                    borderBottom: activeTab === tab.id
                                        ? `2px solid ${dark ? '#f1f5f9' : '#0f172a'}`
                                        : '2px solid transparent',
                                    color: activeTab === tab.id
                                        ? (dark ? '#f1f5f9' : '#0f172a')
                                        : (dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.4)'),
                                }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── AI Predictions tab ─────────────────────────────────────── */}
                {activeTab === 'ai' && (
                    <div className="bg-white rounded-2xl p-6" style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                        <AIPredictionPanel />
                    </div>
                )}

                {/* ── Simulation tab ──────────────────────────────────────────── */}
                {activeTab === 'simulation' && <SimulationTab />}

                {/* ── Main dashboard content ──────────────────────────────────── */}
                {activeTab === 'dashboard' && (
                    <div className="contents">

                        {/* ── Page header ─────────────────────────────────────────────── */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
                                    Smart Campus Digital Twin
                                </h1>
                                <p className="text-[12px] mt-0.5" style={{ color: textSecondary }}>
                                    RIT Dubai · {DATASET_CAMPUS_KPIS.day_label}
                                    {isLive
                                        ? <span className="ml-2 text-emerald-500 font-semibold">· Live</span>
                                        : <span className="ml-2 text-amber-500 font-semibold">· Simulated Data</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => navigate('/alerts')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                                        style={{ background: critCount > 0 ? 'rgba(239,68,68,0.12)' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                            color: critCount > 0 ? '#ef4444' : textSecondary,
                                            border: `1px solid ${critCount > 0 ? 'rgba(239,68,68,0.3)' : dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                                    <Icon name="alerts" className="w-4 h-4" />
                                    {critCount + warnCount > 0 ? `${critCount + warnCount} Alert${critCount + warnCount > 1 ? 's' : ''}` : 'No Alerts'}
                                </button>
                                <button onClick={() => window.open('/twin3d','_blank')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                                        style={{ background:'rgba(37,99,235,0.8)', border:'1px solid rgba(59,130,246,0.4)' }}>
                                    <Icon name="externalLink" className="w-4 h-4" />
                                    Fullscreen 3D
                                </button>
                            </div>
                        </div>

                        {/* ── Alert banner — only shows when there's an alert ─────────── */}
                        {topAlert && (
                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer transition-all hover:opacity-90"
                                 style={{ background: topAlert.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                     border: `1px solid ${topAlert.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}
                                 onClick={() => navigate('/alerts')}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                     style={{ background: topAlert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)' }}>
                                    <Icon name={topAlert.severity === 'critical' ? 'critical' : 'warning'} className="w-4 h-4"
                                          style={{ color: topAlert.severity === 'critical' ? '#ef4444' : '#f59e0b' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate"
                                       style={{ color: topAlert.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                                        {topAlert.message}
                                    </p>
                                    <p className="text-[11px]" style={{ color: textSecondary }}>
                                        Node {topAlert.node} · {topAlert.time}
                                        {ALERTS.length > 1 && <span className="ml-2 font-semibold">+{ALERTS.length - 1} more</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold"
                                     style={{ color: topAlert.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                                    View All <Icon name="chevronRight" className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        )}

                        {/* ── Main content: node cards | 3D model | energy ────────────── */}
                        <div className="flex flex-1 gap-4 min-h-0" style={{ minHeight: 460 }}>

                            {/* Left — node status cards */}
                            <div className="flex flex-col gap-3 shrink-0" style={{ width: 220 }}>
                                {NODES.map(node => (
                                    <NodeCard
                                        key={node.id}
                                        node={node}
                                        sensor={sensorState?.[node.id]}
                                        selected={selectedRoom === node.id}
                                        onSelect={setSelectedRoom}
                                        dark={dark}
                                    />
                                ))}
                            </div>

                            {/* Centre — 3D model */}
                            <div className="flex-1 relative rounded-2xl overflow-hidden" style={{ minHeight: 460 }}>
                                <Suspense fallback={
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
                                         style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                                             border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)' }}>
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-sm font-semibold" style={{ color: textSecondary }}>Loading 3D Model…</p>
                                    </div>
                                }>
                                    <BuildingTwin3D
                                        sensorState={sensorState}
                                        selectedRoom={selectedRoom}
                                        onRoomSelect={setSelectedRoom}
                                        height="100%"
                                        compact={true}
                                    />
                                </Suspense>

                                {/* Subtle label */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                                    <p className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
                                       style={{ background: dark ? 'rgba(13,15,20,0.8)' : 'rgba(255,255,255,0.85)',
                                           color: textSecondary,
                                           border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)' }}>
                                        Click any room for details · Drag to orbit · Scroll to zoom
                                    </p>
                                </div>
                            </div>

                            {/* Right — energy summary + total occupancy */}
                            <div className="flex flex-col gap-3 shrink-0" style={{ width: 220 }}>
                                <EnergySummary kpi={KPI} dark={dark} />

                                {/* Total occupancy */}
                                <div className="rounded-2xl p-4"
                                     style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
                                         border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                                         boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textSecondary }}>
                                        Total Occupancy
                                    </p>
                                    <p className="text-3xl font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                                        {KPI.totalOccupancy}
                                        <span className="text-base font-normal ml-1" style={{ color: textSecondary }}>
                  / {KPI.maxOccupancy ?? 135}
                </span>
                                    </p>
                                    <div className="mt-2 h-2 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                        <div className="h-full rounded-full transition-all"
                                             style={{ width:`${KPI.occupancyPct}%`,
                                                 background: KPI.occupancyPct > 85 ? '#ef4444' : KPI.occupancyPct > 60 ? '#f59e0b' : '#10b981' }} />
                                    </div>
                                    <p className="text-[11px] mt-1" style={{ color: textSecondary }}>
                                        {KPI.occupancyPct}% of total capacity
                                    </p>
                                </div>

                                {/* Navigate to analytics */}
                                <button onClick={() => navigate('/analytics')}
                                        className="rounded-2xl p-4 text-left transition-all hover:opacity-80 group"
                                        style={{ background: 'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)' }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">AI Analytics</p>
                                        <Icon name="chevronRight" className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                    <p className="text-sm font-semibold text-blue-300">View AI predictions</p>
                                    <p className="text-[11px] text-blue-400/60 mt-0.5">Occupancy · Energy · Lighting</p>
                                </button>
                            </div>
                        </div>

                        {/* ── Occupancy Spike Prediction ───────────────────────────────── */}
                        <OccupancySpikePanel sensorState={sensorState} dark={dark} />

                        {/* ── Bottom action row ────────────────────────────────────────── */}
                        <div className="flex items-center gap-3">
                            {[
                                { label:'View Analytics',   icon:'activity',     path:'/analytics', color:'#10b981' },
                                { label:'Alerts & Events',  icon:'alerts',       path:'/alerts',    color:'#ef4444', badge: ALERTS.length > 0 ? ALERTS.length : null },
                                { label:'Device Twin',      icon:'cpu',          path:'/devices',   color:'#3b82f6' },
                                { label:'Ontology Graph',   icon:'layers',       path:'/ontology',  color:'#8b5cf6' },
                                { label:'Building Overview',icon:'building',     path:'/building',  color:'#f59e0b' },
                            ].map(action => (
                                <button key={action.path}
                                        onClick={() => navigate(action.path)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
                                        style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                                            border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                                            color: action.color }}>
                                    <Icon name={action.icon} className="w-4 h-4" />
                                    {action.label}
                                    {action.badge && (
                                        <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                                              style={{ background: action.color }}>
                  {action.badge}
                </span>
                                    )}
                                </button>
                            ))}
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}