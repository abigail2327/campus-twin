/**
 * SimulationTab.jsx — Unified Simulation + AI Predictions
 * ─────────────────────────────────────────────────────────────────────────────
 * One tab that does everything:
 *   - Interactive timeline scrubber (click any hour)
 *   - Day selector tabs
 *   - Room cards showing trained occupancy data at selected hour
 *   - Inline AI predictions per room (from /predictions/* via predict.py)
 *   - Manual override controls per room
 *   - Falls back to dataset forecast when predict.py not running
 *
 * Logic rules (unchanged from train.py):
 *   Classroom_1  → pir_motion > 0 = occupied
 *   Classroom_2  → lux_bh1750 > 50 = occupied (no occupancy sensor)
 *   Lecture_Hall → potentiometer > 20 = occupied
 *
 * View only — does not write to Firebase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TRAINED_SIM_DATA } from '../services/trainedSimData';
import { subscribeToPredictions } from '../services/firebase';

// ── Constants ─────────────────────────────────────────────────────────────────
const ROOMS = [
    {
        id: 'Classroom_1',
        fbId: 'classroom-1',
        label: 'Classroom A',
        node: 1,
        cap: 30,
        color: '#3b82f6',
        accentBg: 'rgba(59,130,246,0.08)',
        accentBorder: 'rgba(59,130,246,0.2)',
        sensorLabel: (d) => d.occ_rate > 0.1 ? 'PIR: Motion' : 'PIR: Clear',
        sensorColor: (d) => d.occ_rate > 0.1 ? '#10b981' : '#94a3b8',
        hasOccupancy: true,
        occLabel: (d, ovr) => {
            const occ = ovr != null ? ovr : (d.occ_rate > 0.1 ? 1 : 0);
            return occ > 0 ? 'OCCUPIED' : 'VACANT';
        },
        occColor: (d, ovr) => {
            const occ = ovr != null ? ovr : (d.occ_rate > 0.1 ? 1 : 0);
            return occ > 0 ? '#10b981' : '#94a3b8';
        },
    },
    {
        id: 'Classroom_2',
        fbId: 'classroom-2',
        label: 'Classroom B',
        node: 2,
        cap: null,
        color: '#f59e0b',
        accentBg: 'rgba(245,158,11,0.08)',
        accentBorder: 'rgba(245,158,11,0.2)',
        sensorLabel: (d) => `${Math.round(d.avg_lux || 0)} lx`,
        sensorColor: (d) => (d.avg_lux || 0) < 80 ? '#f59e0b' : '#10b981',
        hasOccupancy: false,
        occLabel: () => null,
        occColor: () => '#94a3b8',
    },
    {
        id: 'Lecture_Hall',
        fbId: 'lecture-hall',
        label: 'Multipurpose Hall',
        node: 3,
        cap: 75,
        color: '#10b981',
        accentBg: 'rgba(16,185,129,0.08)',
        accentBorder: 'rgba(16,185,129,0.2)',
        sensorLabel: (d) => `${(d.avg_temp || 23).toFixed(1)}°C`,
        sensorColor: (d) => (d.avg_temp || 23) > 35 ? '#ef4444' : (d.avg_temp || 23) > 28 ? '#f59e0b' : '#10b981',
        hasOccupancy: true,
        occLabel: (d, ovr) => {
            const pct = ovr != null ? Math.round((ovr / 75) * 100) : Math.round(d.occ_rate * 100);
            return `${pct}%`;
        },
        occColor: (d, ovr) => {
            const pct = ovr != null ? Math.round((ovr / 75) * 100) : Math.round(d.occ_rate * 100);
            return pct > 85 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
        },
    },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WORK_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm

const ACTION_COLOR = {
    MAINTAIN:  '#10b981',
    SHUTDOWN:  '#64748b',
    REDUCE:    '#f59e0b',
    OVERRIDE:  '#ef4444',
};

function getRow(roomId, day, hour) {
    return TRAINED_SIM_DATA?.[roomId]?.[day]?.[hour]
        ?? { occ_rate: 0, avg_lux: 0, avg_temp: 23, avg_pot: 5, class_sched: 0 };
}

// ── Timeline bar for one room ─────────────────────────────────────────────────
function TimelineRow({ room, day, selectedHour, onHourClick }) {
    const hourData = WORK_HOURS.map(h => ({ h, d: getRow(room.id, day, h) }));
    return (
        <div className="flex items-center gap-3">
            <div className="shrink-0 text-right" style={{ width: 120 }}>
                <p className="text-xs font-bold" style={{ color: '#374151' }}>{room.label}</p>
                <p className="text-[10px]" style={{ color: '#9ca3af' }}>Node {room.node}</p>
            </div>
            <div className="flex gap-0.5 flex-1">
                {hourData.map(({ h, d }) => {
                    const isSelected = h === selectedHour;
                    const rate = d.occ_rate;
                    const bg = rate > 0.65
                        ? room.color
                        : rate > 0.25
                            ? `${room.color}88`
                            : rate > 0.05
                                ? `${room.color}33`
                                : '#e5e7eb';
                    return (
                        <button
                            key={h}
                            onClick={() => onHourClick(h)}
                            title={`${h}:00 — ${Math.round(rate * 100)}% occupied`}
                            style={{
                                flex: 1, height: 28, borderRadius: 4, background: bg, border: 'none',
                                cursor: 'pointer', position: 'relative',
                                outline: isSelected ? `2px solid #374151` : 'none',
                                outlineOffset: 1,
                                transition: 'transform 0.1s',
                                transform: isSelected ? 'scaleY(1.15)' : 'scaleY(1)',
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room, trainedRow, prediction, override, onOverride, onClearOverride }) {
    const [showOverride, setShowOverride] = useState(false);

    const isOccupied = override != null
        ? override > 0
        : trainedRow.occ_rate > 0.1;
    const occRate = override != null
        ? (room.cap ? override / room.cap : override > 0 ? 1 : 0)
        : trainedRow.occ_rate;
    const pct = Math.round(occRate * 100);

    // AI prediction fields
    const forecast   = prediction?.forecast_30min ?? null;
    const confidence = prediction?.confidence     ?? null;
    const action     = prediction?.recommended_action ?? null;
    const alerts     = prediction?.alerts         ?? [];
    const isLivePred = prediction?.timestamp      != null;

    // Dataset fallback forecast (next hour)
    const hasLivePred = forecast != null;

    const confPct = confidence != null ? Math.round(confidence * 100) : null;
    const actionColor = action ? (ACTION_COLOR[action.toUpperCase()] ?? '#64748b') : '#64748b';

    return (
        <div style={{
            background: '#ffffff', borderRadius: 16, overflow: 'hidden',
            border: `1px solid #e8ecf0`,
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
            {/* Colour top bar */}
            <div style={{ height: 4, background: room.color }} />

            <div style={{ padding: '14px 16px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{room.label}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', letterSpacing: '0.04em' }}>
                            NODE {room.node} · {pct}% from dataset
                        </p>
                    </div>
                    {/* Occupancy pill */}
                    {room.hasOccupancy && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                            background: isOccupied ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.08)',
                            color: isOccupied ? '#059669' : '#6b7280',
                            border: `1px solid ${isOccupied ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.15)'}`,
                            letterSpacing: '0.06em',
                        }}>
              {room.occLabel(trainedRow, override)}
            </span>
                    )}
                </div>

                {/* Sensor reading */}
                <div style={{
                    background: '#f7f8fa', borderRadius: 10, padding: '8px 12px',
                    marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {room.id === 'Classroom_1' ? 'PIR Sensor' : room.id === 'Classroom_2' ? 'Ambient Lux' : 'Temperature'}
          </span>
                    <span style={{
                        fontSize: 13, fontWeight: 700, color: room.sensorColor(trainedRow),
                        fontFamily: "'DM Mono', monospace",
                    }}>
            {room.sensorLabel(trainedRow)}
          </span>
                </div>

                {/* Occupancy bar (rooms with count only) */}
                {room.hasOccupancy && room.cap && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacity</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', fontFamily: "'DM Mono', monospace" }}>
                {override != null ? override : Math.round(occRate * room.cap)}/{room.cap}
              </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${Math.min(100, pct)}%`,
                                background: pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : room.color,
                                transition: 'width 0.4s',
                            }} />
                        </div>
                    </div>
                )}

                {/* ── AI Prediction section ── */}
                <div style={{
                    borderRadius: 10, padding: '10px 12px',
                    background: hasLivePred ? room.accentBg : '#f9fafb',
                    border: `1px solid ${hasLivePred ? room.accentBorder : '#eef0f4'}`,
                    marginBottom: showOverride ? 10 : 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              AI · 30-min forecast
            </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600 }}
                              style={{ color: isLivePred ? '#10b981' : '#d1d5db' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                  background: isLivePred ? '#10b981' : '#d1d5db' }} />
                            {isLivePred ? 'Live' : 'Dataset ref'}
            </span>
                    </div>

                    {hasLivePred ? (
                        <div>
                            {/* Forecast pill */}
                            <div style={{ display: 'flex', align: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                    fontSize: 12, fontWeight: 800, color: forecast === 'OCCUPIED' ? '#059669' : '#6b7280',
                    fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em',
                }}>
                  {forecast}
                </span>
                                {alerts.includes('FIRE_ANOMALY') && (
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                                        padding: '2px 6px', borderRadius: 4 }}>FIRE</span>
                                )}
                                {alerts.includes('POWER_LEAK') && (
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                                        padding: '2px 6px', borderRadius: 4 }}>POWER LEAK</span>
                                )}
                            </div>

                            {/* Confidence bar */}
                            {confPct != null && (
                                <div style={{ marginBottom: 6 }}>
                                    <div style={{ height: 3, borderRadius: 2, background: '#f0f0f0', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 2,
                                            width: `${confPct}%`,
                                            background: confPct > 80 ? room.color : '#f59e0b',
                                            transition: 'width 0.5s' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                        <span style={{ fontSize: 9, color: '#d1d5db' }}>confidence</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', fontFamily: "'DM Mono',monospace" }}>
                      {confPct}%
                    </span>
                                    </div>
                                </div>
                            )}

                            {/* Action */}
                            {action && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Action</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: actionColor,
                                        fontFamily: "'DM Mono', monospace" }}>
                    {action}
                  </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ fontSize: 11, color: '#d1d5db', margin: 0, fontStyle: 'italic' }}>
                            Run predict.py to see live predictions
                        </p>
                    )}
                </div>

                {/* ── Manual override ── */}
                <div>
                    <button
                        onClick={() => setShowOverride(s => !s)}
                        style={{
                            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 0 0', color: '#9ca3af', fontSize: 10, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>
                        Manual Override
                        <span style={{ fontSize: 12, transform: showOverride ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>
              ›
            </span>
                    </button>

                    {showOverride && (
                        <div style={{ marginTop: 8, padding: '10px 12px', background: '#fef9f0',
                            borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>
                  {room.id === 'Classroom_1'
                      ? `PIR override: ${override != null ? (override > 0 ? 'Motion (1)' : 'Clear (0)') : 'auto'}`
                      : room.id === 'Classroom_2'
                          ? 'No occupancy sensor'
                          : `Occupancy: ${override != null ? override : 'auto'}`}
                </span>
                                {override != null && (
                                    <button onClick={onClearOverride}
                                            style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'none',
                                                border: 'none', cursor: 'pointer', padding: 0 }}>
                                        Clear
                                    </button>
                                )}
                            </div>

                            {room.id === 'Classroom_1' && (                /* Binary toggle for CR1 — PIR is 0 or 1 */
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[{ val: 1, label: 'Occupied' }, { val: 0, label: 'Vacant' }].map(opt => (
                                        <button key={opt.val} onClick={() => onOverride(opt.val)}
                                                style={{
                                                    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11,
                                                    fontWeight: 700, cursor: 'pointer', border: 'none',
                                                    background: override === opt.val
                                                        ? (opt.val ? '#10b981' : '#6b7280')
                                                        : '#f0f0f0',
                                                    color: override === opt.val ? '#fff' : '#6b7280',
                                                }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {room.id === 'Classroom_2' && (
                                <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                                    Classroom B has no occupancy sensor — LDR lux only
                                </p>
                            )}

                            {room.id === 'Lecture_Hall' && room.cap && (
                                /* Slider for Hall — occupancy headcount */
                                <div>
                                    <input type="range" min={0} max={room.cap}
                                           value={override != null ? override : Math.round(trainedRow.occ_rate * room.cap)}
                                           onChange={e => onOverride(+e.target.value)}
                                           style={{ width: '100%', accentColor: room.color }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af' }}>
                                        <span>0</span>
                                        <span style={{ fontWeight: 700, color: '#374151', fontFamily: "'DM Mono',monospace" }}>
                      {override != null ? override : Math.round(trainedRow.occ_rate * room.cap)} pax
                    </span>
                                        <span>{room.cap}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Hour label row ─────────────────────────────────────────────────────────────
function HourAxis() {
    return (
        <div style={{ display: 'flex', gap: 0.5, paddingLeft: 132 }}>
            {WORK_HOURS.map(h => (
                <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 8,
                    color: '#d1d5db', fontFamily: "'DM Mono',monospace" }}>
                    {h}
                </div>
            ))}
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SimulationTab() {
    const now = new Date();
    const [day,       setDay]       = useState(Math.min(5, Math.max(1, now.getDay())));
    const [hour,      setHour]      = useState(Math.min(21, Math.max(7, now.getHours())));
    const [playing,   setPlaying]   = useState(false);
    const [speedIdx,  setSpeedIdx]  = useState(1);
    const [overrides, setOverrides] = useState({});
    const [predictions, setPredictions] = useState({});
    const [predLive,  setPredLive]  = useState(false);
    const intervalRef = useRef(null);

    const SPEEDS = [
        { label: '1×',  ms: 1500 },
        { label: '2×',  ms: 750  },
        { label: '4×',  ms: 375  },
        { label: '8×',  ms: 180  },
    ];

    // Auto-advance hour when playing
    useEffect(() => {
        if (!playing) { clearInterval(intervalRef.current); return; }
        intervalRef.current = setInterval(() => {
            setHour(h => {
                const next = h + 1;
                if (next > 21) { setPlaying(false); return 7; } // stop at end of day
                return next;
            });
        }, SPEEDS[speedIdx].ms);
        return () => clearInterval(intervalRef.current);
    }, [playing, speedIdx]);

    // Subscribe to live predictions from predict.py
    useEffect(() => {
        const unsub = subscribeToPredictions(data => {
            if (data && Object.keys(data).length > 0) {
                setPredictions(data);
                setPredLive(true);
            }
        });
        return unsub;
    }, []);

    function handleOverride(roomId, val) {
        setOverrides(p => ({ ...p, [roomId]: val }));
    }
    function clearOverride(roomId) {
        setOverrides(p => { const n = { ...p }; delete n[roomId]; return n; });
    }

    // Get prediction for a room (tries fbId first, then dashId)
    function getPred(room) {
        return predictions[room.fbId] ?? predictions[room.id] ?? null;
    }

    const selectedHourLabel = `${String(hour).padStart(2, '0')}:00`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                        Campus Simulator
                    </h2>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>
                        17,280 training rows · same occupancy rules as train.py · predictions live from predict.py
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
              background: predLive ? '#10b981' : '#d1d5db' }} />
                    <span style={{ fontSize: 10, fontWeight: 700,
                        color: predLive ? '#059669' : '#9ca3af' }}>
            {predLive ? 'Predictions live' : 'Run predict.py for live AI'}
          </span>
                </div>
            </div>

            {/* ── Day + hour selector card ── */}
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e8ecf0',
                padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>

                {/* Day tabs + play controls */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Day pills */}
                    {[1,2,3,4,5].map(d => (
                        <button key={d} onClick={() => { setDay(d); setPlaying(false); }}
                                style={{
                                    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                    background: day === d ? '#111827' : '#f3f4f6',
                                    color: day === d ? '#ffffff' : '#6b7280',
                                }}>
                            {DAYS[d]}
                        </button>
                    ))}

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: '#e8ecf0', margin: '0 4px' }} />

                    {/* Play / Pause */}
                    <button
                        onClick={() => setPlaying(p => !p)}
                        style={{
                            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: playing ? '#111827' : '#3b82f6', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                            boxShadow: playing ? 'none' : '0 2px 8px rgba(59,130,246,0.35)',
                        }}
                        title={playing ? 'Pause' : 'Play through the day'}>
                        {playing ? '⏸' : '▶'}
                    </button>

                    {/* Reset */}
                    <button
                        onClick={() => { setPlaying(false); setHour(7); }}
                        style={{
                            width: 36, height: 36, borderRadius: 10, border: '1px solid #e8ecf0',
                            cursor: 'pointer', background: '#f9fafb', color: '#6b7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, transition: 'all 0.15s',
                        }}
                        title="Reset to 7:00">
                        ⟳
                    </button>

                    {/* Speed pills */}
                    <div style={{ display: 'flex', gap: 2 }}>
                        {SPEEDS.map((s, i) => (
                            <button key={s.label} onClick={() => setSpeedIdx(i)}
                                    style={{
                                        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                        background: speedIdx === i ? '#374151' : '#f3f4f6',
                                        color: speedIdx === i ? '#fff' : '#9ca3af',
                                    }}>
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Current hour — right aligned */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {playing && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
                                display: 'inline-block', animation: 'pulse 1s infinite' }} />
                        )}
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#111827',
                            fontFamily: "'DM Mono', monospace", letterSpacing: '0.02em' }}>
              {selectedHourLabel}
            </span>
                    </div>
                </div>

                {/* Hour axis */}
                <HourAxis />

                {/* Timeline rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {ROOMS.map(room => (
                        <TimelineRow key={room.id} room={room} day={day}
                                     selectedHour={hour}
                                     onHourClick={h => { setPlaying(false); setHour(h); }} />
                    ))}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12,
                    borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#d1d5db', fontWeight: 600 }}>Click any bar to jump to that hour</span>
                    <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
                        {[
                            ['#e5e7eb', 'Empty'],
                            ['rgba(59,130,246,0.33)', 'Low'],
                            ['rgba(59,130,246,0.55)', 'Medium'],
                            ['#3b82f6', 'High'],
                        ].map(([color, label]) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 14, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                                <span style={{ fontSize: 9, color: '#d1d5db' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Room cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {ROOMS.map(room => {
                    const trainedRow = getRow(room.id, day, hour);
                    const prediction = getPred(room);
                    return (
                        <RoomCard
                            key={room.id}
                            room={room}
                            trainedRow={trainedRow}
                            prediction={prediction}
                            override={overrides[room.id] ?? null}
                            onOverride={val => handleOverride(room.id, val)}
                            onClearOverride={() => clearOverride(room.id)}
                        />
                    );
                })}
            </div>

            {/* ── Footer ── */}
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <p style={{ fontSize: 10, color: '#d1d5db', margin: 0 }}>
                    View only · does not write to Firebase · training data: campus_sensor_data_v2.csv
                </p>
            </div>

        </div>
    );
}