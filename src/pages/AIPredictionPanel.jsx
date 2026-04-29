/**
 * AIPredictionPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard panel showing AI model predictions alongside live sensor data.
 *
 * Data sources:
 *   - Live sensor: twinergy/rooms/* via subscribeToRooms()
 *   - AI predictions: /predictions/* via subscribeToPredictions()
 *   - Dataset: DATASET_HOURLY from datasetState.js (trained data reference)
 *
 * For each of the 3 active nodes, shows:
 *   - Current sensor reading (live from Firebase)
 *   - AI scenario classification (from inference.py)
 *   - Recommended action + energy mode
 *   - Confidence bar
 *   - Whether override is required
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import { subscribeToRooms, subscribeToPredictions } from '../services/firebase';
import { DATASET_HOURLY } from '../services/datasetState';

// ── Scenario metadata ──────────────────────────────────────────────────────────
const SCENARIO_META = {
    'UC-A': { label:'Scheduled Class',     color:'#10b981', bg:'rgba(16,185,129,0.12)',  border:'rgba(16,185,129,0.3)',  icon:'📚' },
    'UC-B': { label:'Common Hour',         color:'#3b82f6', bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.3)',  icon:'🎓' },
    'UC-C': { label:'Waste — System On',   color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', icon:'⚠' },
    'UC-D': { label:'After Hours / Off',   color:'#475569', bg:'rgba(71,85,105,0.12)',  border:'rgba(71,85,105,0.3)',  icon:'🌙' },
    'UC-E': { label:'Scheduled — Empty',   color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', icon:'🪑' },
    'UC-F': { label:'Unscheduled Entry',   color:'#8b5cf6', bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.3)', icon:'🚶' },
    'UC-G': { label:'Graduate Evening',    color:'#0ea5e9', bg:'rgba(14,165,233,0.12)', border:'rgba(14,165,233,0.3)', icon:'🌆' },
};

const ACTION_META = {
    'MAINTAIN':  { color:'#10b981', label:'Maintain' },
    'SHUTDOWN':  { color:'#475569', label:'Shutdown' },
    'REDUCE':    { color:'#f59e0b', label:'Reduce'   },
    'OVERRIDE':  { color:'#ef4444', label:'Override' },
};

const NODES = [
    {
        dashId:  'Classroom_1',
        fbId:    'classroom-1',
        label:   'Classroom A',
        node:    1,
        sensor:  'PIR Motion',
        color:   '#3b82f6',
        getSensorLabel: (s) => s?.motion ? '● Motion Detected' : '○ No Motion',
        getSensorColor: (s) => s?.motion ? '#34d399' : '#64748b',
    },
    {
        dashId:  'Classroom_2',
        fbId:    'classroom-2',
        label:   'Classroom B',
        node:    2,
        sensor:  'LDR Ambient Lux',
        color:   '#fbbf24',
        getSensorLabel: (s) => s?.lux != null ? `${s.lux} lx` : '—',
        getSensorColor: (s) => !s?.lux ? '#64748b' : s.lux < 80 ? '#ef4444' : s.lux < 300 ? '#f59e0b' : '#34d399',
    },
    {
        dashId:  'Large_Lecture_Hall',
        fbId:    'lecture-hall',
        label:   'Lecture Hall',
        node:    3,
        sensor:  'DHT Temperature',
        color:   '#f87171',
        getSensorLabel: (s) => s?.temperature_c != null ? `${s.temperature_c.toFixed(1)}°C` : s?.fire_alert ? '⚠ FIRE' : '—',
        getSensorColor: (s) => s?.fire_alert ? '#ef4444' : s?.temperature_c > 35 ? '#ef4444' : s?.temperature_c > 28 ? '#f59e0b' : '#34d399',
    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function ConfidenceBar({ value, color }) {
    const pct = Math.round((value ?? 0) * 100);
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                <span className="text-[11px] font-bold" style={{ color, fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width:`${pct}%`, background: pct > 80 ? color : '#f59e0b' }} />
            </div>
        </div>
    );
}

function NodeCard({ node, sensor, prediction }) {
    const scenario = prediction?.scenario_label ?? prediction?.occupancy_label ?? null;
    const sm       = SCENARIO_META[scenario] ?? null;
    const action   = prediction?.recommended_action ?? prediction?.energy_mode ?? null;
    const am       = ACTION_META[action?.toUpperCase()] ?? null;
    const isOverride = prediction?.override_required || prediction?.override_needed;
    const confidence = prediction?.confidence ?? null;

    return (
        <div className="rounded-xl border overflow-hidden transition-all"
             style={{ borderColor: isOverride ? 'rgba(239,68,68,0.4)' : 'rgba(30,58,95,0.6)',
                 background:'rgba(5,8,18,0.9)',
                 boxShadow: isOverride ? '0 0 16px rgba(239,68,68,0.12)' : 'none' }}>

            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
                 style={{ borderColor:'rgba(15,34,68,0.8)', background:'rgba(8,14,26,0.7)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-8 rounded-full" style={{ background: node.color }} />
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-200">{node.label}</p>
                            {isOverride && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                      style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>
                  Override
                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500">Node {node.node} · {node.sensor}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-0.5">Live</p>
                    <p className="text-sm font-bold" style={{ color: node.getSensorColor(sensor), fontFamily:"'DM Mono',monospace" }}>
                        {node.getSensorLabel(sensor)}
                    </p>
                </div>
            </div>

            {/* Prediction body */}
            <div className="px-4 py-3 space-y-3">
                {/* Scenario classification */}
                {sm ? (
                    <div className="rounded-lg px-3 py-2 flex items-center gap-3"
                         style={{ background: sm.bg, border:`1px solid ${sm.border}` }}>
                        <span className="text-lg">{sm.icon}</span>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                               style={{ color: sm.color }}>AI Scenario</p>
                            <p className="text-xs font-bold" style={{ color: sm.color }}>{scenario} — {sm.label}</p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg px-3 py-2 text-center" style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(30,58,95,0.4)' }}>
                        <p className="text-[10px] text-slate-600">No prediction yet — run inference.py</p>
                    </div>
                )}

                {/* Action + Energy */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5" style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(30,58,95,0.4)' }}>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Action</p>
                        <p className="text-[11px] font-bold" style={{ color: am?.color ?? '#64748b', fontFamily:"'DM Mono',monospace" }}>
                            {am?.label ?? action ?? '—'}
                        </p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(30,58,95,0.4)' }}>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Energy Mode</p>
                        <p className="text-[11px] font-bold text-slate-300" style={{ fontFamily:"'DM Mono',monospace" }}>
                            {prediction?.energy_mode?.toUpperCase() ?? '—'}
                        </p>
                    </div>
                </div>

                {/* Confidence */}
                {confidence != null && <ConfidenceBar value={confidence} color={sm?.color ?? '#60a5fa'} />}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AIPredictionPanel() {
    const [sensors,     setSensors]     = useState({});
    const [predictions, setPredictions] = useState({});
    const [isLive,      setIsLive]      = useState(false);
    const [lastUpdate,  setLastUpdate]  = useState(null);

    // Get current hour for dataset reference
    const now        = new Date();
    const currentHour = now.getHours();
    const datasetRef = DATASET_HOURLY?.['Large_Lecture_Hall']?.find(h => h.hour === currentHour) ?? null;

    useEffect(() => {
        const unsubRooms = subscribeToRooms((data) => {
            if (Object.keys(data).length > 0) {
                setSensors(data);
                setIsLive(true);
                setLastUpdate(new Date());
            }
        });
        const unsubPred = subscribeToPredictions((data) => {
            if (data) setPredictions(data);
        });
        return () => { unsubRooms(); unsubPred(); };
    }, []);

    return (
        <div className="space-y-4">

            {/* Panel header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-900">AI Prediction Engine</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Random Forest · 384K rows · 7 scenarios · UC-B recall 96.4%
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isLive ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live · Firebase
            </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Simulated data
            </span>
                    )}
                    {lastUpdate && (
                        <span className="text-[10px] text-slate-400">
              {lastUpdate.toLocaleTimeString()}
            </span>
                    )}
                </div>
            </div>

            {/* Dataset reference row */}
            {datasetRef && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Training Data Reference · Hour {currentHour}:00</span>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                        {[
                            ['Scenario', datasetRef.scenario_label ?? '—'],
                            ['Energy',   datasetRef.energy_mode ?? '—'],
                            ['Action',   datasetRef.recommended_action ?? '—'],
                            ['Temp avg', datasetRef.temp != null ? `${datasetRef.temp.toFixed(1)}°C` : '—'],
                        ].map(([k,v]) => (
                            <div key={k}>
                                <p className="text-[9px] text-blue-400 uppercase tracking-widest">{k}</p>
                                <p className="text-[11px] font-bold text-blue-700" style={{ fontFamily:"'DM Mono',monospace" }}>{v}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Node cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {NODES.map(node => (
                    <NodeCard
                        key={node.dashId}
                        node={node}
                        sensor={sensors[node.dashId] ?? {}}
                        prediction={
                            predictions[node.dashId] ??
                            predictions[node.fbId] ??
                            predictions[node.label] ??
                            null
                        }
                    />
                ))}
            </div>
        </div>
    );
}