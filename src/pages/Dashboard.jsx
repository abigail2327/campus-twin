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
        capacity: null,   // no occupancy sensor in this room
        icon:     'lighting',
        color:    '#fbbf24',
    },
    {
        id:       'Large_Lecture_Hall',
        label:    'Multipurpose Hall',
        node:     3,
        type:     'DHT Temp + PIR + Fire Sim + Fan',
        capacity: 100,
        icon:     'temperature',
        color:    '#10b981',
    },
];

// ── Derive a simple status from real sensor readings ──────────────────────────
function getRoomStatus(sensor) {
    if (!sensor || sensor.status === 'offline') return { level:'offline', label:'No Uplink',  color:'#64748b', bg:'rgba(100,116,139,0.1)' };
    if (sensor.fire_alert)          return { level:'critical', label:'Fire Alert!',     color:'#ef4444', bg:'rgba(239,68,68,0.15)'  };
    if (sensor.temperature_c > 35)  return { level:'critical', label:'Temp Spike',      color:'#ef4444', bg:'rgba(239,68,68,0.1)'   };
    if (sensor.temperature_c > 28)  return { level:'warning',  label:'High Temp',       color:'#f59e0b', bg:'rgba(245,158,11,0.1)'  };
    if (sensor.lux != null && sensor.lux < 80) return { level:'warning', label:'Low Light', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' };
    if (sensor.motion)              return { level:'normal',   label:'Motion Detected', color:'#3b82f6', bg:'rgba(59,130,246,0.1)'  };
    if (sensor.occupied)            return { level:'normal',   label:'Occupied',        color:'#10b981', bg:'rgba(16,185,129,0.1)'  };
    if (sensor.occupancy > 0)       return { level:'normal',   label:'Occupied',        color:'#10b981', bg:'rgba(16,185,129,0.1)'  };
    return                           { level:'normal',   label:'Available',      color:'#10b981', bg:'rgba(16,185,129,0.1)'  };
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

    const isOffline = !sensor || sensor.status === 'offline' || sensor.online === false;

    const bg     = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
    const border = selected
        ? `2px solid ${node.color}`
        : dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
    const textPrimary   = dark ? '#f1f5f9' : '#0f172a';
    const textSecondary = dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)';

    // ── Offline card ─────────────────────────────────────────────────────────────
    if (isOffline) {
        return (
            <div onClick={() => onSelect(selected ? null : node.id)}
                 className="rounded-2xl p-4 cursor-pointer transition-all"
                 style={{ background: bg, border, opacity: 0.6,
                     boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                             style={{ background: 'rgba(100,116,139,0.1)' }}>
                            <Icon name={node.icon} className="w-4 h-4" style={{ color: '#475569' }} />
                        </div>
                        <div>
                            <p className="text-sm font-bold leading-tight" style={{ color: textPrimary }}>{node.label}</p>
                            <p className="text-[10px] font-semibold text-slate-400">Node {node.node}</p>
                        </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-lg text-slate-500"
                      style={{ background: 'rgba(100,116,139,0.1)' }}>
          No Uplink
        </span>
                <p className="text-[10px] mt-3 leading-relaxed" style={{ color: textSecondary }}>
                    Waiting for LoRa uplink via TTN → Ditto → Firebase
                </p>
                <p className="text-[9px] mt-1.5 font-semibold uppercase tracking-widest"
                   style={{ color: textSecondary }}>{node.type}</p>
            </div>
        );
    }

    // ── Live card ─────────────────────────────────────────────────────────────────
    const status = getRoomStatus(sensor);
    const metricBg = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

    // Per-room metric config
    const isC1 = node.id === 'Classroom_1';
    const isC2 = node.id === 'Classroom_2';
    const isLH = node.id === 'Large_Lecture_Hall';

    // CR1: binary occupancy from PIR (0 or 1) — shown as a pill, not a count
    const cr1Occupied = isC1 ? (sensor.occupancy != null ? sensor.occupancy > 0 : sensor.motion) : null;

    // LH: occupancy as headcount from occupancy_pct
    const lhOccupancy    = isLH ? sensor.occupancy     : null;
    const lhOccupancyPct = isLH ? sensor.occupancy_pct : null;

    // Right metric per room
    const rightLabel = isC2 ? 'Ambient Lighting' : isLH ? 'Temperature' : 'Power Draw';
    const rightValue = isC2
        ? (sensor.lux != null ? `${sensor.lux} lx` : '—')
        : isLH
            ? (sensor.temperature_c != null ? `${sensor.temperature_c.toFixed(1)}°C` : '—')
            : (sensor.power_w != null ? (sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(2)} kW` : `${Math.round(sensor.power_w)} W`) : '—');
    const rightColor = isC2
        ? (sensor.lux != null && sensor.lux < 80 ? '#f59e0b' : '#10b981')
        : isLH
            ? (sensor.temperature_c > 35 ? '#ef4444' : sensor.temperature_c > 28 ? '#f59e0b' : '#10b981')
            : textPrimary;

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
                <StatusDot level={status.level} />
            </div>

            {/* Status label */}
            <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>
            </div>

            {/* Metrics grid */}
            <div className={`grid gap-2 ${isLH ? 'grid-cols-2' : 'grid-cols-1'}`}>

                {/* CR1 — binary occupancy pill (PIR: 0 or 1) */}
                {isC1 && (
                    <div className="rounded-xl p-2.5" style={{ background: metricBg }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
                           style={{ color: textSecondary }}>Occupancy</p>
                        <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cr1Occupied ? '#10b981' : '#475569',
                        boxShadow: cr1Occupied ? '0 0 6px #10b981' : 'none' }} />
                            <span className="text-sm font-bold" style={{
                                color: cr1Occupied ? '#10b981' : textSecondary,
                                fontFamily:"'DM Mono',monospace"
                            }}>
                {cr1Occupied == null ? '—' : cr1Occupied ? 'OCCUPIED' : 'VACANT'}
              </span>
                        </div>
                    </div>
                )}

                {/* CR2 — single full-width metric (no occupancy) */}
                {isC2 && (
                    <div className="rounded-xl p-2.5" style={{ background: metricBg }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                           style={{ color: textSecondary }}>{rightLabel}</p>
                        <p className="text-sm font-bold" style={{ color: rightColor, fontFamily:"'DM Mono',monospace" }}>
                            {rightValue}
                        </p>
                        {sensor.brightness != null && (
                            <p className="text-[10px] mt-1" style={{ color: textSecondary }}>
                                LED {sensor.brightness}% brightness
                            </p>
                        )}
                    </div>
                )}

                {/* LH — left: occupancy headcount, right: temperature */}
                {isLH && (
                    <>
                        <div className="rounded-xl p-2.5" style={{ background: metricBg }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                               style={{ color: textSecondary }}>Occupancy</p>
                            <p className="text-sm font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                                {lhOccupancy != null ? lhOccupancy : '—'}
                                {node.capacity && lhOccupancy != null && (
                                    <span className="text-[10px] font-normal" style={{ color: textSecondary }}>/{node.capacity}</span>
                                )}
                            </p>
                            {lhOccupancyPct != null && (
                                <>
                                    <div className="mt-1.5 h-1 rounded-full overflow-hidden"
                                         style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                        <div className="h-full rounded-full transition-all"
                                             style={{ width:`${Math.min(100, lhOccupancyPct)}%`,
                                                 background: lhOccupancyPct > 85 ? '#ef4444' : lhOccupancyPct > 60 ? '#f59e0b' : node.color }} />
                                    </div>
                                    <p className="text-[10px] mt-1" style={{ color: textSecondary }}>{lhOccupancyPct}% full</p>
                                </>
                            )}
                        </div>
                        <div className="rounded-xl p-2.5" style={{ background: metricBg }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                               style={{ color: textSecondary }}>{rightLabel}</p>
                            <p className="text-sm font-bold" style={{ color: rightColor, fontFamily:"'DM Mono',monospace" }}>
                                {rightValue}
                            </p>
                            {sensor.fan_speed_pct != null && (
                                <p className="text-[10px] mt-1" style={{ color: textSecondary }}>
                                    Fan {sensor.fan_speed_pct}%
                                </p>
                            )}
                        </div>
                    </>
                )}

            </div>

            {/* Sensor type label */}
            <p className="text-[9px] mt-2.5 font-semibold uppercase tracking-widest"
               style={{ color: textSecondary }}>{node.type}</p>
        </div>
    );
}

// ── Energy summary card ───────────────────────────────────────────────────────
function EnergySummary({ kpi, sensorState, dark }) {
    const bg          = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
    const border      = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
    const textPrimary = dark ? '#f1f5f9' : '#0f172a';
    const textMuted   = dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.4)';

    // Live power draw from Firebase energy.powerDraw (classroom-1 node has INA219)
    // firebase.js maps energy.powerDraw (mW) → power_w (W) for Classroom_1
    const livePowerW   = sensorState?.Classroom_1?.power_w ?? null;
    const isLive       = livePowerW != null && livePowerW > 0;
    const livePowerStr = isLive
        ? (livePowerW >= 1000 ? `${(livePowerW/1000).toFixed(2)} kW` : `${Math.round(livePowerW)} W`)
        : null;

    const wastePct  = kpi.wastePct ?? 12.3;
    const wasteColor = wastePct > 20 ? '#ef4444' : wastePct > 10 ? '#f59e0b' : '#10b981';

    return (
        <div className="rounded-2xl p-4 flex flex-col gap-3"
             style={{ background: bg, border, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                    Today's Energy
                </p>
                {isLive && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
                )}
            </div>

            {/* Main energy number — live powerDraw if available */}
            <div>
                {isLive ? (
                    <>
                        <p className="text-3xl font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                            {livePowerStr}
                            <span className="text-sm font-normal ml-1" style={{ color: textMuted }}>now</span>
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                            from energy.powerDraw · Node 1
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-3xl font-bold" style={{ color: textPrimary, fontFamily:"'DM Mono',monospace" }}>
                            {kpi.energyToday_kwh ?? DATASET_CAMPUS_KPIS.total_energy_kwh}
                            <span className="text-base font-normal ml-1" style={{ color: textMuted }}>kWh</span>
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>dataset reference · no live data</p>
                    </>
                )}
            </div>

            {/* Waste */}
            <div className="rounded-xl p-3" style={{ background:`${wasteColor}12`, border:`1px solid ${wasteColor}30` }}>
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
const SPIKE_NODES = [
    { dashId:'Classroom_1',        fbId:'classroom-1',  label:'Classroom A', node:1, color:'#3b82f6' },
    { dashId:'Classroom_2',        fbId:'classroom-2',  label:'Classroom B', node:2, color:'#f59e0b' },
    { dashId:'Large_Lecture_Hall', fbId:'lecture-hall', label:'Multipurpose Hall', node:3, color:'#f87171' },
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

    const spikes = SPIKE_NODES.map(node => {
        const sensor = sensorState?.[node.dashId] ?? {};
        const pred   = predictions[node.fbId] ?? predictions[node.dashId] ?? null;

        const isOccupiedNow = node.dashId === 'Classroom_1' ? !!sensor.motion
            : node.dashId === 'Classroom_2' ? (sensor.lux ?? 0) > 50
                : (sensor.temperature_c ?? 0) > 0;

        const forecast     = pred?.forecast_30min ?? null;
        const confidence   = pred?.confidence ?? null;
        const alerts       = pred?.alerts ?? [];
        const hasFireAlert = sensor.fire_alert || alerts.includes('FIRE_ANOMALY');
        const hasPowerLeak = alerts.includes('POWER_LEAK');
        const isSpiking    = !isOccupiedNow && forecast === 'OCCUPIED';
        const isWaste      = isOccupiedNow  && forecast === 'EMPTY';

        return { ...node, sensor, pred, isOccupiedNow, forecast, confidence,
            isSpiking, isWaste, hasFireAlert, hasPowerLeak };
    });

    const hasAlert = spikes.some(s => s.hasFireAlert || s.hasPowerLeak);
    const hasSpike = spikes.some(s => s.isSpiking);
    const hasPred  = spikes.some(s => s.forecast !== null);

    const bg     = dark ? 'rgba(8,12,22,0.98)' : '#ffffff';
    const border = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0';
    const text   = dark ? '#f1f5f9' : '#0f172a';
    const muted  = dark ? '#475569' : '#94a3b8';
    const subtle = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
    const subtleBorder = dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9';

    // Global status badge
    const statusBadge = hasAlert
        ? { label:'ALERT ACTIVE',   bg:'rgba(239,68,68,0.1)',    color:'#ef4444', border:'rgba(239,68,68,0.3)'   }
        : hasSpike
            ? { label:'SPIKE INCOMING', bg:'rgba(245,158,11,0.1)',   color:'#f59e0b', border:'rgba(245,158,11,0.3)'  }
            : hasPred
                ? { label:'ALL CLEAR',      bg:'rgba(16,185,129,0.08)',  color:'#10b981', border:'rgba(16,185,129,0.25)' }
                : null;

    return (
        <div style={{ background:bg, border, borderRadius:14,
            boxShadow: hasAlert ? '0 0 0 1px rgba(239,68,68,0.2), 0 2px 16px rgba(0,0,0,0.1)'
                : hasSpike ? '0 0 0 1px rgba(245,158,11,0.15), 0 2px 16px rgba(0,0,0,0.08)'
                    : '0 1px 8px rgba(0,0,0,0.07)' }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', borderBottom:`1px solid ${subtleBorder}` }}>
                <div>
                    <p style={{ fontSize:11, fontWeight:700, color:text, margin:0, letterSpacing:'0.03em' }}>
                        30-MIN OCCUPANCY FORECAST
                    </p>
                    <p style={{ fontSize:9, color:muted, margin:'2px 0 0', letterSpacing:'0.04em' }}>
                        {hasPred
                            ? `AI model · inference.py · last updated ${lastUpdate?.toLocaleTimeString() ?? '—'}`
                            : 'Start inference.py on your laptop to see live predictions'}
                    </p>
                </div>
                {statusBadge && (
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em',
                        padding:'4px 10px', borderRadius:6,
                        background: statusBadge.bg, color: statusBadge.color,
                        border:`1px solid ${statusBadge.border}` }}>
            {statusBadge.label}
          </span>
                )}
            </div>

            {/* Node rows */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
                gap:0, padding:'0' }}>
                {spikes.map((node, i) => {
                    const conf  = node.confidence != null ? Math.round(node.confidence * 100) : null;
                    const isLast = i === spikes.length - 1;

                    // Row accent
                    const rowAccent = node.hasFireAlert ? '#ef4444'
                        : node.hasPowerLeak ? '#f59e0b'
                            : node.isSpiking    ? '#f59e0b'
                                : node.isWaste      ? '#64748b'
                                    : node.forecast === 'OCCUPIED' ? '#10b981'
                                        : '#475569';

                    const statusText = node.hasFireAlert  ? 'FIRE ALERT'
                        : node.hasPowerLeak ? 'POWER LEAK'
                            : node.isSpiking    ? 'SPIKE IN 30 MIN'
                                : node.isWaste      ? 'WILL EMPTY SOON'
                                    : node.forecast === 'OCCUPIED' ? 'STAYS OCCUPIED'
                                        : node.forecast === 'EMPTY'    ? 'STAYS EMPTY'
                                            : 'NO DATA YET';

                    const nowLabel = node.dashId === 'Classroom_1'
                        ? (node.isOccupiedNow ? 'MOTION' : 'CLEAR')
                        : node.dashId === 'Classroom_2'
                            ? (node.sensor.lux != null ? `${node.sensor.lux} LX` : '— LX')
                            : (node.sensor.temperature_c != null ? `${node.sensor.temperature_c.toFixed(1)}C` : '—');

                    const rowBg = node.hasFireAlert ? (dark ? 'rgba(239,68,68,0.07)' : 'rgba(239,68,68,0.04)')
                        : node.isSpiking  ? (dark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)')
                            : 'transparent';

                    return (
                        <div key={node.dashId}
                             style={{ padding:'14px 16px', background: rowBg,
                                 borderRight: !isLast ? `1px solid ${subtleBorder}` : 'none' }}>

                            {/* Room label + node */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                    <div style={{ width:3, height:16, borderRadius:2,
                                        background: node.color, flexShrink:0 }} />
                                    <p style={{ fontSize:12, fontWeight:700, color:text, margin:0 }}>
                                        {node.label}
                                    </p>
                                </div>
                                <span style={{ fontSize:8, fontWeight:700, color:muted, letterSpacing:'0.08em',
                                    fontFamily:"'DM Mono',monospace" }}>
                  NODE {node.node}
                </span>
                            </div>

                            {/* Now → forecast */}
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                {/* Now */}
                                <div style={{ flex:1, background:subtle, border:`1px solid ${subtleBorder}`,
                                    borderRadius:6, padding:'6px 8px' }}>
                                    <p style={{ fontSize:8, color:muted, margin:'0 0 2px', letterSpacing:'0.08em' }}>NOW</p>
                                    <p style={{ fontSize:11, fontWeight:700, margin:0,
                                        fontFamily:"'DM Mono',monospace",
                                        color: node.isOccupiedNow ? '#10b981' : muted }}>
                                        {nowLabel}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <div style={{ fontSize:10, color:muted, flexShrink:0 }}>+30m</div>

                                {/* Forecast */}
                                <div style={{ flex:1, background:subtle, border:`1px solid ${subtleBorder}`,
                                    borderRadius:6, padding:'6px 8px',
                                    borderColor: node.isSpiking || node.hasFireAlert
                                        ? rowAccent + '66' : subtleBorder }}>
                                    <p style={{ fontSize:8, color:muted, margin:'0 0 2px', letterSpacing:'0.08em' }}>FORECAST</p>
                                    <p style={{ fontSize:11, fontWeight:700, margin:0,
                                        fontFamily:"'DM Mono',monospace",
                                        color: rowAccent }}>
                                        {statusText}
                                    </p>
                                </div>
                            </div>

                            {/* Confidence bar */}
                            {conf != null ? (
                                <div>
                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                                        <span style={{ fontSize:8, color:muted, letterSpacing:'0.06em' }}>CONFIDENCE</span>
                                        <span style={{ fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace",
                                            color: conf > 80 ? '#10b981' : '#f59e0b' }}>{conf}%</span>
                                    </div>
                                    <div style={{ height:3, borderRadius:2,
                                        background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                                        <div style={{ height:'100%', borderRadius:2,
                                            width:`${conf}%`,
                                            background: conf > 80 ? '#10b981' : '#f59e0b',
                                            transition:'width 0.5s' }} />
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize:9, color:muted, margin:0, fontStyle:'italic' }}>
                                    Awaiting inference.py
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
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

                        {/* ── Occupancy Spike Prediction — top of dashboard ───────────── */}
                        <OccupancySpikePanel sensorState={sensorState} dark={dark} />

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
                                <EnergySummary kpi={KPI} sensorState={sensorState} dark={dark} />

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