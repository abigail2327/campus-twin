/**
 * SimulationTab.jsx — Intuitive Trained-Data Simulation
 * ─────────────────────────────────────────────────────────────────────────────
 * Simple, clear interface:
 *   - Big animated clock + day picker
 *   - Three room cards showing occupancy live as clock runs
 *   - Each card has a sensor reading preview + what Firebase receives
 *   - Manual override slider per room → instant Firebase write
 *   - Play/pause/speed controls
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import { TRAINED_SIM_DATA } from '../services/trainedSimData';

const ROOMS = [
    { id:'Classroom_1',        fbId:'classroom-1',  label:'Classroom A', node:1, cap:30, color:'#3b82f6',
        sensor:'PIR Motion',     sensorDesc:'Writes active = 0 or 1 (PIR)',
        getReading: (occ) => occ > 0 ? '● Motion detected' : '○ No motion' },
    { id:'Classroom_2',        fbId:'classroom-2',  label:'Classroom B', node:2, cap:30, color:'#f59e0b',
        sensor:'LDR Ambient Lux',sensorDesc:'Writes ambient = lux value',
        getReading: (occ, tr) => occ > 0 ? `${Math.round(tr.avg_lux || 200)} lx` : '< 50 lx' },
    { id:'Large_Lecture_Hall', fbId:'lecture-hall', label:'Lecture Hall', node:3, cap:75, color:'#f87171',
        sensor:'DHT Temp + Pot', sensorDesc:'Writes active = temp°C, pot = potentiometer',
        getReading: (occ, tr) => occ > 0 ? `${(tr.avg_temp||24).toFixed(1)}°C · pot ${Math.round(tr.avg_pot||40)}` : `23.0°C · pot < 20` },
];

const SPEEDS  = [0.5, 1, 2, 5, 10];
const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

function getRow(roomId, day, hour) {
    return TRAINED_SIM_DATA?.[roomId]?.[day]?.[hour]
        ?? { occ_rate:0, avg_power:50, avg_lux:0, avg_temp:23, avg_pot:5, class_sched:0 };
}

function useSimClock(playing, speed, init) {
    const [min, setMin] = useState(init);
    const ref = useRef();
    useEffect(() => {
        if (!playing) { clearInterval(ref.current); return; }
        ref.current = setInterval(() => setMin(p => p + speed >= 1440 ? 0 : p + speed), 1000);
        return () => clearInterval(ref.current);
    }, [playing, speed]);
    return [min, setMin];
}

// ── Heatmap strip for a single room ──────────────────────────────────────────
function HeatStrip({ roomId, day, curHour }) {
    return (
        <div style={{ display:'flex', gap:1, height:8 }}>
            {Array.from({length:24}, (_,h) => {
                const r   = getRow(roomId, day, h);
                const pct = r.occ_rate;
                const isCur = h === curHour;
                const bg = pct > 0.65 ? ROOMS.find(r=>r.id===roomId)?.color
                    : pct > 0.25 ? `${ROOMS.find(r=>r.id===roomId)?.color}88`
                        : pct > 0.05 ? `${ROOMS.find(r=>r.id===roomId)?.color}33`
                            : '#1e293b';
                return (
                    <div key={h} title={`${h}:00 — ${Math.round(pct*100)}% occupied`}
                         style={{ flex:1, borderRadius:1, background: bg,
                             outline: isCur ? '2px solid #ef4444' : 'none',
                             outlineOffset: '-1px' }} />
                );
            })}
        </div>
    );
}

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room, occ, tr, hasOvr, overrideVal, onOverride, onClear }) {
    const pct   = Math.min(100, Math.round(occ / room.cap * 100));
    const color = room.color;
    const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : color;

    return (
        <div style={{ background:'#fff', border: hasOvr ? '1.5px solid rgba(239,68,68,0.4)' : '1px solid #e2e8f0',
            borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
            {/* Top bar */}
            <div style={{ height:3, background: color }} />

            <div style={{ padding:'14px 16px' }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                        <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0 }}>{room.label}</p>
                        <p style={{ fontSize:9, color:'#94a3b8', margin:0, marginTop:2 }}>
                            Node {room.node} · {room.sensor}
                        </p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:24, fontWeight:700, color, margin:0, fontFamily:"'DM Mono',monospace",
                            lineHeight:1 }}>{occ}</p>
                        <p style={{ fontSize:9, color:'#94a3b8', margin:0 }}>/ {room.cap}</p>
                    </div>
                </div>

                {/* Occupancy bar */}
                <div style={{ height:6, borderRadius:4, background:'#f1f5f9', marginBottom:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:4, width:`${pct}%`,
                        background: barColor, transition:'width 0.6s' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:9, color:'#94a3b8', fontFamily:"'DM Mono',monospace" }}>{pct}% capacity</span>
                    <span style={{ fontSize:9, color:'#94a3b8' }}>Dataset: {Math.round(tr.occ_rate*100)}%</span>
                </div>

                {/* Sensor reading */}
                <div style={{ background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:8,
                    padding:'7px 10px', marginBottom:10 }}>
                    <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px', textTransform:'uppercase',
                        letterSpacing:'0.08em', fontWeight:600 }}>Sensor reading</p>
                    <p style={{ fontSize:11, fontWeight:700, color: occ>0 ? '#0f172a' : '#94a3b8', margin:0,
                        fontFamily:"'DM Mono',monospace" }}>
                        {room.getReading(occ, tr)}
                    </p>
                    <p style={{ fontSize:9, color:'#cbd5e1', margin:'2px 0 0', fontFamily:"'DM Mono',monospace" }}>
                        {room.sensorDesc} · css={occ>0?'true':'false'}
                    </p>
                </div>

                {/* Manual override */}
                <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', margin:0,
                            textTransform:'uppercase', letterSpacing:'0.08em' }}>
                            Manual Override
                        </p>
                        {hasOvr && (
                            <button onClick={onClear}
                                    style={{ fontSize:9, fontWeight:700, color:'#ef4444', background:'none',
                                        border:'none', cursor:'pointer', padding:0 }}>
                                Clear ×
                            </button>
                        )}
                    </div>
                    <input type="range" min="0" max={room.cap}
                           value={hasOvr ? overrideVal : occ}
                           onChange={e => onOverride(+e.target.value)}
                           style={{ width:'100%', accentColor: color, cursor:'pointer' }} />
                    {hasOvr && (
                        <p style={{ fontSize:9, color:'#ef4444', margin:'3px 0 0', fontFamily:"'DM Mono',monospace" }}>
                            {writing ? '↑ Writing to Firebase…' : '⚡ Override active · Firebase updated'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SimulationTab() {
    const now = new Date();
    const [day,       setDay]       = useState(Math.min(5, Math.max(1, now.getDay())));
    const [playing,   setPlaying]   = useState(false);
    const [speedIdx,  setSpeedIdx]  = useState(1);
    const [overrides, setOverrides] = useState({});


    const speed = SPEEDS[speedIdx];
    const [min, setMin] = useSimClock(playing, speed, now.getHours()*60 + now.getMinutes());
    const curHour = Math.floor(min / 60);

    // Derived occupancy per room
    const states = {};
    ROOMS.forEach(r => {
        const tr  = getRow(r.id, day, curHour);
        const cap = r.cap;
        const hasOvr = overrides[r.id] != null;
        const raw = hasOvr ? overrides[r.id]
            : Math.min(cap, Math.max(0, Math.round(cap * tr.occ_rate * (0.9 + Math.random()*0.2))));
        states[r.id] = { occ: raw, tr, hasOvr };
    });

    // Override only affects local display — no Firebase write in production mode
    function handleOverride(roomId, occ) {
        setOverrides(p => ({ ...p, [roomId]: occ }));
    }
    const clearOvr = roomId => setOverrides(p => { const n={...p}; delete n[roomId]; return n; });

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                    <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:0 }}>
                        Occupancy Simulation
                    </h2>
                    <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>
                        Powered by <strong style={{ color:'#475569' }}>campus_sensor_data_v2.csv</strong>
                        {' '}· writes live sensor values to Firebase · inference.py reads and predicts
                    </p>
                </div>
                <span style={{ fontSize:10, color:'#94a3b8', padding:'4px 10px', borderRadius:6,
                    background:'#f1f5f9', border:'1px solid #e2e8f0' }}>
          View only · Arduino writes to Firebase directly
        </span>
            </div>

            {/* Controls card */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'16px 20px',
                boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>

                {/* Top row: clock + day + play + speed */}
                <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:16 }}>

                    {/* Clock */}
                    <div style={{ background:'#080d14', borderRadius:12, padding:'10px 20px', textAlign:'center', minWidth:120 }}>
                        <p style={{ fontSize:32, fontWeight:700, color:'#fff', margin:0, letterSpacing:'0.08em',
                            fontFamily:"'DM Mono',monospace" }}>{fmtTime(min)}</p>
                        <p style={{ fontSize:9, color:'#334155', margin:0, textTransform:'uppercase',
                            letterSpacing:'0.12em' }}>{DAYS[day]}</p>
                    </div>

                    {/* Day picker */}
                    <div>
                        <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.1em', margin:'0 0 6px' }}>Day</p>
                        <div style={{ display:'flex', gap:4 }}>
                            {[1,2,3,4,5].map(d => (
                                <button key={d} onClick={() => setDay(d)}
                                        style={{ width:38, height:38, borderRadius:10, fontSize:11, fontWeight:700,
                                            cursor:'pointer', border:'none',
                                            background: day===d ? '#0f172a' : '#f1f5f9',
                                            color: day===d ? '#fff' : '#64748b' }}>
                                    {DAYS[d]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Play controls */}
                    <div>
                        <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.1em', margin:'0 0 6px' }}>Controls</p>
                        <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => setPlaying(p => !p)}
                                    style={{ width:42, height:38, borderRadius:10, fontSize:18, cursor:'pointer',
                                        border:'none', display:'flex', alignItems:'center', justifyContent:'center',
                                        background: playing ? '#0f172a' : '#2563eb', color:'#fff' }}>
                                {playing ? '⏸' : '▶'}
                            </button>
                            <button onClick={() => { setMin(8*60); setPlaying(false); }}
                                    style={{ width:42, height:38, borderRadius:10, fontSize:16, cursor:'pointer',
                                        border:'1px solid #e2e8f0', background:'#f8fafc', color:'#64748b',
                                        display:'flex', alignItems:'center', justifyContent:'center' }}>⟳</button>
                        </div>
                    </div>

                    {/* Speed */}
                    <div>
                        <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.1em', margin:'0 0 6px' }}>Sim Speed</p>
                        <div style={{ display:'flex', gap:4 }}>
                            {SPEEDS.map((s,i) => (
                                <button key={s} onClick={() => setSpeedIdx(i)}
                                        style={{ padding:'0 10px', height:38, borderRadius:10, fontSize:11, fontWeight:700,
                                            cursor:'pointer', border:'none',
                                            background: speedIdx===i ? '#0f172a' : '#f1f5f9',
                                            color: speedIdx===i ? '#fff' : '#64748b' }}>
                                    {s}×
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Heatmap section */}
                <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                            letterSpacing:'0.1em', margin:0 }}>
                            24h Trained Occupancy Pattern · {DAYS[day]} · red bar = current time
                        </p>
                        <div style={{ display:'flex', gap:12, fontSize:9, color:'#94a3b8' }}>
                            {['Empty','Low','Medium','High'].map((l,i) => (
                                <span key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:12, height:6, borderRadius:2, display:'inline-block',
                      background: ['#1e293b','#3b82f633','#3b82f688','#3b82f6'][i] }} />{l}
                </span>
                            ))}
                        </div>
                    </div>

                    {/* Hour labels */}
                    <div style={{ display:'flex', marginBottom:4, paddingLeft:88 }}>
                        {[0,4,8,12,16,20].map(h => (
                            <span key={h} style={{ flex: h===0?1:1, fontSize:8, color:'#cbd5e1',
                                fontFamily:"'DM Mono',monospace",
                                marginLeft: h===0?0: `${(4/24)*100}%` }}>{h}h</span>
                        ))}
                    </div>

                    {ROOMS.map(r => (
                        <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span style={{ fontSize:10, fontWeight:700, color: r.color, minWidth:88,
                  whiteSpace:'nowrap' }}>{r.label}</span>
                            <div style={{ flex:1 }}>
                                <HeatStrip roomId={r.id} day={day} curHour={curHour} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Status note */}
                <p style={{ fontSize:10, color:'#94a3b8', margin:'12px 0 0', display:'flex',
                    alignItems:'center', gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981',
              display:'inline-block' }} />
                    {playing
                        ? `Running at ${speed}× · showing trained occupancy patterns from CSV`
                        : 'Press play to animate trained occupancy throughout the day'}
                </p>
            </div>

            {/* Room cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
                {ROOMS.map(r => {
                    const { occ, tr, hasOvr } = states[r.id];
                    return (
                        <RoomCard key={r.id} room={r} occ={occ} tr={tr} hasOvr={hasOvr}
                                  overrideVal={overrides[r.id] ?? occ}
                                  onOverride={v => handleOverride(r.id, v)}
                                  onClear={() => clearOvr(r.id)}
                        />
                    );
                })}
            </div>

            {/* Data source footer */}
            <div style={{ background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:12, padding:'12px 16px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#475569', margin:'0 0 8px',
                    textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    Data source
                </p>
                <div style={{ display:'flex', gap:16, fontSize:11, color:'#64748b' }}>
                    {[
                        ['campus_sensor_data_v2.csv', '17,280 rows · aggregated by room, day, hour'],
                        ['Occupancy rules', 'CR1: pir_motion > 0 · CR2: lux > 50 · LH: pot > 20'],
                        ['Production data', 'Arduino → LoRa → TTN → Ditto → Firebase (live uplink)'],
                        ['This tab', 'Reference view only · does not write to Firebase'],
                    ].map(([title, desc]) => (
                        <div key={title} style={{ flex:1 }}>
                            <p style={{ fontWeight:700, color:'#334155', margin:'0 0 2px' }}>{title}</p>
                            <p style={{ margin:0, lineHeight:1.4 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}