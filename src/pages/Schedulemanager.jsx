/**
 * Schedulemanager.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Stakeholder-facing schedule input UI.
 * Writes to Firebase: schedule/{roomId}/slots/
 * predict.py reads this to generate class_scheduled = 1 or 0
 *
 * HOW TO ADD TO YOUR DASHBOARD:
 *   1. Drop this file into src/pages/Schedulemanager.jsx
 *   2. Add the route in your App.jsx / router
 *   3. Add a sidebar link in Sidebar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { ref, set, onValue, remove } from 'firebase/database';

// ── Config ────────────────────────────────────────────────────────────────────
const ROOMS = [
    { fbId: 'classroom-1',  label: 'Classroom A', color: '#3b82f6', cap: 30  },
    { fbId: 'classroom-2',  label: 'Classroom B', color: '#f59e0b', cap: 30  },
    { fbId: 'lecture-hall', label: 'Lecture Hall', color: '#f87171', cap: 75  },
];

const DAYS = [
    { val: 1, label: 'Mon' },
    { val: 2, label: 'Tue' },
    { val: 3, label: 'Wed' },
    { val: 4, label: 'Thu' },
    { val: 5, label: 'Fri' },
];

// Convert "09:00" → 900, "13:30" → 1330
const timeToHHMM  = t => { const [h,m] = t.split(':'); return +h * 100 + +m; };
// Convert 900 → "09:00", 1330 → "13:30"
const HHMMToTime  = n => { const h = Math.floor(n/100); const m = n%100; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
// Display "09:00" nicely
const fmtDisplay  = t => { if (!t) return '—'; const [h,m] = t.split(':'); const hr = +h; return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };

const DAY_COLORS = {
    1: '#6366f1', 2: '#0ea5e9', 3: '#10b981', 4: '#f59e0b', 5: '#f43f5e',
};

// ── Empty slot template ───────────────────────────────────────────────────────
const emptySlot = () => ({ day: 1, start: '09:00', end: '10:00', course: '', capacity: 30 });

// ── Slot pill shown in the schedule grid ─────────────────────────────────────
function SlotPill({ slot, onDelete, roomColor }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `${DAY_COLORS[slot.day]}18`,
            border: `1px solid ${DAY_COLORS[slot.day]}44`,
            borderLeft: `3px solid ${DAY_COLORS[slot.day]}`,
            borderRadius: 8, padding: '7px 10px', gap: 8,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0f172a',
                    fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slot.course || '(No name)'}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: '#64748b', marginTop: 1 }}>
                    {fmtDisplay(HHMMToTime(slot.start))} – {fmtDisplay(HHMMToTime(slot.end))}
                    {slot.capacity ? <span style={{ marginLeft: 6, color: '#94a3b8' }}>· {slot.capacity} seats</span> : null}
                </p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: DAY_COLORS[slot.day],
                background: `${DAY_COLORS[slot.day]}22`, borderRadius: 6,
                padding: '2px 7px', flexShrink: 0 }}>
        {DAYS.find(d => d.val === slot.day)?.label}
      </span>
            <button onClick={onDelete}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: '#cbd5e1', fontSize: 14, lineHeight: 1, padding: '0 2px',
                        borderRadius: 4, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.target.style.color = '#ef4444'}
                    onMouseLeave={e => e.target.style.color = '#cbd5e1'}>
                ✕
            </button>
        </div>
    );
}

// ── Add slot form ─────────────────────────────────────────────────────────────
function AddSlotForm({ onAdd, onCancel, roomColor }) {
    const [slot, setSlot] = useState(emptySlot());
    const [err,  setErr]  = useState('');

    function validate() {
        if (!slot.course.trim()) return 'Enter a course name';
        if (timeToHHMM(slot.start) >= timeToHHMM(slot.end)) return 'End time must be after start time';
        return '';
    }

    function submit() {
        const e = validate();
        if (e) { setErr(e); return; }
        onAdd({ ...slot, start: timeToHHMM(slot.start), end: timeToHHMM(slot.end) });
    }

    const field = (label, content) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
            {content}
        </div>
    );

    const inputStyle = {
        border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px',
        fontSize: 12, color: '#0f172a', background: '#f8fafc', outline: 'none',
        fontFamily: "'DM Mono', monospace",
    };

    return (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0',
            borderRadius: 12, padding: 16, marginTop: 8 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Add Class Slot
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {field('Course name',
                    <input value={slot.course} onChange={e => setSlot(p => ({...p, course: e.target.value}))}
                           placeholder="e.g. CS-101 Intro to Programming"
                           style={{ ...inputStyle, fontFamily: 'inherit' }} />
                )}
                {field('Day',
                    <select value={slot.day} onChange={e => setSlot(p => ({...p, day: +e.target.value}))}
                            style={inputStyle}>
                        {DAYS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
                    </select>
                )}
                {field('Start time',
                    <input type="time" value={slot.start}
                           onChange={e => setSlot(p => ({...p, start: e.target.value}))}
                           style={inputStyle} />
                )}
                {field('End time',
                    <input type="time" value={slot.end}
                           onChange={e => setSlot(p => ({...p, end: e.target.value}))}
                           style={inputStyle} />
                )}
                {field('Capacity (optional)',
                    <input type="number" value={slot.capacity} min={1} max={200}
                           onChange={e => setSlot(p => ({...p, capacity: +e.target.value}))}
                           style={inputStyle} />
                )}
            </div>

            {err && <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 8px' }}>⚠ {err}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submit}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                            background: roomColor, color: '#fff', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer' }}>
                    Save to Firebase
                </button>
                <button onClick={onCancel}
                        style={{ padding: '9px 16px', borderRadius: 9,
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── Room schedule card ────────────────────────────────────────────────────────
function RoomScheduleCard({ room }) {
    const [slots,      setSlots]      = useState({});
    const [showForm,   setShowForm]   = useState(false);
    const [saving,     setSaving]     = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    // Subscribe to Firebase schedule for this room
    useEffect(() => {
        const r = ref(db, `schedule/${room.fbId}/slots`);
        const unsub = onValue(r, snap => setSlots(snap.val() ?? {}));
        return () => unsub();
    }, [room.fbId]);

    async function addSlot(slot) {
        setSaving(true);
        const slotKey = `slot_${Date.now()}`;
        await set(ref(db, `schedule/${room.fbId}/slots/${slotKey}`), slot);
        setSaving(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
        setShowForm(false);
    }

    async function deleteSlot(slotKey) {
        await remove(ref(db, `schedule/${room.fbId}/slots/${slotKey}`));
    }

    const slotList = Object.entries(slots).sort((a, b) => {
        const da = a[1].day * 10000 + a[1].start;
        const db_ = b[1].day * 10000 + b[1].start;
        return da - db_;
    });

    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: savedFlash ? `0 0 0 2px ${room.color}55` : '0 1px 6px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.3s' }}>

            {/* Color bar */}
            <div style={{ height: 3, background: room.color }} />

            <div style={{ padding: '14px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 12 }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                            {room.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            {slotList.length} class{slotList.length !== 1 ? 'es' : ''} scheduled
                            {savedFlash && <span style={{ color: '#10b981', marginLeft: 6 }}>✓ Saved!</span>}
                        </p>
                    </div>
                    <button onClick={() => setShowForm(p => !p)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5,
                                padding: '7px 12px', borderRadius: 9, border: 'none',
                                background: showForm ? '#f1f5f9' : room.color,
                                color: showForm ? '#64748b' : '#fff',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {showForm ? '✕ Cancel' : '+ Add Class'}
                    </button>
                </div>

                {/* Slot list */}
                {slotList.length === 0 && !showForm && (
                    <div style={{ textAlign: 'center', padding: '20px 0',
                        color: '#cbd5e1', fontSize: 11 }}>
                        No classes scheduled yet —<br />
                        <span style={{ color: room.color, cursor: 'pointer', fontWeight: 600 }}
                              onClick={() => setShowForm(true)}>
              add the first one
            </span>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {slotList.map(([key, slot]) => (
                        <SlotPill key={key} slot={slot} roomColor={room.color}
                                  onDelete={() => deleteSlot(key)} />
                    ))}
                </div>

                {/* Add form */}
                {showForm && (
                    <AddSlotForm roomColor={room.color}
                                 onAdd={addSlot}
                                 onCancel={() => setShowForm(false)} />
                )}

                {saving && (
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '8px 0 0',
                        fontFamily: "'DM Mono', monospace" }}>
                        ↑ Writing to Firebase…
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Weekly overview strip ─────────────────────────────────────────────────────
function WeeklyOverview({ allSlots }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700,
                color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Weekly Overview
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                {DAYS.map(day => {
                    const daySlots = allSlots.filter(s => s.day === day.val);
                    return (
                        <div key={day.val} style={{ borderRadius: 10,
                            background: daySlots.length > 0 ? `${DAY_COLORS[day.val]}12` : '#f8fafc',
                            border: `1px solid ${daySlots.length > 0 ? DAY_COLORS[day.val]+'33' : '#f1f5f9'}`,
                            padding: '8px 10px' }}>
                            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700,
                                color: daySlots.length > 0 ? DAY_COLORS[day.val] : '#cbd5e1' }}>
                                {day.label}
                            </p>
                            {daySlots.length === 0
                                ? <p style={{ margin: 0, fontSize: 9, color: '#cbd5e1' }}>No classes</p>
                                : daySlots.map((s, i) => (
                                    <p key={i} style={{ margin: '2px 0 0', fontSize: 9,
                                        color: '#475569', fontFamily: "'DM Mono', monospace" }}>
                                        {fmtDisplay(HHMMToTime(s.start))} {s.course?.split(' ')[0]}
                                    </p>
                                ))
                            }
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Schedulemanager() {
    const [allSlots, setAllSlots] = useState([]);

    // Aggregate all slots across rooms for weekly overview
    useEffect(() => {
        const unsubs = ROOMS.map(room => {
            const r = ref(db, `schedule/${room.fbId}/slots`);
            return onValue(r, snap => {
                const slots = Object.values(snap.val() ?? {});
                setAllSlots(prev => {
                    const others = prev.filter(s => s._room !== room.fbId);
                    return [...others, ...slots.map(s => ({ ...s, _room: room.fbId }))];
                });
            });
        });
        return () => unsubs.forEach(u => u());
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Schedule Manager
                    </h2>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0' }}>
                        Add class slots here → saved to Firebase →{' '}
                        <code style={{ fontSize: 10, background: '#f1f5f9',
                            padding: '1px 5px', borderRadius: 4, color: '#475569' }}>
                            predict.py
                        </code>
                        {' '}reads it → AI knows when class is scheduled
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 8, padding: '6px 12px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: '#22c55e', display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>
            Live · Writes to Firebase
          </span>
                </div>
            </div>

            {/* How it works */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                    ['1. Add class slots', 'Enter course name, day, start + end time per room'],
                    ['2. Saved to Firebase', 'Writes to schedule/{room}/slots/ instantly'],
                    ['3. predict.py reads it', 'Checks current time against slots → class_scheduled = 1 or 0'],
                    ['4. AI uses it', 'Model predicts occupancy using schedule + live sensor data'],
                ].map(([step, desc]) => (
                    <div key={step} style={{ flex: 1, minWidth: 140 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700,
                            color: '#2563eb' }}>{step}</p>
                        <p style={{ margin: 0, fontSize: 10, color: '#3b82f6',
                            lineHeight: 1.4 }}>{desc}</p>
                    </div>
                ))}
            </div>

            {/* Weekly overview */}
            <WeeklyOverview allSlots={allSlots} />

            {/* Room cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {ROOMS.map(room => (
                    <RoomScheduleCard key={room.fbId} room={room} />
                ))}
            </div>

            {/* Firebase path info */}
            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9',
                borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', margin: '0 0 6px',
                    textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Firebase schema written by this page
                </p>
                <pre style={{ margin: 0, fontSize: 10, color: '#64748b', lineHeight: 1.7,
                    fontFamily: "'DM Mono', monospace" }}>
{`schedule/
  classroom-1/slots/slot_1234/  { day:1, start:900, end:955, course:"CS-101", capacity:30 }
  classroom-2/slots/slot_5678/  { day:2, start:1030, end:1150, course:"MA-201", capacity:25 }
  lecture-hall/slots/slot_9012/ { day:3, start:1200, end:1300, course:"COMM-HR", capacity:75 }`}
        </pre>
            </div>
        </div>
    );
}