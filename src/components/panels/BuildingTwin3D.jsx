/**
 * BuildingTwin3D.jsx — Improved Visual Design
 * ─────────────────────────────────────────────────────────────────────────────
 * Improvements:
 *   - Holographic grid floor with animated scan line
 *   - Glowing room edges (wireframe overlay)
 *   - Richer material — glass-like transparent rooms with coloured glow
 *   - Floating sensor value labels above active rooms
 *   - Gradient sky background (deep navy → black)
 *   - Subtle ambient particles
 *   - Cleaner UI overlays — dark glass panels
 *   - Fire alert: flashing red room + pulsing ring
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import Icon from './Icon';
import { MOCK_SENSOR_STATE } from '../../services/sensorState';

// Suppress Three.js deprecation warnings
if (typeof window !== 'undefined') {
    const _warn = console.warn.bind(console);
    console.warn = (...args) => {
        const msg = args[0] ?? '';
        if (typeof msg === 'string' && (msg.includes('THREE.THREE.Clock') || msg.includes('PCFSoftShadowMap'))) return;
        _warn(...args);
    };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const FLOOR_H = 3.2;
const WALL_T  = 0.08;
const CEIL_H  = 0.06;

const ROOMS = [
    { id:'Lobby_Reception',    label:'Lobby',              node:null, floor:1, x:1.50, z:2.00, w:3.00, d:4.00 },
    { id:'Classroom_1',        label:'Classroom A',        node:1,    floor:1, x:4.50, z:2.00, w:3.00, d:4.00 },
    { id:'Classroom_2',        label:'Classroom B',        node:2,    floor:1, x:7.65, z:2.00, w:4.30, d:4.00 },
    { id:'Large_Lecture_Hall', label:'Lecture Hall',       node:3,    floor:1, x:2.15, z:7.05, w:4.30, d:6.10 },
    { id:'Lounge_Study',       label:'Lounge',             node:null, floor:2, x:1.50, z:2.00, w:3.00, d:4.00 },
    { id:'Computer_Lab',       label:'Computer Lab',       node:5,    floor:2, x:6.65, z:2.00, w:7.30, d:4.00 },
    { id:'Faculty_Office',     label:'Faculty Office',     node:4,    floor:2, x:2.15, z:5.00, w:4.30, d:2.00 },
    { id:'Control_Room',       label:'Control Room',       node:null, floor:2, x:2.15, z:7.00, w:4.30, d:2.00 },
    { id:'Mechanical_Room',    label:'Mechanical Room',    node:6,    floor:2, x:2.15, z:9.00, w:4.30, d:2.00 },
];

const ROOM_SENSORS = {
    Classroom_1:        ['motion','lux','temperature','power'],
    Classroom_2:        ['lux','temperature','power'],
    Large_Lecture_Hall: ['motion','temperature','fire'],
    Lounge_Study:       ['temperature'],
    Computer_Lab:       ['temperature','power'],
    Faculty_Office:     ['motion','temperature','power'],
    Control_Room:       [],
    Mechanical_Room:    ['power'],
    Lobby_Reception:    [],
};

const SENSOR_FILTER_CFG = [
    { id:'all',         label:'All Rooms',   color:'#60a5fa' },
    { id:'motion',      label:'Motion',      color:'#34d399' },
    { id:'temperature', label:'Temperature', color:'#f87171' },
    { id:'lux',         label:'Lux',         color:'#fbbf24' },
    { id:'fire',        label:'Fire',        color:'#ef4444' },
    { id:'power',       label:'Power',       color:'#a78bfa' },
];

// ── Color system ───────────────────────────────────────────────────────────────
const ROOM_COLORS = {
    normal:   { fill:'#0f4c5c', edge:'#0ea5e9', glow:'#38bdf8' },
    warning:  { fill:'#78350f', edge:'#f59e0b', glow:'#fbbf24' },
    critical: { fill:'#7f1d1d', edge:'#ef4444', glow:'#fca5a5' },
    fire:     { fill:'#450a0a', edge:'#ef4444', glow:'#ef4444' },
    selected: { fill:'#1e3a8a', edge:'#60a5fa', glow:'#93c5fd' },
    hovered:  { fill:'#0f2d5c', edge:'#7dd3fc', glow:'#7dd3fc' },
    dim:      { fill:'#080d14', edge:'#0f172a', glow:'#0f172a' },
};

function getRoomScheme(room, sensor, selected, hovered, filterMatch, sensorFilter) {
    if (sensor?.fire_alert)          return ROOM_COLORS.fire;
    if (selected)                    return ROOM_COLORS.selected;
    if (hovered)                     return ROOM_COLORS.hovered;
    if (sensorFilter !== 'all' && !filterMatch) return ROOM_COLORS.dim;
    switch (sensor?.status) {
        case 'critical': return ROOM_COLORS.critical;
        case 'warning':  return ROOM_COLORS.warning;
        default:         return ROOM_COLORS.normal;
    }
}

// ── Holographic grid floor ─────────────────────────────────────────────────────
function HoloGrid() {
    // Sparse grid — 1.6m spacing, very subtle
    const lines = [];
    for (let i = 0; i <= 10; i++) {
        const v = i * 1.6;
        lines.push(<Line key={`x${i}`} points={[[v,0,0],[v,0,16]]} color="#0c4a6e" lineWidth={0.5} transparent opacity={0.4} />);
        lines.push(<Line key={`z${i}`} points={[[0,0,v],[16,0,v]]} color="#0c4a6e" lineWidth={0.5} transparent opacity={0.4} />);
    }
    return (
        <group position={[0, -0.01, 0]}>
            {lines}
            <ScanLine />
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[8, 0, 8]}>
                <planeGeometry args={[16, 16]} />
                <meshBasicMaterial color="#060d1a" transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

function ScanLine() {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (ref.current) {
            ref.current.position.z = ((clock.getElapsedTime() * 1.2) % 16);
            ref.current.material.opacity = 0.12 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
        }
    });
    return (
        <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]} position={[8, 0.02, 0]}>
            <planeGeometry args={[16, 0.06]} />
            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ── Room mesh with glowing wireframe overlay ───────────────────────────────────
function RoomMesh({ room, sensor, selected, onSelect, sensorFilter = 'all' }) {
    const fillRef  = useRef();
    const edgeRef  = useRef();
    const glowRef  = useRef();
    const [hovered, setHovered] = useState(false);
    const floorY    = (room.floor - 1) * FLOOR_H;
    const roomY     = floorY + FLOOR_H / 2;
    const isFireAlert = sensor?.fire_alert;
    const filterMatch = sensorFilter === 'all' || (ROOM_SENSORS[room.id] ?? []).includes(sensorFilter);

    // Room dimensions
    const rw = room.w - WALL_T;
    const rh = FLOOR_H - CEIL_H;
    const rd = room.d - WALL_T;

    const scheme = getRoomScheme(room, sensor, selected, hovered, filterMatch, sensorFilter);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();

        if (fillRef.current) {
            if (isFireAlert) {
                const flash = Math.sin(t * 10) > 0;
                fillRef.current.material.color.set(flash ? '#7f1d1d' : '#450a0a');
                fillRef.current.material.emissive.set(flash ? '#ef4444' : '#000');
                fillRef.current.material.emissiveIntensity = flash ? 0.5 : 0;
                fillRef.current.material.opacity = 0.7;
            } else {
                fillRef.current.material.color.set(scheme.fill);
                fillRef.current.material.emissive.set(selected ? scheme.glow : '#000');
                fillRef.current.material.emissiveIntensity = selected ? 0.12 : 0;
                fillRef.current.material.opacity = sensorFilter !== 'all' && !filterMatch ? 0.04
                    : selected ? 0.65 : hovered ? 0.5 : 0.22;
            }
        }
        if (edgeRef.current) {
            edgeRef.current.material.color.set(isFireAlert
                ? (Math.sin(t * 8) > 0 ? '#ef4444' : '#7f1d1d')
                : scheme.edge);
            edgeRef.current.material.opacity = sensorFilter !== 'all' && !filterMatch ? 0.04
                : selected ? 0.95 : hovered ? 0.8 : filterMatch ? 0.4 + Math.sin(t * 1.5 + room.x) * 0.06 : 0.08;
        }
        if (glowRef.current) {
            const pulse = 0.5 + Math.sin(t * 2 + room.x) * 0.3;
            glowRef.current.material.opacity = (isFireAlert ? 0.2 + Math.sin(t * 8) * 0.15
                : selected ? 0.12 : filterMatch ? 0.04 * pulse : 0.005);
            glowRef.current.material.color.set(scheme.glow);
        }
    });

    return (
        <group visible={true}>
            {/* Glow fill — slightly larger, rendered first */}
            <mesh ref={glowRef} position={[room.x, roomY, room.z]}>
                <boxGeometry args={[rw + 0.1, rh + 0.1, rd + 0.1]} />
                <meshBasicMaterial color={scheme.glow} transparent opacity={0.06} side={THREE.BackSide} />
            </mesh>

            {/* Main room fill — glass-like */}
            <mesh ref={fillRef} position={[room.x, roomY, room.z]}
                  onClick={e => { e.stopPropagation(); onSelect(room.id); }}
                  onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor='pointer'; }}
                  onPointerOut={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor='auto'; }}>
                <boxGeometry args={[rw, rh, rd]} />
                <meshStandardMaterial transparent opacity={0.32} metalness={0.4} roughness={0.1}
                                      color={scheme.fill} side={THREE.DoubleSide} envMapIntensity={0.5}
                                      depthWrite={false} />
            </mesh>

            {/* Wireframe edge overlay — the glow lines */}
            <mesh ref={edgeRef} position={[room.x, roomY, room.z]}>
                <boxGeometry args={[rw, rh, rd]} />
                <meshBasicMaterial color={scheme.edge} transparent opacity={0.55}
                                   wireframe side={THREE.FrontSide} depthWrite={false} />
            </mesh>

            {/* Floor tile */}
            <mesh position={[room.x, floorY + 0.02, room.z]}>
                <boxGeometry args={[rw, 0.04, rd]} />
                <meshStandardMaterial color={scheme.fill} transparent opacity={0.5} metalness={0.6} roughness={0.2} />
            </mesh>

            {/* Ceiling — lit when lights on */}
            <mesh position={[room.x, floorY + FLOOR_H - 0.05, room.z]}>
                <boxGeometry args={[rw - 0.1, 0.04, rd - 0.1]} />
                <meshStandardMaterial
                    color={sensor?.lights ? '#fef9c3' : '#0f172a'}
                    emissive={sensor?.lights ? '#fef9c3' : '#000'}
                    emissiveIntensity={sensor?.lights ? 0.8 : 0}
                    transparent opacity={sensor?.lights ? 0.9 : 0.4} />
            </mesh>
            {sensor?.lights && (
                <pointLight position={[room.x, floorY + FLOOR_H - 0.4, room.z]}
                            color="#fff9e6" intensity={1.2} distance={room.w * 2} decay={2} />
            )}

            {/* Room label */}
            <Text position={[room.x, roomY, room.z]} fontSize={0.2}
                  color={selected ? '#ffffff' : filterMatch ? '#e2e8f0' : '#334155'}
                  anchorX="center" anchorY="middle" textAlign="center"
                  maxWidth={room.w * 0.8} outlineWidth={0.015} outlineColor="#0f172a">
                {room.label}
            </Text>

            {/* Floating sensor reading above selected room */}
            {selected && sensor && (
                <Html position={[room.x, floorY + FLOOR_H + 0.6, room.z]} center distanceFactor={6}>
                    <div style={{
                        background:'rgba(6,10,20,0.92)', border:'1px solid rgba(96,165,250,0.3)',
                        borderRadius:'6px', padding:'5px 9px', pointerEvents:'none',
                        fontFamily:"'DM Mono',monospace", fontSize:'10px', color:'#93c5fd',
                        boxShadow:'0 2px 12px rgba(0,0,0,0.6)', whiteSpace:'nowrap',
                        letterSpacing:'0.05em',
                    }}>
                        {room.id === 'Classroom_1' && (
                            <span style={{ color: sensor.motion ? '#34d399' : '#64748b' }}>
                {sensor.motion ? '● MOTION' : '○ CLEAR'}
              </span>
                        )}
                        {room.id === 'Classroom_2' && sensor.lux != null && (
                            <span style={{ color:'#fbbf24' }}>{sensor.lux} lx</span>
                        )}
                        {room.id === 'Large_Lecture_Hall' && sensor.temperature_c != null && (
                            <span style={{ color: sensor.fire_alert ? '#ef4444' : sensor.temperature_c > 28 ? '#f87171' : '#34d399' }}>
                {sensor.fire_alert ? '⚠ FIRE' : `${sensor.temperature_c.toFixed(1)}°C`}
              </span>
                        )}
                        {!['Classroom_1','Classroom_2','Large_Lecture_Hall'].includes(room.id) && (
                            <span style={{ color:'#64748b' }}>{room.label}</span>
                        )}
                    </div>
                </Html>
            )}

            {/* Node badge */}
            {room.node && (
                <Html position={[room.x + room.w*0.35, roomY + FLOOR_H*0.4, room.z - room.d*0.35]}
                      center distanceFactor={9}>
                    <div style={{
                        background:'rgba(6,10,20,0.88)',
                        border:`1px solid ${isFireAlert ? 'rgba(239,68,68,0.6)' : 'rgba(96,165,250,0.35)'}`,
                        color: isFireAlert ? '#fca5a5' : '#7dd3fc',
                        fontSize:'8px', fontWeight:700, fontFamily:"'DM Mono',monospace",
                        padding:'2px 6px', borderRadius:'3px', whiteSpace:'nowrap',
                        pointerEvents:'none', letterSpacing:'0.08em',
                    }}>
                        N{room.node}
                    </div>
                </Html>
            )}

            {/* Sensor overlay chips */}
            <SensorOverlay position={[room.x - room.w*0.28, roomY + FLOOR_H*0.3, room.z + room.d*0.35]} sensor={sensor} />

            {/* Pulse rings */}
            {isFireAlert && <PulseRing position={[room.x, floorY + FLOOR_H + 0.05, room.z]} color="#ef4444" scale={1.2} />}
            {selected && !isFireAlert && <PulseRing position={[room.x, floorY + FLOOR_H + 0.05, room.z]} color="#3b82f6" scale={0.9} />}
        </group>
    );
}

// ── Pulse ring ─────────────────────────────────────────────────────────────────
function PulseRing({ position, color = '#3b82f6', scale = 1 }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const s = scale * (1 + Math.sin(clock.getElapsedTime() * 4) * 0.25);
        ref.current.scale.set(s, s, s);
        ref.current.material.opacity = 0.5 + Math.sin(clock.getElapsedTime() * 4) * 0.25;
    });
    return (
        <mesh ref={ref} position={position}>
            <ringGeometry args={[0.35, 0.5, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ── Overlays ───────────────────────────────────────────────────────────────────
function SensorOverlay({ position, sensor }) {
    const indicators = [];
    if (sensor?.lights)     indicators.push({ icon:'💡', color:'#fbbf24', label:'Lights' });
    if (sensor?.motion)     indicators.push({ icon:'👁', color:'#34d399', label:'Motion' });
    if (sensor?.fire_alert) indicators.push({ icon:'🔥', color:'#ef4444', label:'FIRE' });
    if (!indicators.length) return null;
    return (
        <Html position={position} center distanceFactor={11}>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', pointerEvents:'none' }}>
                {indicators.map((ind, i) => (
                    <div key={i} style={{
                        background:'rgba(8,13,28,0.9)', border:`1px solid ${ind.color}55`,
                        color:ind.color, fontSize:'8px', fontWeight:700, padding:'2px 5px',
                        borderRadius:'4px', whiteSpace:'nowrap', fontFamily:"'DM Mono',monospace",
                        boxShadow:`0 0 6px ${ind.color}33`,
                    }}>
                        {ind.icon} {ind.label}
                    </div>
                ))}
            </div>
        </Html>
    );
}

// ── Floor slab ─────────────────────────────────────────────────────────────────
function FloorSlab({ y, w, d, x, z }) {
    return (
        <group>
            <mesh position={[x, y, z]}>
                <boxGeometry args={[w, 0.08, d]} />
                <meshStandardMaterial color="#080e1a" roughness={0.8} metalness={0.3} />
            </mesh>
            <mesh position={[x, y + 0.041, z]}>
                <boxGeometry args={[w, 0.001, d]} />
                <meshBasicMaterial color="#0c2a4a" transparent opacity={0.8} />
            </mesh>
        </group>
    );
}

// ── Building outline pillars ───────────────────────────────────────────────────
function BuildingPillars() {
    const corners = [
        [0.3, 0.3], [0.3, 11.3], [9.8, 0.3], [9.8, 4.2],
        [4.0, 4.2], [4.0, 11.3],
    ];
    return (
        <>
            {corners.map(([x, z], i) => (
                <mesh key={i} position={[x, FLOOR_H, z]}>
                    <boxGeometry args={[0.08, FLOOR_H * 2, 0.08]} />
                    <meshStandardMaterial color="#0c3258" emissive="#0ea5e9" emissiveIntensity={0.08}
                                          transparent opacity={0.6} metalness={0.7} roughness={0.2} />
                </mesh>
            ))}
        </>
    );
}

// ── Scene ──────────────────────────────────────────────────────────────────────
function Scene({ sensorState, selectedRoom, onRoomSelect, sensorFilter }) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.2} color="#0d1f3c" />
            <directionalLight position={[14, 20, 10]} intensity={0.5} color="#dbeafe" castShadow shadowMapSize={[1024,1024]} />
            <directionalLight position={[-6, 10, -4]} intensity={0.15} color="#bfdbfe" />
            <pointLight position={[5, 10, 5]} intensity={0.3} color="#7dd3fc" distance={22} decay={2} />
            <hemisphereLight skyColor="#0a1628" groundColor="#030508" intensity={0.6} />

            <HoloGrid />

            <FloorSlab y={FLOOR_H}     x={4.9}  z={2.0}  w={10.3} d={4.0} />
            <FloorSlab y={FLOOR_H}     x={2.15} z={7.05} w={4.3}  d={6.1} />
            <FloorSlab y={0}           x={5.0}  z={5.5}  w={10.0} d={12.0} />

            <BuildingPillars />

            {ROOMS.map(room => (
                <RoomMesh key={room.id} room={room}
                          sensor={sensorState[room.id]}
                          selected={selectedRoom === room.id}
                          onSelect={onRoomSelect}
                          sensorFilter={sensorFilter} />
            ))}

            <OrbitControls makeDefault target={[5.0, 3.5, 5.0]}
                           minDistance={5} maxDistance={38}
                           minPolarAngle={0.1} maxPolarAngle={Math.PI/2.05}
                           enableDamping dampingFactor={0.06} />
        </>
    );
}

// ── Sensor detail panel (click) ────────────────────────────────────────────────
function SensorPanel({ room, sensor, onClose }) {
    if (!room || !sensor) return null;
    const rows = [];
    if (room.id === 'Classroom_1') {
        rows.push(['PIR Motion', sensor.motion ? '● Detected' : '○ Clear', sensor.motion ? '#34d399' : '#64748b']);
        if (sensor.lights != null) rows.push(['Lights', sensor.lights ? 'ON' : 'OFF', sensor.lights ? '#fbbf24' : '#64748b']);
    } else if (room.id === 'Classroom_2') {
        if (sensor.lux != null) rows.push(['Ambient Lux', `${sensor.lux} lx`, sensor.lux < 80 ? '#f87171' : '#fbbf24']);
        if (sensor.lights != null) rows.push(['Lights', sensor.lights ? 'ON' : 'OFF', sensor.lights ? '#fbbf24' : '#64748b']);
    } else if (room.id === 'Large_Lecture_Hall') {
        if (sensor.temperature_c != null) rows.push(['Indoor Temp', `${sensor.temperature_c.toFixed(1)}°C`, sensor.temperature_c > 35 ? '#ef4444' : sensor.temperature_c > 28 ? '#f87171' : '#34d399']);
        if (sensor.outdoor_temp_c != null) rows.push(['Outdoor Temp', `${sensor.outdoor_temp_c.toFixed(1)}°C`, '#94a3b8']);
        rows.push(['Fire Alert', sensor.fire_alert ? '⚠ ACTIVE' : 'Clear', sensor.fire_alert ? '#ef4444' : '#34d399']);
        if (sensor.fan_active != null) rows.push(['Fan', sensor.fan_active ? 'ON' : 'OFF', sensor.fan_active ? '#38bdf8' : '#64748b']);
        if (sensor.lights != null) rows.push(['Lights', sensor.lights ? 'ON' : 'OFF', sensor.lights ? '#fbbf24' : '#64748b']);
    } else {
        if (sensor.temperature_c != null) rows.push(['Temperature', `${sensor.temperature_c.toFixed(1)}°C`, '#f87171']);
        if (sensor.lux != null)           rows.push(['Lux', `${sensor.lux} lx`, '#fbbf24']);
        if (sensor.motion != null)        rows.push(['Motion', sensor.motion ? 'Detected' : 'Clear', sensor.motion ? '#34d399' : '#64748b']);
        if (sensor.lights != null)        rows.push(['Lights', sensor.lights ? 'ON' : 'OFF', sensor.lights ? '#fbbf24' : '#64748b']);
    }
    const statusColor = sensor.fire_alert ? '#ef4444' : sensor.status === 'critical' ? '#ef4444' : sensor.status === 'warning' ? '#f59e0b' : '#10b981';
    return (
        <div style={{
            position:'absolute', bottom:16, left:16, zIndex:10, width:210,
            background:'rgba(5,8,18,0.96)', border:'1px solid #0f2244',
            borderRadius:10, overflow:'hidden',
            boxShadow:'0 4px 24px rgba(0,0,0,0.8)',
        }}>
            {/* Header */}
            <div style={{ padding:'9px 12px', borderBottom:'1px solid #0a1a30',
                background:'rgba(8,14,26,0.9)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:statusColor, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:700, color:'#cbd5e1', letterSpacing:'0.03em' }}>{room.label}</span>
                </div>
                <button onClick={onClose} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', padding:0, fontSize:13, lineHeight:1, opacity:0.7 }}>✕</button>
            </div>
            {/* Fire banner */}
            {sensor.fire_alert && (
                <div style={{ padding:'6px 14px', background:'rgba(127,29,29,0.8)', borderBottom:'1px solid #7f1d1d',
                    display:'flex', alignItems:'center', gap:6, animation:'pulse 1s infinite' }}>
                    <span style={{ fontSize:12 }}>🔥</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#fca5a5', letterSpacing:'0.1em' }}>FIRE ALERT ACTIVE</span>
                </div>
            )}
            {/* Node chip */}
            {room.node && (
                <div style={{ padding:'4px 14px', borderBottom:'1px solid #0f2244' }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa', letterSpacing:'0.12em', fontFamily:"'DM Mono',monospace" }}>
            NODE {room.node} · {room.id.replace(/_/g,' ')}
          </span>
                </div>
            )}
            {/* Data rows */}
            <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:5 }}>
                {rows.length === 0 && (
                    <span style={{ fontSize:10, color:'#1e3a5f', fontStyle:'italic' }}>No sensor data</span>
                )}
                {rows.map(([label, val, color]) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 0' }}>
                        <span style={{ fontSize:9, fontWeight:600, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</span>
                        <span style={{ fontSize:11, fontWeight:700, color: color ?? '#cbd5e1', fontFamily:"'DM Mono',monospace" }}>{val}</span>
                    </div>
                ))}
            </div>
            {/* Footer */}
            <div style={{ padding:'5px 12px', borderTop:'1px solid #0a1a30', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(4,8,16,0.6)' }}>
                <span style={{ fontSize:8, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.12em' }}>Status</span>
                <span style={{ fontSize:9, fontWeight:700, color:statusColor, textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:"'DM Mono',monospace" }}>
          {sensor.fire_alert ? 'FIRE' : sensor.status ?? 'OPTIMAL'}
        </span>
            </div>
        </div>
    );
}

// ── Threshold panel (sensor filter) ───────────────────────────────────────────
const THRESHOLD_DATA = {
    motion:      { icon:'👁', label:'PIR Motion', node:'Node 1 — Classroom A', unit:'', normal:{range:'No motion',action:null}, warning:{range:'Motion, no class',action:'Log unscheduled entry'}, critical:{range:'Motion after 18:00',action:'Security alert'}, getLive:s=>s?.motion!=null?(s.motion?'Detected':'Clear'):null, getStatus:s=>s?.motion?(s.campus_clock>=1800?'critical':'warning'):'normal' },
    temperature: { icon:'🌡', label:'Temperature', node:'Node 3 — Lecture Hall', unit:'°C', normal:{range:'≤ 28°C',action:null}, warning:{range:'28–35°C',action:'Check HVAC'}, critical:{range:'> 35°C',action:'Fire protocol'}, getLive:s=>s?.temperature_c!=null?`${s.temperature_c.toFixed(1)}°C`:null, getStatus:s=>{const v=s?.temperature_c;return v==null?null:v>35?'critical':v>28?'warning':'normal';} },
    lux:         { icon:'☀', label:'Ambient Lux', node:'Node 2 — Classroom B', unit:'lx', normal:{range:'≥ 300 lx',action:null}, warning:{range:'80–300 lx',action:'LEDs dimming'}, critical:{range:'< 80 lx',action:'LEDs at full brightness'}, getLive:s=>s?.lux!=null?`${s.lux} lx`:null, getStatus:s=>{const v=s?.lux;return v==null?null:v<80?'critical':v<300?'warning':'normal';} },
    fire:        { icon:'🔥', label:'Fire Sim', node:'Node 3 — Lecture Hall', unit:'', normal:{range:'No spike',action:null}, warning:{range:'Rapid rise',action:'AI anomaly flag'}, critical:{range:'Instant spike',action:'Emergency protocol'}, getLive:s=>s?.fire_alert!=null?(s.fire_alert?'ALERT':'Clear'):null, getStatus:s=>s?.fire_alert?'critical':'normal' },
    power:       { icon:'⚡', label:'Campus Power', node:'INA219 — All Rooms', unit:'W', normal:{range:'< 5 kW',action:null}, warning:{range:'5–8 kW',action:'Review active devices'}, critical:{range:'> 8 kW',action:'Audit all nodes'}, getLive:s=>s?.campus_power_w!=null?`${(s.campus_power_w/1000).toFixed(1)} kW`:null, getStatus:s=>{const v=s?.campus_power_w;return v==null?null:v>8000?'critical':v>5000?'warning':'normal';} },
};
const SC = {
    normal:   { dot:'#10b981', text:'#34d399', bg:'rgba(16,185,129,0.08)',  border:'rgba(16,185,129,0.2)'  },
    warning:  { dot:'#f59e0b', text:'#fbbf24', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)'  },
    critical: { dot:'#ef4444', text:'#f87171', bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)'   },
};

function ThresholdPanel({ sensorFilter, sensorState, onClose }) {
    if (sensorFilter === 'all') return null;
    const t = THRESHOLD_DATA[sensorFilter];
    if (!t) return null;
    const readings = Object.entries(sensorState).map(([rid, s]) => {
        const live = t.getLive(s); const status = t.getStatus(s);
        if (!live || !status) return null;
        return { roomId:rid, room:rid.replace(/_/g,' '), live, status };
    }).filter(Boolean);

    return (
        <div style={{
            position:'absolute', top:16, right:16, zIndex:20, width:268,
            background:'rgba(6,10,20,0.97)', border:'1px solid #1e3a5f',
            borderRadius:12, overflow:'hidden',
            boxShadow:'0 0 30px rgba(59,130,246,0.12), 0 8px 32px rgba(0,0,0,0.8)',
        }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #0f2244',
                background:'rgba(14,23,44,0.7)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16 }}>{t.icon}</span>
                    <div>
                        <p style={{ fontSize:12, fontWeight:700, color:'#e2e8f0', margin:0 }}>{t.label}</p>
                        <p style={{ fontSize:9, color:'#475569', margin:0 }}>{t.node}</p>
                    </div>
                </div>
                <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
            {readings.length > 0 && (
                <div style={{ padding:'8px 14px', borderBottom:'1px solid #0f2244' }}>
                    {readings.map(r => {
                        const sc = SC[r.status] ?? SC.normal;
                        return (
                            <div key={r.roomId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                                <span style={{ fontSize:10, color:'#64748b' }}>{r.room}</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <span style={{ fontSize:11, fontWeight:700, color:sc.text, fontFamily:"'DM Mono',monospace" }}>{r.live}</span>
                                    <span style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4,
                                        color:sc.text, background:sc.bg, border:`1px solid ${sc.border}` }}>{r.status.toUpperCase()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                {['normal','warning','critical'].map(level => {
                    const sc = SC[level]; const th = t[level];
                    return (
                        <div key={level} style={{ padding:'8px 10px', borderRadius:8, background:sc.bg, border:`1px solid ${sc.border}` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                <span style={{ width:6, height:6, borderRadius:'50%', background:sc.dot, flexShrink:0 }} />
                                <span style={{ fontSize:9, fontWeight:700, color:sc.dot, letterSpacing:'0.1em' }}>{level.toUpperCase()}</span>
                            </div>
                            <p style={{ fontSize:12, fontWeight:700, color:sc.text, margin:'0 0 3px', fontFamily:"'DM Mono',monospace" }}>{th.range}</p>
                            {th.action && <p style={{ fontSize:9, color:'#64748b', margin:0 }}>{th.action}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
    return (
        <div style={{
            position:'absolute', top:16, right:16, zIndex:10,
            background:'rgba(5,8,18,0.94)', border:'1px solid #0f2244',
            borderRadius:8, padding:'9px 12px',
            boxShadow:'0 2px 12px rgba(0,0,0,0.7)',
        }}>
            <p style={{ fontSize:8, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.14em', margin:'0 0 7px' }}>Status</p>
            {[['#38bdf8','Optimal'],['#f59e0b','Warning'],['#ef4444','Critical / Fire'],['#60a5fa','Selected']].map(([color, label]) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:color, boxShadow:`0 0 6px ${color}88`, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:600, color:'#64748b' }}>{label}</span>
                </div>
            ))}
        </div>
    );
}

// ── Controls bar ───────────────────────────────────────────────────────────────
function ControlsBar({ onResetCamera, sensorFilter, onSensorFilter }) {
    return (
        <div style={{ position:'absolute', top:16, left:16, zIndex:10, display:'flex', flexDirection:'column', gap:8 }}>
            {/* Reset */}
            <button onClick={onResetCamera} style={{
                background:'rgba(5,8,18,0.94)', border:'1px solid #0f2244', borderRadius:8,
                padding:'5px 11px', color:'#7dd3fc', fontSize:10, fontWeight:700,
                cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                boxShadow:'0 2px 8px rgba(0,0,0,0.6)', letterSpacing:'0.05em',
            }}>
                ⟳ Reset
            </button>
            {/* Sensor filter */}
            <div style={{
                background:'rgba(5,8,18,0.94)', border:'1px solid #0f2244', borderRadius:8,
                padding:'7px', display:'flex', flexDirection:'column', gap:2,
                boxShadow:'0 2px 8px rgba(0,0,0,0.6)',
                minWidth:120,
            }}>
                <p style={{ fontSize:8, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase', letterSpacing:'0.14em', margin:'0 2px 3px', fontFamily:"'DM Mono',monospace" }}>Filter</p>
                {SENSOR_FILTER_CFG.map(cfg => {
                    const isActive = sensorFilter === cfg.id;
                    return (
                        <button key={cfg.id} onClick={() => onSensorFilter(isActive && cfg.id !== 'all' ? 'all' : cfg.id)}
                                style={{
                                    background: isActive ? `${cfg.color}18` : 'transparent',
                                    border:'none', borderLeft:`2px solid ${isActive ? cfg.color : '#0f2244'}`,
                                    borderRadius:'0 6px 6px 0', padding:'5px 8px',
                                    color: isActive ? cfg.color : '#475569',
                                    fontSize:11, fontWeight:700, cursor:'pointer',
                                    display:'flex', alignItems:'center', gap:7, textAlign:'left',
                                    boxShadow: isActive ? `inset 0 0 10px ${cfg.color}11` : 'none',
                                    transition:'all 0.15s',
                                }}>
              <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                  background: isActive ? cfg.color : '#1e293b',
                  border:`1.5px solid ${isActive ? cfg.color : '#334155'}`,
                  boxShadow: isActive ? `0 0 6px ${cfg.color}` : 'none' }} />
                            {cfg.label}
                        </button>
                    );
                })}
                {sensorFilter !== 'all' && (
                    <button onClick={() => onSensorFilter('all')} style={{
                        marginTop:4, background:'none', border:'none', color:'#334155',
                        fontSize:9, fontWeight:700, cursor:'pointer', textTransform:'uppercase',
                        letterSpacing:'0.1em', padding:'4px 8px', borderTop:'1px solid #0f2244',
                    }}>Clear Filter ×</button>
                )}
            </div>
        </div>
    );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function BuildingTwin3D({
                                           sensorState = MOCK_SENSOR_STATE,
                                           selectedRoom = null,
                                           onRoomSelect = () => {},
                                           height = '520px',
                                           compact = false,
                                       }) {
    const [localSelected, setLocalSelected] = useState(selectedRoom);
    const [sensorFilter,  setSensorFilter]  = useState('all');
    const controlsRef = useRef();

    useEffect(() => { setLocalSelected(selectedRoom); }, [selectedRoom]);

    function handleRoomSelect(id) { setLocalSelected(id); onRoomSelect(id); }
    function resetCamera() { if (controlsRef.current) controlsRef.current.reset(); }

    const selectedRoomData = ROOMS.find(r => r.id === localSelected);

    return (
        <div style={{ position:'relative', width:'100%', height, borderRadius:16, overflow:'hidden',
            border:'1px solid #1e3a5f', background:'#060a14',
            boxShadow:'0 0 40px rgba(59,130,246,0.08), 0 2px 8px rgba(0,0,0,0.6)' }}>

            <Canvas shadows dpr={[1, 1.5]} frameloop="always"
                    gl={{ antialias:true, alpha:false, powerPreference:'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
                    camera={{ fov:50, position:[12, 10, 14] }}>
                <Suspense fallback={null}>
                    <Scene sensorState={sensorState} selectedRoom={localSelected}
                           onRoomSelect={handleRoomSelect} sensorFilter={sensorFilter} />
                </Suspense>
            </Canvas>

            <ControlsBar onResetCamera={resetCamera} sensorFilter={sensorFilter} onSensorFilter={setSensorFilter} />

            {!compact && sensorFilter === 'all' && <Legend />}

            {sensorFilter !== 'all' && (
                <ThresholdPanel sensorFilter={sensorFilter} sensorState={sensorState} onClose={() => setSensorFilter('all')} />
            )}

            {localSelected && (
                <SensorPanel room={selectedRoomData} sensor={sensorState[localSelected]}
                             onClose={() => { setLocalSelected(null); onRoomSelect(null); }} />
            )}

            {/* Live indicator */}
            <div style={{ position:'absolute', bottom:12, right:12, display:'flex', alignItems:'center', gap:5,
                fontSize:8, fontWeight:600, color:'#0f2244', textTransform:'uppercase', letterSpacing:'0.14em',
                fontFamily:"'DM Mono',monospace", userSelect:'none' }}>
                <span style={{ width:4, height:4, borderRadius:'50%', background:'#0369a1', opacity:0.7 }} />
                RIT DUBAI · SMARTTWIN
            </div>
        </div>
    );
}