/**
 * BuildingTwin3D.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive 3D Digital Twin — RIT Dubai mini-campus building
 *
 * Floor plan (1030 × 1010 CAD → scaled ÷100):
 *   Floor 1: Lobby (3×4), Classroom 1 (3×4), Classroom 2 (4.3×4),
 *            Large Lecture Hall (4.3×6.1)  [L-shape cutout bottom-right]
 *   Floor 2: Lounge (3×4), Computer Lab (7.3×4), Faculty Office (4.3×2),
 *            Control Room (4.3×2), Mechanical Room (4.3×2)
 *
 * IoT nodes:
 *   Node 1 → Classroom 1    PIR + lux + temp + INA219 + LED
 *   Node 2 → Classroom 2    PIR + lux + temp + INA219 + LED (dimmable)
 *   Node 3 → Lecture Hall   occupancy counter + temp + CO2 + INA219 + servo damper
 *   Node 4 → Faculty Office PIR + temp + INA219
 *   Node 5 → Computer Lab   temp + humidity + PC count + LED strips + INA219
 *   Node 6 → Mechanical Rm  12V DC fan + MOSFET + INA219
 *
 * Phase 3: pass live Firebase data via sensorState prop — component unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useEffect, Suspense, lazy } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Icon from './Icon';
import { MOCK_SENSOR_STATE } from '../../services/sensorState';

// ── Geometry constants (all in Three.js units, 1 unit ≈ 10 cm) ───────────────
const FLOOR_H = 3.2;   // floor-to-ceiling height
const WALL_T  = 0.09;  // wall thickness
const CEIL_T  = 0.07;  // ceiling slab thickness

// ── Room definitions — derived from actual floor plan dimensions ───────────────
const ROOMS = [
    // id                  label                   node  fl   cx     cz     w     d
    ['Lobby_Reception',   'Lobby /\nReception',    null, 1,   1.50,  2.00,  3.00, 4.00],
    ['Classroom_1',       'Classroom 1',            1,   1,   4.50,  2.00,  3.00, 4.00],
    ['Classroom_2',       'Classroom 2',            2,   1,   7.65,  2.00,  4.30, 4.00],
    ['Large_Lecture_Hall','Large\nLecture Hall',    3,   1,   2.15,  7.05,  4.30, 6.10],
    ['Lounge_Study',      'Lounge /\nStudy',        null, 2,   1.50,  2.00,  3.00, 4.00],
    ['Computer_Lab',      'Computer Lab',            5,   2,   6.65,  2.00,  7.30, 4.00],
    ['Faculty_Office',    'Faculty\nOffice',         4,   2,   2.15,  5.00,  4.30, 2.00],
    ['Control_Room',      'Control\nRoom',           null, 2,   2.15,  7.00,  4.30, 2.00],
    ['Mechanical_Room',   'Mechanical\nRoom',        6,   2,   2.15,  9.00,  4.30, 2.00],
].map(([id, label, node, floor, cx, cz, w, d]) => ({ id, label, node, floor, cx, cz, w, d }));

// ── Colour helpers ────────────────────────────────────────────────────────────
const COLORS = {
    optimal:  new THREE.Color('#0d9488'),
    warning:  new THREE.Color('#b45309'),
    critical: new THREE.Color('#b91c1c'),
    fire:     new THREE.Color('#dc2626'),
    selected: new THREE.Color('#1d4ed8'),
    hovered:  new THREE.Color('#2563eb'),
    wall:     new THREE.Color('#0f172a'),
    floor_slab: new THREE.Color('#1e293b'),
    ceiling_off: new THREE.Color('#1e293b'),
    ceiling_on:  new THREE.Color('#fefce8'),
    ground:   new THREE.Color('#080d14'),
};

function roomBaseColor(sensor, selected, hovered) {
    if (selected)             return COLORS.selected;
    if (hovered)              return COLORS.hovered;
    if (sensor?.fire_alert)   return COLORS.fire;
    switch (sensor?.status) {
        case 'critical': return COLORS.critical;
        case 'warning':  return COLORS.warning;
        default:         return COLORS.optimal;
    }
}

// Temp → colour gradient (blue=cold, green=ok, red=hot) for Lecture Hall
function tempColor(t) {
    if (t == null) return COLORS.optimal;
    if (t < 22) return new THREE.Color('#1d4ed8');
    if (t > 26) return new THREE.Color('#dc2626');
    if (t > 24) return new THREE.Color('#d97706');
    return COLORS.optimal;
}

// ── Animated components ───────────────────────────────────────────────────────

function PulseRing({ y, color = '#ef4444' }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.25;
        ref.current.scale.setScalar(s);
        ref.current.material.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 5) * 0.25;
    });
    return (
        <mesh ref={ref} position={[0, y + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.7, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
    );
}

function SpinningFan({ speed = 0, active }) {
    const ref = useRef();
    useFrame((_, dt) => {
        if (ref.current) ref.current.rotation.z += dt * (speed / 100) * 6;
    });
    return (
        <group ref={ref}>
            {[0, 90, 180, 270].map(a => (
                <mesh key={a} rotation={[0, 0, (a * Math.PI) / 180]}>
                    <boxGeometry args={[0.4, 0.1, 0.05]} />
                    <meshStandardMaterial color={active ? '#94a3b8' : '#334155'} metalness={0.6} roughness={0.3} />
                </mesh>
            ))}
            <mesh><cylinderGeometry args={[0.07, 0.07, 0.07, 12]} /><meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} /></mesh>
        </group>
    );
}

function DamperBlade({ angle = 90 }) {
    // angle 0 = horizontal (fully open), 90 = vertical (closed)
    return (
        <mesh rotation={[(angle * Math.PI) / 180, 0, 0]}>
            <boxGeometry args={[0.7, 0.04, 0.3]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>
    );
}

// LED strip glow along room perimeter (Computer Lab)
function LEDStrip({ w, d, active, color = '#00d4b4' }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (!ref.current || !active) return;
        ref.current.material.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 2) * 0.2;
    });
    if (!active) return null;
    return (
        <mesh ref={ref} position={[0, -FLOOR_H / 2 + 0.1, 0]}>
            <boxGeometry args={[w - 0.2, 0.04, d - 0.2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.4} />
        </mesh>
    );
}

// Motion detected sphere (PIR indicator)
function MotionIndicator({ detected }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (!ref.current) return;
        ref.current.material.emissiveIntensity = detected
            ? 0.5 + Math.sin(clock.getElapsedTime() * 8) * 0.5
            : 0;
    });
    return (
        <mesh ref={ref} position={[0.6, 0.4, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color={detected ? '#60a5fa' : '#1e293b'} emissive="#60a5fa" emissiveIntensity={0} />
        </mesh>
    );
}

// Occupancy fill bar (Lecture Hall)
function OccupancyBar({ occ, maxOcc, w }) {
    const pct = Math.min(1, occ / maxOcc);
    const barW = (w - 0.4) * pct;
    const barColor = pct > 0.8 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : '#10b981';
    return (
        <group position={[0, -FLOOR_H / 2 + 0.25, 0]}>
            {/* Background */}
            <mesh><boxGeometry args={[w - 0.4, 0.12, 0.08]} /><meshStandardMaterial color="#1e293b" /></mesh>
            {/* Fill */}
            {pct > 0 && (
                <mesh position={[-(w - 0.4) / 2 + barW / 2, 0, 0.01]}>
                    <boxGeometry args={[barW, 0.10, 0.08]} />
                    <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={0.3} />
                </mesh>
            )}
        </group>
    );
}

// ── HTML overlay badge ────────────────────────────────────────────────────────
function NodeBadge({ node, fire, critical }) {
    const color = fire ? '#ef4444' : critical ? '#dc2626' : '#2563eb';
    return (
        <Html center distanceFactor={9} position={[0, FLOOR_H / 2 - 0.3, 0]}>
            <div style={{
                background: color, color: '#fff', fontSize: '8px', fontWeight: 800,
                fontFamily: 'DM Mono, monospace', padding: '2px 6px', borderRadius: '4px',
                letterSpacing: '0.8px', whiteSpace: 'nowrap', pointerEvents: 'none',
                boxShadow: `0 0 8px ${color}88`,
            }}>
                NODE {node}
            </div>
        </Html>
    );
}

// Sensor readout floating chip
function SensorChip({ value, color = '#94a3b8', icon = '' }) {
    return (
        <Html center distanceFactor={12} position={[0, -FLOOR_H / 2 + 0.55, 0]}>
            <div style={{
                background: 'rgba(15,23,42,0.88)', border: `1px solid ${color}`,
                color, fontSize: '9px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
                padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
                pointerEvents: 'none', display: 'flex', gap: '4px', alignItems: 'center',
            }}>
                {icon} {value}
            </div>
        </Html>
    );
}


// ── Computer Lab furniture: desks + monitors with per-PC status ───────────────
//
// Layout: 5 rows of 6 desks = 30 workstations
// Each desk has a surface + monitor + screen glow
//   green glow  = PC in use by a student (activePcs count filled from left→right)
//   red glow    = PC powered but idle / not in use
//   dark        = PC shutdown (pc_power = false)
//
// Room: 7.3 wide × 4.0 deep, origin = room centre, floor at -FLOOR_H/2

function PCMonitor({ pcIndex, activePcs, pcPower }) {
    const ref = useRef();
    const isActive   = pcPower && pcIndex < activePcs;
    const isPowered  = pcPower && pcIndex >= activePcs;
    const isOff      = !pcPower;

    const screenColor  = isActive ? '#22c55e' : isPowered ? '#ef4444' : '#1e293b';
    const emissive     = isActive ? '#16a34a' : isPowered ? '#b91c1c' : '#000';
    const emissiveInt  = isOff    ? 0 : 0.7;

    // Subtle active screen pulse
    useFrame(({ clock }) => {
        if (!ref.current || !isActive) return;
        ref.current.material.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 1.5 + pcIndex) * 0.2;
    });

    return (
        <group>
            {/* Monitor stand */}
            <mesh position={[0, 0.18, 0.04]}>
                <boxGeometry args={[0.04, 0.18, 0.04]} />
                <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.8} />
            </mesh>
            {/* Monitor base */}
            <mesh position={[0, 0.09, 0.04]}>
                <boxGeometry args={[0.18, 0.03, 0.14]} />
                <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.8} />
            </mesh>
            {/* Monitor bezel */}
            <mesh position={[0, 0.34, 0.06]}>
                <boxGeometry args={[0.36, 0.26, 0.03]} />
                <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Screen — glows green (active) or red (idle) */}
            <mesh ref={ref} position={[0, 0.34, 0.075]}>
                <boxGeometry args={[0.30, 0.20, 0.005]} />
                <meshStandardMaterial
                    color={screenColor}
                    emissive={emissive}
                    emissiveIntensity={emissiveInt}
                />
            </mesh>
            {/* Screen glow light */}
            {!isOff && (
                <pointLight
                    position={[0, 0.34, 0.2]}
                    color={isActive ? '#22c55e' : '#ef4444'}
                    intensity={isActive ? 0.3 : 0.15}
                    distance={0.8}
                    decay={2}
                />
            )}
        </group>
    );
}

function Desk({ pcIndex, activePcs, pcPower }) {
    return (
        <group>
            {/* Desk surface */}
            <mesh position={[0, 0.09, 0]}>
                <boxGeometry args={[0.55, 0.04, 0.50]} />
                <meshStandardMaterial color="#2d1b0e" roughness={0.8} metalness={0.1} />
            </mesh>
            {/* Desk legs (front 2) */}
            {[[-0.23, 0.2], [0.23, 0.2]].map(([x, z], i) => (
                <mesh key={i} position={[x, -0.30, z]}>
                    <boxGeometry args={[0.04, 0.55, 0.04]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
                </mesh>
            ))}
            {/* Desk legs (back 2) */}
            {[[-0.23, -0.2], [0.23, -0.2]].map(([x, z], i) => (
                <mesh key={i} position={[x, -0.30, z]}>
                    <boxGeometry args={[0.04, 0.55, 0.04]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
                </mesh>
            ))}
            {/* PC tower (under desk) */}
            <mesh position={[0.18, -0.18, -0.15]}>
                <boxGeometry args={[0.12, 0.22, 0.24]} />
                <meshStandardMaterial
                    color={pcPower ? '#1e3a5f' : '#0f172a'}
                    roughness={0.5} metalness={0.6}
                />
            </mesh>
            {/* Keyboard */}
            <mesh position={[0, 0.115, 0.12]}>
                <boxGeometry args={[0.30, 0.015, 0.12]} />
                <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.2} />
            </mesh>
            {/* Monitor */}
            <group position={[0, 0.115, -0.06]}>
                <PCMonitor pcIndex={pcIndex} activePcs={activePcs} pcPower={pcPower} />
            </group>
        </group>
    );
}

function ComputerLabFurniture({ w, d, activePcs, totalPcs, pcPower, ledStrips, shutdownWarning }) {
    // Layout: 5 rows × 6 columns = 30 desks
    // Room interior available: w=7.3, d=4.0
    // Rows run along depth (Z), columns along width (X)
    const COLS     = 6;
    const ROWS     = 5;
    const xStep    = (w - 1.2) / (COLS - 1);   // column spacing
    const zStep    = (d - 0.9) / (ROWS - 1);   // row spacing
    const xStart   = -(w - 1.2) / 2;
    const zStart   = -(d - 0.9) / 2;
    const floorY   = -FLOOR_H / 2 + 0.55;       // desk base above room floor

    const desks = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const pcIndex = row * COLS + col;
            if (pcIndex >= totalPcs) break;
            desks.push({
                pcIndex,
                x: xStart + col * xStep,
                z: zStart + row * zStep,
            });
        }
    }

    return (
        <group>
            {/* LED perimeter strip */}
            <LEDStrip w={w} d={d} active={ledStrips} color="#00d4b4" />

            {/* Desks */}
            {desks.map(({ pcIndex, x, z }) => (
                <group key={pcIndex} position={[x, floorY, z]}>
                    <Desk pcIndex={pcIndex} activePcs={activePcs} pcPower={pcPower} />
                </group>
            ))}

            {/* Teacher's desk at the front (larger, no PC glow) */}
            <group position={[0, floorY, -(d / 2 - 0.4)]}>
                <mesh position={[0, 0.09, 0]}>
                    <boxGeometry args={[1.1, 0.05, 0.55]} />
                    <meshStandardMaterial color="#3b1f0a" roughness={0.7} metalness={0.1} />
                </mesh>
                {/* Teacher monitor */}
                <group position={[0, 0.115, -0.05]}>
                    <PCMonitor pcIndex={-1} activePcs={pcPower ? 1 : 0} pcPower={pcPower} />
                </group>
            </group>

            {/* PC count status chip */}
            <Html center distanceFactor={10} position={[0, FLOOR_H / 2 - 0.6, 0]}>
                <div style={{
                    background: pcPower ? 'rgba(15,23,42,0.92)' : 'rgba(30,41,59,0.92)',
                    border: `1px solid ${pcPower ? (activePcs > 0 ? '#22c55e' : '#ef4444') : '#475569'}`,
                    color: pcPower ? (activePcs > 0 ? '#86efac' : '#fca5a5') : '#94a3b8',
                    fontSize: '9px', fontWeight: 800,
                    fontFamily: 'DM Mono, monospace',
                    padding: '3px 8px', borderRadius: '5px',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    display: 'flex', gap: '6px', alignItems: 'center',
                }}>
          <span style={{ display:'inline-block', width:'7px', height:'7px', borderRadius:'50%',
              background: pcPower ? (activePcs > 0 ? '#22c55e' : '#ef4444') : '#475569',
              boxShadow: pcPower ? `0 0 5px ${activePcs > 0 ? '#22c55e' : '#ef4444'}` : 'none',
          }}/>
                    {pcPower
                        ? `${activePcs} / ${totalPcs} PCs in use`
                        : 'ALL PCs SHUTDOWN'}
                </div>
            </Html>

            {/* Shutdown warning */}
            {shutdownWarning && (
                <Html center distanceFactor={10} position={[0, FLOOR_H / 2 - 0.9, 0]}>
                    <div style={{
                        background: 'rgba(120,53,15,0.92)', border: '1px solid #f59e0b',
                        color: '#fcd34d', fontSize: '9px', fontWeight: 800,
                        fontFamily: 'DM Mono, monospace',
                        padding: '3px 8px', borderRadius: '5px', whiteSpace: 'nowrap', pointerEvents: 'none',
                    }}>
                        ⚠ PC SHUTDOWN IN &lt;30 MIN
                    </div>
                </Html>
            )}
        </group>
    );
}

// ── Single room mesh ──────────────────────────────────────────────────────────
function RoomMesh({ room, sensor, selected, onSelect }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);
    const floorBase = (room.floor - 1) * FLOOR_H;
    const fireAlert = sensor?.fire_alert;
    const isCritical = sensor?.status === 'critical' || fireAlert;

    // Real-time colour + fire flash
    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material;
        if (fireAlert) {
            const flash = Math.sin(clock.getElapsedTime() * 9) > 0;
            mat.color.set(flash ? '#ef4444' : '#450a0a');
            mat.emissive.set(flash ? '#ef4444' : '#000');
            mat.emissiveIntensity = flash ? 0.5 : 0;
        } else {
            const useTemp = room.id === 'Large_Lecture_Hall' && sensor?.temperature_c != null;
            mat.color.copy(useTemp ? tempColor(sensor.temperature_c) : roomBaseColor(sensor, selected, hovered));
            mat.emissive.set(selected ? '#1d4ed8' : '#000');
            mat.emissiveIntensity = selected ? 0.12 : 0;
        }
    });

    const lightsOn = sensor?.lights ?? false;
    const baseCol  = roomBaseColor(sensor, selected, hovered);

    return (
        <group position={[room.cx, floorBase + FLOOR_H / 2, room.cz]}>
            {/* Main room box — transparent walls */}
            <mesh
                ref={meshRef}
                onClick={e => { e.stopPropagation(); onSelect(room.id); }}
                onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            >
                <boxGeometry args={[room.w - WALL_T, FLOOR_H - CEIL_T, room.d - WALL_T]} />
                <meshStandardMaterial
                    color={baseCol}
                    transparent opacity={selected ? 0.72 : hovered ? 0.62 : 0.42}
                    metalness={0.05} roughness={0.7}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Floor slab */}
            <mesh position={[0, -FLOOR_H / 2 + 0.04, 0]}>
                <boxGeometry args={[room.w, 0.08, room.d]} />
                <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.3} />
            </mesh>

            {/* Ceiling — glows when lights on */}
            <mesh position={[0, FLOOR_H / 2 - CEIL_T / 2, 0]}>
                <boxGeometry args={[room.w - WALL_T * 2, CEIL_T, room.d - WALL_T * 2]} />
                <meshStandardMaterial
                    color={lightsOn ? COLORS.ceiling_on : COLORS.ceiling_off}
                    emissive={lightsOn ? '#fefce8' : '#000'}
                    emissiveIntensity={lightsOn ? 0.7 : 0}
                />
            </mesh>

            {/* Room point light when lit */}
            {lightsOn && (
                <pointLight position={[0, FLOOR_H / 2 - 0.4, 0]}
                            color="#fffbeb" intensity={1.0} distance={room.w * 1.8} decay={2} />
            )}

            {/* Room name label */}
            <Text position={[0, 0.15, 0]} fontSize={0.21} color={selected ? '#ffffff' : '#e2e8f0'}
                  anchorX="center" anchorY="middle" textAlign="center"
                  maxWidth={room.w * 0.8} outlineWidth={0.012} outlineColor="#0f172a">
                {room.label}
            </Text>

            {/* Power reading */}
            {sensor?.power_w != null && (
                <Text position={[0, -0.3, 0]} fontSize={0.15} color="#64748b"
                      anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor="#0f172a">
                    {sensor.power_w >= 1000
                        ? `${(sensor.power_w / 1000).toFixed(1)} kW`
                        : `${sensor.power_w.toFixed(0)} W`}
                </Text>
            )}

            {/* Node badge */}
            {room.node && (
                <NodeBadge node={room.node} fire={fireAlert} critical={isCritical} />
            )}

            {/* Fire alert pulse */}
            {fireAlert && <PulseRing y={FLOOR_H / 2} color="#ef4444" />}
            {/* Critical pulse (non-fire) */}
            {isCritical && !fireAlert && <PulseRing y={FLOOR_H / 2} color="#dc2626" />}

            {/* ── Node-specific 3D elements ── */}

            {/* Node 1: Classroom 1 — PIR motion indicator sphere */}
            {room.id === 'Classroom_1' && (
                <MotionIndicator detected={sensor?.motion} />
            )}

            {/* Node 2: Classroom 2 — ambient lux dimming chip */}
            {room.id === 'Classroom_2' && sensor?.lux != null && (
                <SensorChip value={`${sensor.lux} lx`} color="#fbbf24" icon="☀" />
            )}

            {/* Node 3: Lecture Hall — HVAC assembly + occupancy bar + temp + CO2 */}
            {room.id === 'Large_Lecture_Hall' && (
                <>
                    {/* Occupancy bar at floor level */}
                    {sensor?.occupancy != null && (
                        <OccupancyBar occ={sensor.occupancy} maxOcc={sensor.max_occupancy ?? 100} w={room.w} />
                    )}
                    {/* AHU damper + fan assembly (front wall, mid-height) */}
                    <group position={[room.w / 2 - 0.5, 0, 0]}>
                        <DamperBlade angle={sensor?.damper_angle ?? 90} />
                        <SpinningFan speed={sensor?.fan_speed_pct ?? 0} active={(sensor?.fan_speed_pct ?? 0) > 0} />
                    </group>
                    {/* CO2 alert chip */}
                    {sensor?.co2_ppm != null && (
                        <Html center distanceFactor={11} position={[0, -FLOOR_H / 2 + 0.78, 0]}>
                            <div style={{
                                background: sensor.co2_ppm > 1000 ? 'rgba(185,28,28,0.9)' : 'rgba(15,23,42,0.88)',
                                border: `1px solid ${sensor.co2_ppm > 1000 ? '#ef4444' : '#0d9488'}`,
                                color: sensor.co2_ppm > 1000 ? '#fca5a5' : '#5eead4',
                                fontSize: '9px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
                                padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none',
                            }}>
                                CO₂ {sensor.co2_ppm} ppm
                            </div>
                        </Html>
                    )}
                </>
            )}

            {/* Node 5: Computer Lab — desks, monitors, per-PC status glow */}
            {room.id === 'Computer_Lab' && (
                <ComputerLabFurniture
                    w={room.w} d={room.d}
                    activePcs={sensor?.active_pcs ?? 0}
                    totalPcs={sensor?.total_pcs ?? 30}
                    pcPower={sensor?.pc_power ?? true}
                    ledStrips={sensor?.led_strips ?? true}
                    shutdownWarning={sensor?.shutdown_warning ?? false}
                />
            )}

            {/* Node 6: Mechanical Room — spinning fan + damper */}
            {room.id === 'Mechanical_Room' && (
                <group position={[0.8, 0.3, 0]}>
                    <SpinningFan speed={sensor?.fan_speed_pct ?? 0} active={(sensor?.fan_speed_pct ?? 0) > 0} />
                    <group position={[-1.0, 0, 0]}>
                        <DamperBlade angle={sensor?.damper_angle ?? 90} />
                    </group>
                </group>
            )}

            {/* Node 4: Faculty Office — presence dot */}
            {room.id === 'Faculty_Office' && sensor?.faculty_present && (
                <mesh position={[0, FLOOR_H / 2 - 0.8, 0]}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.8} />
                </mesh>
            )}
        </group>
    );
}

// ── Floor separators ──────────────────────────────────────────────────────────
function FloorSlabs() {
    // Between floors: full top-row slab + left-column slab
    return (
        <>
            {/* Top row slab between F1 and F2 */}
            <mesh position={[4.9, FLOOR_H, 2.0]}>
                <boxGeometry args={[10.3, 0.14, 4.0]} />
                <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.3} />
            </mesh>
            {/* Left column slab between F1 and F2 */}
            <mesh position={[2.15, FLOOR_H, 7.05]}>
                <boxGeometry args={[4.3, 0.14, 6.1]} />
                <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.3} />
            </mesh>
        </>
    );
}

// ── Building edge wireframe outlines ──────────────────────────────────────────
function BuildingEdges() {
    const segments = [
        [10.3, FLOOR_H, 4.0,  4.9,  FLOOR_H/2,    2.0],
        [4.3,  FLOOR_H, 6.1,  2.15, FLOOR_H/2,    7.05],
        [10.3, FLOOR_H, 4.0,  4.9,  FLOOR_H*1.5,  2.0],
        [4.3,  FLOOR_H, 6.1,  2.15, FLOOR_H*1.5,  7.05],
    ];
    return (
        <>
            {segments.map(([w,h,d,x,y,z],i) => (
                <lineSegments key={i} position={[x, y, z]}>
                    <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
                    <lineBasicMaterial color="#1e3a5f" transparent opacity={0.6} />
                </lineSegments>
            ))}
        </>
    );
}

// ── Floor labels ──────────────────────────────────────────────────────────────
function FloorLabels() {
    return (
        <>
            {[1, 2].map(f => (
                <Text key={f}
                      position={[-0.4, (f - 1) * FLOOR_H + FLOOR_H / 2, 5.5]}
                      fontSize={0.24} color="#334155"
                      anchorX="right" anchorY="middle" rotation={[0, 0.15, 0]}>
                    {`FL ${f}`}
                </Text>
            ))}
        </>
    );
}

// ── Ground + grid ─────────────────────────────────────────────────────────────
function Ground() {
    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.0, -0.02, 5.5]}>
                <planeGeometry args={[24, 24]} />
                <meshStandardMaterial color="#07090f" roughness={1} />
            </mesh>
            <gridHelper args={[24, 24, '#0d2440', '#0d2440']} position={[5.0, 0, 5.5]} />
        </>
    );
}

// ── Main 3D scene ─────────────────────────────────────────────────────────────
function Scene({ sensorState, selectedRoom, onRoomSelect }) {
    const { camera } = useThree();
    useEffect(() => {
        camera.position.set(18, 14, 18);
        camera.lookAt(5, 3.5, 5);
    }, []);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.25} color="#dbeafe" />
            <directionalLight position={[16, 22, 12]} intensity={0.9} color="#ffffff" castShadow />
            <directionalLight position={[-8, 12, -6]}  intensity={0.25} color="#93c5fd" />
            <hemisphereLight skyColor="#1e3a5f" groundColor="#07090f" intensity={0.45} />

            <Ground />
            <FloorSlabs />
            <BuildingEdges />
            <FloorLabels />

            {ROOMS.map(room => (
                <RoomMesh
                    key={room.id}
                    room={room}
                    sensor={sensorState[room.id]}
                    selected={selectedRoom === room.id}
                    onSelect={onRoomSelect}
                />
            ))}

            <OrbitControls
                target={[5, 3.5, 5]}
                minDistance={6} maxDistance={38}
                minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.05}
                enableDamping dampingFactor={0.06}
            />
        </>
    );
}

// ── Selected room info panel ──────────────────────────────────────────────────
function InfoPanel({ roomId, sensor, onClose }) {
    if (!roomId || !sensor) return null;
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return null;

    const statusColor = sensor.fire_alert ? '#ef4444'
        : sensor.status === 'critical' ? '#ef4444'
            : sensor.status === 'warning'  ? '#f59e0b' : '#10b981';

    const rows = [
        sensor.power_w      != null && ['Power',       sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(2)} kW` : `${sensor.power_w.toFixed(0)} W`],
        sensor.occupancy    != null && ['Occupancy',    `${sensor.occupancy}${sensor.max_occupancy ? ' / '+sensor.max_occupancy : ''}`],
        sensor.temperature_c!= null && ['Temperature', `${sensor.temperature_c.toFixed(1)} °C`],
        sensor.humidity_pct != null && ['Humidity',    `${sensor.humidity_pct.toFixed(0)} %`],
        sensor.co2_ppm      != null && ['CO₂',         `${sensor.co2_ppm} ppm`],
        sensor.lux          != null && ['Lux',          `${sensor.lux} lx`],
        sensor.lights       != null && ['Lights',       sensor.lights ? 'ON' : 'OFF'],
        sensor.lss          != null && ['LSS',           sensor.lss],
        sensor.lcs          != null && ['LCS',           sensor.lcs],
        sensor.hcs          != null && ['HCS',           sensor.hcs],
        sensor.los          != null && ['LOS Override',  sensor.los],
        sensor.motion       != null && ['PIR Motion',    sensor.motion ? 'Detected' : 'Clear'],
        sensor.ambient_dark != null && ['Ambient Dark',  sensor.ambient_dark ? 'Yes (lights needed)' : 'No (bright)'],
        sensor.fan_speed_pct!= null && ['Fan Speed',    `${sensor.fan_speed_pct}%`],
        sensor.damper_angle != null && ['Damper Angle', `${sensor.damper_angle}°`],
        sensor.faculty_present != null && ['Faculty',   sensor.faculty_present ? 'Present' : 'Away'],
        sensor.fss          != null && ['FSS',           sensor.fss ? 'TRUE' : 'FALSE'],
        sensor.pc_power     != null && ['PCs',           sensor.pc_power ? 'ON' : 'Shutdown'],
        sensor.active_pcs   != null && ['Active PCs',   `${sensor.active_pcs}`],
        sensor.led_strips   != null && ['LED Strips',   sensor.led_strips ? 'ON' : 'OFF'],
        sensor.smoke        != null && ['Smoke',         sensor.smoke ? '⚠ DETECTED' : 'Clear'],
    ].filter(Boolean);

    return (
        <div className="absolute bottom-4 left-4 z-20 w-60 rounded-xl border border-slate-700 overflow-hidden"
             style={{ background:'rgba(8,13,20,0.96)', backdropFilter:'blur(12px)', boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0"
                style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                    <h3 className="text-sm font-bold text-white truncate">{room.label.replace('\n', ' ')}</h3>
                </div>
                <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors ml-2 shrink-0">
                    <Icon name="x" className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Fire alert */}
            {sensor.fire_alert && (
                <div className="px-4 py-2 bg-red-950 border-b border-red-900 flex items-center gap-2">
                    <Icon name="fire" className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest animate-pulse">FIRE ALERT</span>
                </div>
            )}

            {/* Node tag */}
            {room.node && (
                <div className="px-4 py-1 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">IoT Node {room.node}</span>
                </div>
            )}

            {/* Sensor rows */}
            <div className="px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
                {rows.map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-3">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
                        <span className="text-[11px] font-bold text-slate-200 text-right"
                              style={{ fontFamily:"'DM Mono',monospace" }}>{val}</span>
                    </div>
                ))}
            </div>

            {/* Status footer */}
            <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[9px] text-slate-600 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: statusColor, fontFamily:"'DM Mono',monospace" }}>
          {sensor.fire_alert ? 'FIRE ALERT' : (sensor.status ?? '—').toUpperCase()}
        </span>
            </div>
        </div>
    );
}

// ── Legend overlay ────────────────────────────────────────────────────────────
function Legend() {
    return (
        <div className="absolute top-4 right-4 z-20 rounded-xl border border-slate-800 px-3.5 py-3"
             style={{ background:'rgba(8,13,20,0.92)', backdropFilter:'blur(12px)' }}>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Room Status</p>
            {[['#0d9488','Optimal'],['#b45309','Warning'],['#b91c1c','Critical'],['#dc2626','Fire Alert'],['#1d4ed8','Selected']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-2 mb-1.5 last:mb-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background:c, boxShadow:`0 0 4px ${c}80` }} />
                    <span className="text-[10px] font-semibold text-slate-400">{l}</span>
                </div>
            ))}
            <div className="mt-2 pt-2 border-t border-slate-800">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sensors</p>
                {[['🔵','PIR motion (sphere)'],['🟡','Lux level'],['🟢','Faculty present'],['🔴','CO₂ / Temp alert'],['💠','LED strips (lab)'],['⚙','Fan + damper']].map(([icon,l]) => (
                    <div key={l} className="flex items-center gap-1.5 mb-1 last:mb-0">
                        <span className="text-[10px] w-4 text-center">{icon}</span>
                        <span className="text-[10px] text-slate-500">{l}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Controls bar ──────────────────────────────────────────────────────────────
function ControlBar({ activeFloor, setActiveFloor }) {
    return (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <div className="rounded-xl border border-slate-800 p-1 flex gap-1"
                 style={{ background:'rgba(8,13,20,0.92)', backdropFilter:'blur(12px)' }}>
                {['All','1','2'].map(f => (
                    <button key={f} onClick={() => setActiveFloor(f)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all
                    ${activeFloor===f ? 'bg-blue-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {f === 'All' ? 'Both' : `F${f}`}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function BuildingTwin3D({
                                           sensorState = MOCK_SENSOR_STATE,
                                           selectedRoom = null,
                                           onRoomSelect = () => {},
                                           height = '500px',
                                           compact = false,
                                       }) {
    const [localSel,    setLocalSel]    = useState(selectedRoom);
    const [activeFloor, setActiveFloor] = useState('All');

    useEffect(() => { setLocalSel(selectedRoom); }, [selectedRoom]);

    function handleSelect(id) {
        const next = localSel === id ? null : id;
        setLocalSel(next);
        onRoomSelect(next);
    }

    const visibleRooms = activeFloor === 'All'
        ? ROOMS
        : ROOMS.filter(r => String(r.floor) === activeFloor);

    return (
        <div className="relative w-full rounded-xl overflow-hidden border border-slate-800"
             style={{ height, background:'#07090f' }}>

            <Canvas
                frameloop="demand"
                shadows={false}
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            >
                <Suspense fallback={null}>
                    <Scene
                        sensorState={sensorState}
                        selectedRoom={localSel}
                        onRoomSelect={handleSelect}
                    />
                </Suspense>
            </Canvas>

            <ControlBar activeFloor={activeFloor} setActiveFloor={setActiveFloor} />
            {!compact && <Legend />}
            <InfoPanel
                roomId={localSel}
                sensor={sensorState[localSel]}
                onClose={() => { setLocalSel(null); onRoomSelect(null); }}
            />

            {/* Live / mock badge */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Mock · Phase 3 → Firebase
            </div>
        </div>
    );
}