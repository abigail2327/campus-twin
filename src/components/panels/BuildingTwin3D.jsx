/**
 * BuildingTwin3D.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive 3D Digital Twin — RIT Dubai mini-campus building.
 * Original clean version (transparent rooms, dark background, no photorealistic
 * exterior shell) — sensor filter added as per professor feedback.
 *
 * IoT Nodes:
 *   Node 1 → Classroom 1    (PIR + lux + temp)
 *   Node 2 → Classroom 2    (ambient lux + temp)
 *   Node 3 → Lecture Hall   (temp + CO₂ + occupancy + HVAC servo)
 *   Node 4 → Faculty Office (PIR + temp)
 *   Node 5 → Computer Lab   (temp + humidity + PC count)
 *   Node 6 → Mechanical Room (12V DC fan + INA219)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import Icon from './Icon';
import { MOCK_SENSOR_STATE } from '../../services/sensorState';

// ── Constants ─────────────────────────────────────────────────────────────────
const FLOOR_H = 3.2;
const WALL_T  = 0.08;
const CEIL_H  = 0.06;

const ROOMS = [
    { id:'Lobby_Reception',    label:'Lobby /\nReception',    node:null, floor:1, x:1.50, z:2.00, w:3.00, d:4.00 },
    { id:'Classroom_1',        label:'Classroom 1',           node:1,    floor:1, x:4.50, z:2.00, w:3.00, d:4.00 },
    { id:'Classroom_2',        label:'Classroom 2',           node:2,    floor:1, x:7.65, z:2.00, w:4.30, d:4.00 },
    { id:'Large_Lecture_Hall', label:'Large\nLecture Hall',   node:3,    floor:1, x:2.15, z:7.05, w:4.30, d:6.10 },
    { id:'Lounge_Study',       label:'Lounge /\nStudy Area',  node:null, floor:2, x:1.50, z:2.00, w:3.00, d:4.00 },
    { id:'Computer_Lab',       label:'Computer Lab',          node:5,    floor:2, x:6.65, z:2.00, w:7.30, d:4.00 },
    { id:'Faculty_Office',     label:'Faculty\nOffice',       node:4,    floor:2, x:2.15, z:5.00, w:4.30, d:2.00 },
    { id:'Control_Room',       label:'Control\nRoom',         node:null, floor:2, x:2.15, z:7.00, w:4.30, d:2.00 },
    { id:'Mechanical_Room',    label:'Mechanical\nRoom',      node:6,    floor:2, x:2.15, z:9.00, w:4.30, d:2.00 },
];

// ── Sensor filter (Step 6 — professor feedback) ───────────────────────────────
const ROOM_SENSORS = {
    Classroom_1:        ['motion','lux','temperature','power'],
    Classroom_2:        ['lux','temperature','power'],
    Large_Lecture_Hall: ['occupancy','temperature','co2','power'],
    Lounge_Study:       ['temperature'],
    Computer_Lab:       ['temperature','power'],
    Faculty_Office:     ['motion','temperature','power'],
    Control_Room:       [],
    Mechanical_Room:    ['power'],
    Lobby_Reception:    [],
};

const SENSOR_FILTER_CFG = [
    { id:'all',         label:'All',         color:'#2563eb' },
    { id:'motion',      label:'Motion',      color:'#3b82f6' },
    { id:'temperature', label:'Temperature', color:'#ef4444' },
    { id:'lux',         label:'Lux',         color:'#fbbf24' },
    { id:'co2',         label:'CO\u2082',   color:'#0d9488' },
    { id:'power',       label:'Power',       color:'#8b5cf6' },
    { id:'occupancy',   label:'Occupancy',   color:'#10b981' },
];

// ── Color helpers ─────────────────────────────────────────────────────────────
function getRoomColor(room, sensor, selected, hovered) {
    if (selected) return new THREE.Color('#2563eb');
    if (hovered)  return new THREE.Color('#3b82f6');
    if (sensor?.fire_alert) return new THREE.Color('#ef4444');
    switch (sensor?.status) {
        case 'critical': return new THREE.Color('#dc2626');
        case 'warning':  return new THREE.Color('#d97706');
        default:         return new THREE.Color('#0f766e');
    }
}

// ── Animated components ───────────────────────────────────────────────────────
function PulseRing({ position, color = '#ef4444' }) {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.3;
        ref.current.scale.set(s, s, s);
        ref.current.material.opacity = 0.4 + Math.sin(clock.getElapsedTime() * 4) * 0.3;
    });
    return (
        <mesh ref={ref} position={position}>
            <ringGeometry args={[0.4, 0.55, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
    );
}

function SpinningFan({ position, speed = 1, active = true }) {
    const ref = useRef();
    useFrame((_, delta) => { if (ref.current && active) ref.current.rotation.z += delta * speed * 3; });
    return (
        <group position={position} ref={ref}>
            {[0, 90, 180, 270].map(angle => (
                <mesh key={angle} rotation={[0, 0, (angle * Math.PI) / 180]}>
                    <boxGeometry args={[0.35, 0.08, 0.04]} />
                    <meshStandardMaterial color={active ? '#94a3b8' : '#334155'} metalness={0.6} roughness={0.4} />
                </mesh>
            ))}
            <mesh><cylinderGeometry args={[0.06, 0.06, 0.06, 16]} /><meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} /></mesh>
        </group>
    );
}

function DamperBlade({ position, angle = 0 }) {
    return (
        <mesh position={position} rotation={[(angle * Math.PI) / 180, 0, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.25]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
    );
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function NodeBadge({ position, nodeNum, color }) {
    return (
        <Html position={position} center distanceFactor={8}>
            <div style={{ background:color, color:'#fff', fontSize:'9px', fontWeight:700, fontFamily:'DM Mono, monospace', padding:'2px 5px', borderRadius:'4px', whiteSpace:'nowrap', boxShadow:'0 2px 6px rgba(0,0,0,0.4)', pointerEvents:'none', letterSpacing:'0.5px' }}>
                NODE {nodeNum}
            </div>
        </Html>
    );
}

function SensorOverlay({ position, sensor }) {
    const indicators = [];
    if (sensor?.lights)             indicators.push({ icon:'💡', color:'#fbbf24', label:'Lights ON' });
    if (sensor?.motion)             indicators.push({ icon:'👁', color:'#60a5fa', label:'Motion' });
    if (sensor?.fire_alert)         indicators.push({ icon:'🔥', color:'#ef4444', label:'FIRE ALERT' });
    if (sensor?.faculty_present)    indicators.push({ icon:'👤', color:'#34d399', label:'Faculty In' });
    if (sensor?.pc_power === false) indicators.push({ icon:'🖥', color:'#94a3b8', label:'PCs Off' });
    if (sensor?.fan_speed_pct > 0)  indicators.push({ icon:'🌀', color:'#38bdf8', label:`Fan ${sensor.fan_speed_pct}%` });
    if (!indicators.length) return null;
    return (
        <Html position={position} center distanceFactor={10}>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', pointerEvents:'none' }}>
                {indicators.map((ind, i) => (
                    <div key={i} style={{ background:'rgba(15,23,42,0.85)', border:`1px solid ${ind.color}`, color:ind.color, fontSize:'8px', fontWeight:700, padding:'2px 4px', borderRadius:'3px', whiteSpace:'nowrap', fontFamily:'DM Mono, monospace' }}>
                        {ind.icon} {ind.label}
                    </div>
                ))}
            </div>
        </Html>
    );
}


// ── Room mesh ─────────────────────────────────────────────────────────────────
function RoomMesh({ room, sensor, selected, onSelect, sensorFilter = 'all' }) {
    const meshRef    = useRef();
    const [hovered, setHovered] = useState(false);
    const floorY     = (room.floor - 1) * FLOOR_H;
    const roomY      = floorY + FLOOR_H / 2;
    const isFireAlert = sensor?.fire_alert;
    const isCritical  = sensor?.status === 'critical' || isFireAlert;
    const filterMatch = sensorFilter === 'all' || (ROOM_SENSORS[room.id] ?? []).includes(sensorFilter);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        if (isFireAlert) {
            const flash = Math.sin(clock.getElapsedTime() * 8) > 0;
            meshRef.current.material.color.set(flash ? '#ef4444' : '#7f1d1d');
            meshRef.current.material.emissive.set(flash ? '#ef4444' : '#000');
            meshRef.current.material.emissiveIntensity = flash ? 0.4 : 0;
        } else {
            meshRef.current.material.color.set(getRoomColor(room, sensor, selected, hovered));
            meshRef.current.material.emissive.set(selected ? '#2563eb' : '#000');
            meshRef.current.material.emissiveIntensity = selected ? 0.15 : 0;
        }
    });

    return (
        <group visible={sensorFilter === 'all' || filterMatch}>
            <mesh ref={meshRef} position={[room.x, roomY, room.z]}
                  onClick={e => { e.stopPropagation(); onSelect(room.id); }}
                  onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                  onPointerOut={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}>
                <boxGeometry args={[room.w - WALL_T, FLOOR_H - CEIL_H, room.d - WALL_T]} />
                <meshStandardMaterial color={getRoomColor(room, sensor, selected, hovered)} transparent
                                      opacity={selected ? 0.75 : hovered ? 0.65 : filterMatch ? 0.45 : 0.08}
                                      metalness={0.1} roughness={0.6} side={THREE.DoubleSide} />
            </mesh>

            <mesh position={[room.x, floorY + 0.04, room.z]}>
                <boxGeometry args={[room.w, 0.08, room.d]} />
                <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
            </mesh>

            <mesh position={[room.x, floorY + FLOOR_H - 0.05, room.z]}>
                <boxGeometry args={[room.w - WALL_T * 2, CEIL_H, room.d - WALL_T * 2]} />
                <meshStandardMaterial color={sensor?.lights ? '#fef9c3' : '#1e293b'} emissive={sensor?.lights ? '#fef9c3' : '#000'} emissiveIntensity={sensor?.lights ? 0.6 : 0} />
            </mesh>

            {sensor?.lights && <pointLight position={[room.x, floorY + FLOOR_H - 0.3, room.z]} color="#fff9e6" intensity={0.8} distance={room.w * 1.5} decay={2} />}

            <Text position={[room.x, roomY + 0.2, room.z]} fontSize={0.22} color={selected ? '#ffffff' : '#e2e8f0'} anchorX="center" anchorY="middle" textAlign="center" maxWidth={room.w * 0.85} outlineWidth={0.01} outlineColor="#0f172a">
                {room.label}
            </Text>

            {sensor?.power_w != null && (
                <Text position={[room.x, roomY - 0.4, room.z]} fontSize={0.16} color="#94a3b8" anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor="#0f172a">
                    {sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(1)} kW` : `${sensor.power_w.toFixed(0)} W`}
                </Text>
            )}

            {room.node && <NodeBadge position={[room.x + room.w*0.35, roomY + FLOOR_H*0.42, room.z - room.d*0.35]} nodeNum={room.node} color={isFireAlert ? '#ef4444' : isCritical ? '#dc2626' : '#2563eb'} />}

            <SensorOverlay position={[room.x - room.w*0.3, roomY + FLOOR_H*0.35, room.z + room.d*0.35]} sensor={sensor} />

            {isFireAlert && <PulseRing position={[room.x, floorY + FLOOR_H + 0.1, room.z]} color="#ef4444" />}
            {isCritical && !isFireAlert && <PulseRing position={[room.x, floorY + FLOOR_H + 0.1, room.z]} color="#dc2626" />}

            {room.id === 'Mechanical_Room' && (
                <group position={[room.x, floorY + FLOOR_H * 0.65, room.z]}>
                    <SpinningFan position={[0.6, 0, 0]} speed={sensor?.fan_speed_pct ? sensor.fan_speed_pct/100*3 : 0} active={sensor?.fan_speed_pct > 0} />
                    <DamperBlade position={[-0.3, 0, 0]} angle={sensor?.damper_angle ?? 90} />
                </group>
            )}

            {room.id === 'Large_Lecture_Hall' && sensor?.occupancy != null && (
                <group position={[room.x, floorY + 0.3, room.z + room.d * 0.4]}>
                    <mesh><boxGeometry args={[1.5, 0.15, 0.08]} /><meshStandardMaterial color="#1e293b" /></mesh>
                    <mesh position={[-(0.75 - (sensor.occupancy/(sensor.max_occupancy ?? 100)) * 0.75), 0, 0.01]}>
                        <boxGeometry args={[(sensor.occupancy/(sensor.max_occupancy ?? 100)) * 1.5, 0.13, 0.08]} />
                        <meshStandardMaterial color={sensor.occupancy/(sensor.max_occupancy ?? 100) > 0.8 ? '#ef4444' : sensor.occupancy/(sensor.max_occupancy ?? 100) > 0.5 ? '#f59e0b' : '#10b981'} />
                    </mesh>
                    <Text position={[0, 0.22, 0]} fontSize={0.18} color="#94a3b8" anchorX="center">
                        {sensor.occupancy}/{sensor.max_occupancy ?? 100} occ
                    </Text>
                </group>
            )}

            {room.id === 'Classroom_1' && sensor?.motion && (
                <mesh position={[room.x + 1.0, floorY + FLOOR_H - 0.6, room.z - 1.0]}>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.8} />
                </mesh>
            )}
        </group>
    );
}

// ── Structure ─────────────────────────────────────────────────────────────────
function FloorSlab({ y, w, d, x, z }) {
    return (
        <mesh position={[x, y, z]}><boxGeometry args={[w, 0.12, d]} /><meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.3} /></mesh>
    );
}

function BuildingOutline() {
    const segs = [
        { x:4.9,  y:FLOOR_H/2,   z:2.0,  w:10.3, h:FLOOR_H, d:4.0 },
        { x:2.15, y:FLOOR_H/2,   z:7.05, w:4.3,  h:FLOOR_H, d:6.1 },
        { x:4.9,  y:FLOOR_H*1.5, z:2.0,  w:10.3, h:FLOOR_H, d:4.0 },
        { x:2.15, y:FLOOR_H*1.5, z:7.0,  w:4.3,  h:FLOOR_H, d:6.0 },
    ];
    return (
        <>{segs.map((s, i) => <lineSegments key={i} position={[s.x, s.y, s.z]}><edgesGeometry args={[new THREE.BoxGeometry(s.w, s.h, s.d)]} /><lineBasicMaterial color="#334155" /></lineSegments>)}</>
    );
}

function Ground() {
    return (
        <>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[5.0, -0.01, 5.0]}><planeGeometry args={[22, 22]} /><meshStandardMaterial color="#0b0f1a" roughness={1} /></mesh>
            <gridHelper args={[22, 22, '#1e293b', '#1e293b']} position={[5.0, 0, 5.0]} />
        </>
    );
}

function FloorLabel({ floor }) {
    return <Text position={[-0.5, (floor-1)*FLOOR_H + FLOOR_H/2, 5.0]} fontSize={0.28} color="#475569" anchorX="right" anchorY="middle" rotation={[0, 0.3, 0]}>{`FLOOR ${floor}`}</Text>;
}

function CameraRig() {
    const { camera } = useThree();
    useEffect(() => { camera.position.set(16, 12, 16); camera.lookAt(5, 3, 5); }, []);
    return null;
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ sensorState, selectedRoom, onRoomSelect, sensorFilter }) {
    return (
        <>
            <CameraRig />
            <ambientLight intensity={0.3} color="#e2e8f0" />
            <directionalLight position={[15, 20, 10]} intensity={0.8} color="#ffffff" castShadow />
            <directionalLight position={[-10, 15, -5]} intensity={0.3} color="#93c5fd" />
            <hemisphereLight skyColor="#1e3a5f" groundColor="#0f172a" intensity={0.4} />
            <Ground />
            <FloorSlab y={FLOOR_H} x={4.9}  z={2.0}  w={10.3} d={4.0} />
            <FloorSlab y={FLOOR_H} x={2.15} z={7.05} w={4.3}  d={6.1} />
            <FloorLabel floor={1} />
            <FloorLabel floor={2} />
            <BuildingOutline />
            {ROOMS.map(room => (
                <RoomMesh key={room.id} room={room} sensor={sensorState[room.id]}
                          selected={selectedRoom === room.id} onSelect={onRoomSelect}
                          sensorFilter={sensorFilter} />
            ))}
            <OrbitControls target={[5.0, 3.5, 5.0]} minDistance={5} maxDistance={35}
                           minPolarAngle={0} maxPolarAngle={Math.PI/2.1} enableDamping dampingFactor={0.05} />
        </>
    );
}

// ── UI overlays ───────────────────────────────────────────────────────────────
function SensorPanel({ room, sensor, onClose }) {
    if (!room || !sensor) return null;
    const rows = [
        sensor.power_w != null        && ['Power',       sensor.power_w >= 1000 ? `${(sensor.power_w/1000).toFixed(2)} kW` : `${sensor.power_w.toFixed(0)} W`],
        sensor.occupancy != null      && ['Occupancy',   `${sensor.occupancy}${sensor.max_occupancy ? ' / '+sensor.max_occupancy : ''}`],
        sensor.temperature_c != null  && ['Temperature', `${sensor.temperature_c.toFixed(1)} °C`],
        sensor.co2_ppm != null        && ['CO₂',        `${sensor.co2_ppm} ppm`],
        sensor.lux != null            && ['Lux',         `${sensor.lux} lx`],
        sensor.lights != null         && ['Lights',      sensor.lights ? 'ON' : 'OFF'],
        sensor.lss != null            && ['LSS',         sensor.lss],
        sensor.lcs != null            && ['LCS',         sensor.lcs],
        sensor.hcs != null            && ['HCS',         sensor.hcs],
        sensor.motion != null         && ['Motion',      sensor.motion ? 'Detected' : 'Clear'],
        sensor.fan_speed_pct != null  && ['Fan Speed',   `${sensor.fan_speed_pct}%`],
        sensor.damper_angle != null   && ['Damper',      `${sensor.damper_angle}°`],
        sensor.faculty_present != null&& ['Faculty',     sensor.faculty_present ? 'Present' : 'Away'],
        sensor.pc_power != null       && ['PCs',         sensor.pc_power ? 'ON' : 'OFF'],
    ].filter(Boolean);
    const statusColor = sensor.fire_alert ? '#ef4444' : sensor.status==='critical' ? '#ef4444' : sensor.status==='warning' ? '#f59e0b' : '#10b981';
    return (
        <div className="absolute bottom-4 left-4 z-10 w-64 bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 overflow-hidden" style={{ boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between" style={{ background:'rgba(15,23,42,0.8)' }}>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background:statusColor, boxShadow:`0 0 6px ${statusColor}` }} />
                    <h3 className="text-sm font-bold text-white">{room.label.replace('\n', ' ')}</h3>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            {sensor.fire_alert && <div className="px-4 py-2 bg-red-900/80 flex items-center gap-2 animate-pulse"><Icon name="fire" className="w-4 h-4 text-red-400" /><span className="text-xs font-bold text-red-300 uppercase tracking-widest">FIRE ALERT ACTIVE</span></div>}
            {room.node && <div className="px-4 py-1.5 border-b border-slate-700/40"><span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">IoT Node {room.node}</span></div>}
            <div className="px-4 py-3 space-y-1.5 max-h-60 overflow-y-auto">
                {rows.map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                        <span className="text-[12px] font-bold text-slate-200" style={{ fontFamily:"'DM Mono',monospace" }}>{val}</span>
                    </div>
                ))}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-700/40 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Status</span>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color:statusColor }}>{sensor.fire_alert ? 'FIRE ALERT' : sensor.status}</span>
            </div>
        </div>
    );
}


// ── Sensor threshold table config ────────────────────────────────────────────
const THRESHOLD_DATA = {
    temperature: {
        label: 'Temperature',
        icon:  '🌡',
        node:  'Node 3 (Lecture Hall), Node 1 & 2 (Classrooms)',
        unit:  '°C',
        normal:   { range:'20 – 25°C',      action: null },
        warning:  { range:'> 25°C',          action: 'Check HVAC setpoint, reduce solar gain' },
        critical: { range:'> 27°C',          action: 'Immediate HVAC override, alert occupants' },
        getLive: s => s?.temperature_c != null ? `${s.temperature_c.toFixed(1)}°C` : null,
        getStatus: s => {
            const v = s?.temperature_c;
            if (v == null) return null;
            return v > 27 ? 'critical' : v > 25 ? 'warning' : 'normal';
        },
    },
    co2: {
        label: 'CO₂ Concentration',
        icon:  '💨',
        node:  'Node 3 (Lecture Hall)',
        unit:  'ppm',
        normal:   { range:'< 600 ppm',       action: null },
        warning:  { range:'600 – 1000 ppm',  action: 'Increase ventilation — damper 30°, fan at 40%' },
        critical: { range:'> 1000 ppm',      action: 'Maximum ventilation — damper fully open, fan 100%' },
        getLive: s => s?.co2_ppm != null ? `${s.co2_ppm} ppm` : null,
        getStatus: s => {
            const v = s?.co2_ppm;
            if (v == null) return null;
            return v > 1000 ? 'critical' : v > 600 ? 'warning' : 'normal';
        },
    },
    occupancy: {
        label: 'Occupancy Level',
        icon:  '👥',
        node:  'Node 3 (Lecture Hall)',
        unit:  '%',
        normal:   { range:'0 – 85%',         action: null },
        warning:  { range:'85 – 95%',        action: 'HVAC at max, alert facility manager' },
        critical: { range:'> 95%',           action: 'Capacity exceeded — notify security, restrict entry' },
        getLive: s => s?.occupancy != null ? `${s.occupancy} / ${s.max_occupancy ?? 100} (${Math.round((s.occupancy/(s.max_occupancy??100))*100)}%)` : null,
        getStatus: s => {
            const v = s?.occupancy, m = s?.max_occupancy ?? 100;
            if (v == null) return null;
            return v/m > 0.95 ? 'critical' : v/m > 0.85 ? 'warning' : 'normal';
        },
    },
    motion: {
        label: 'Motion After Hours',
        icon:  '📡',
        node:  'Node 1 (Classroom 1)',
        unit:  '',
        normal:   { range:'No motion after 18:00',       action: null },
        warning:  { range:'Motion, no class scheduled',   action: 'Log unscheduled occupancy, check timetable' },
        critical: { range:'Motion detected after 18:00',  action: 'Security alert — unauthorised access suspected' },
        getLive: s => s?.motion != null ? (s.motion ? 'Detected' : 'Clear') : null,
        getStatus: s => {
            if (!s?.motion) return 'normal';
            return (s.campus_clock >= 1800) ? 'critical' : (!s.css ? 'warning' : 'normal');
        },
    },
    lux: {
        label: 'Ambient Light (Lux)',
        icon:  '☀',
        node:  'Node 2 (Classroom 2)',
        unit:  'lx',
        normal:   { range:'300 – 600 lux (daylight harvesting active)', action: null },
        warning:  { range:'< 300 lux — lights at full brightness',      action: 'Check ambient sensor, verify LED operation' },
        critical: { range:'Lights ON with no class scheduled',           action: 'Auto-off signal sent — CSS = FALSE' },
        getLive: s => s?.lux != null ? `${s.lux} lx` : null,
        getStatus: s => {
            if (s?.lights && !s?.css) return 'critical';
            if (s?.lux != null && s.lux < 300) return 'warning';
            return 'normal';
        },
    },
    power: {
        label: 'Power Consumption',
        icon:  '⚡',
        node:  'All Nodes (INA219 on 12V bus)',
        unit:  'W / kW',
        normal:   { range:'< 1 kW',          action: null },
        warning:  { range:'1 – 5 kW',        action: 'Review active devices in room' },
        critical: { range:'> 5 kW',          action: 'Check for unexpected load, verify INA219 reading' },
        getLive: s => s?.power_w != null ? (s.power_w >= 1000 ? `${(s.power_w/1000).toFixed(2)} kW` : `${s.power_w.toFixed(0)} W`) : null,
        getStatus: s => {
            const v = s?.power_w;
            if (v == null) return null;
            return v > 5000 ? 'critical' : v > 1000 ? 'warning' : 'normal';
        },
    },
};

const STATUS_CFG = {
    normal:   { label:'Normal',   dot:'#10b981', text:'#10b981', bg:'rgba(16,185,129,0.08)',  border:'rgba(16,185,129,0.2)'  },
    warning:  { label:'Warning',  dot:'#f59e0b', text:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)'  },
    critical: { label:'Critical', dot:'#ef4444', text:'#ef4444', bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)'   },
};

// ── Threshold side panel (replaces floating 3D chips) ─────────────────────────
function ThresholdPanel({ sensorFilter, sensorState, onClose }) {
    if (sensorFilter === 'all') return null;
    const t = THRESHOLD_DATA[sensorFilter];
    if (!t) return null;

    // Collect live readings from all rooms that have this sensor
    const roomReadings = Object.entries(sensorState)
        .map(([roomId, sensor]) => {
            const live   = t.getLive(sensor);
            const status = t.getStatus(sensor);
            if (!live || !status) return null;
            const room = roomId.replace(/_/g, ' ');
            return { roomId, room, live, status };
        })
        .filter(Boolean);

    return (
        <div className="absolute top-4 right-4 z-20 w-72 rounded-xl overflow-hidden border border-slate-700"
             style={{ background:'rgba(8,13,20,0.97)', backdropFilter:'blur(12px)', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between"
                 style={{ background:'rgba(15,23,42,0.6)' }}>
                <div className="flex items-center gap-2.5">
                    <span className="text-base">{t.icon}</span>
                    <div>
                        <p className="text-sm font-bold text-white leading-tight">{t.label}</p>
                        <p className="text-[10px] text-blue-400 font-semibold mt-0.5">{t.node}</p>
                    </div>
                </div>
                <button onClick={onClose}
                        className="text-slate-600 hover:text-slate-300 transition-colors ml-2">
                    <Icon name="x" className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Live readings from affected rooms */}
            {roomReadings.length > 0 && (
                <div className="px-4 py-3 border-b border-slate-800 space-y-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Live Readings</p>
                    {roomReadings.map(r => {
                        const sc = STATUS_CFG[r.status];
                        return (
                            <div key={r.roomId} className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 truncate pr-2">{r.room}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[12px] font-bold text-white" style={{ fontFamily:"'DM Mono',monospace" }}>{r.live}</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                          style={{ color:sc.text, background:sc.bg, border:`1px solid ${sc.border}` }}>
                    {sc.label}
                  </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Threshold reference table */}
            <div className="px-4 py-3">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Threshold Reference</p>
                <div className="space-y-2">
                    {['normal','warning','critical'].map(level => {
                        const sc  = STATUS_CFG[level];
                        const th  = t[level];
                        return (
                            <div key={level} className="rounded-lg p-2.5"
                                 style={{ background:sc.bg, border:`1px solid ${sc.border}` }}>
                                {/* Level label */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:sc.dot }} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color:sc.dot }}>
                    {sc.label}
                  </span>
                                </div>
                                {/* Range value */}
                                <p className="text-[12px] font-bold mb-1" style={{ color:sc.text, fontFamily:"'DM Mono',monospace" }}>
                                    {th.range}
                                </p>
                                {/* Action */}
                                {th.action && (
                                    <p className="text-[10px] text-slate-400 leading-tight">{th.action}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Legend() {
    return (
        <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 px-4 py-3" style={{ boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Room Status</p>
            {[['#10b981','Optimal'],['#d97706','Warning'],['#dc2626','Critical'],['#ef4444','Fire Alert'],['#2563eb','Selected']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-2 mb-1.5 last:mb-0">
                    <span className="w-3 h-3 rounded-sm" style={{ background:color, boxShadow:`0 0 4px ${color}80` }} />
                    <span className="text-[11px] font-semibold text-slate-400">{label}</span>
                </div>
            ))}
        </div>
    );
}

function ControlsBar({ activeFloor, onFloorChange, onResetCamera, sensorFilter, onSensorFilter }) {
    return (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <div className="bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 p-1 flex gap-1">
                {['All','1','2'].map(f => (
                    <button key={f} onClick={() => onFloorChange(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFloor===f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                        {f === 'All' ? 'Both Floors' : `Floor ${f}`}
                    </button>
                ))}
            </div>
            <button onClick={onResetCamera}
                    className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5">
                <Icon name="map" className="w-3.5 h-3.5" /> Reset View
            </button>
            <div className="bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 p-1.5 flex flex-col gap-0.5">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1 pb-1">
                    Show Only
                </p>
                {SENSOR_FILTER_CFG.map(cfg => {
                    const isActive = sensorFilter === cfg.id;
                    return (
                        <button key={cfg.id} onClick={() => onSensorFilter(isActive && cfg.id !== 'all' ? 'all' : cfg.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all text-left"
                                style={isActive
                                    ? { background:`${cfg.color}28`, borderLeft:`2px solid ${cfg.color}`, color:cfg.color, boxShadow:`inset 0 0 8px ${cfg.color}11` }
                                    : { color:'#4b5563', borderLeft:'2px solid transparent' }}>
                            {/* Active indicator */}
                            <span className="w-2 h-2 rounded-full shrink-0 flex items-center justify-center" style={{ background: isActive ? cfg.color : '#1e293b', border:`1.5px solid ${isActive ? cfg.color : '#334155'}`, boxShadow: isActive ? `0 0 5px ${cfg.color}` : 'none' }} />
                            <span style={{ flex:1 }}>{cfg.label}</span>
                            {/* Checkmark when active */}
                            {isActive && cfg.id !== 'all' && (
                                <span style={{ fontSize:'9px', color:cfg.color, fontWeight:900 }}>✓</span>
                            )}
                        </button>
                    );
                })}
                {sensorFilter !== 'all' && (
                    <button onClick={() => onSensorFilter('all')}
                            className="mt-1 text-[9px] font-bold text-slate-600 hover:text-slate-300 uppercase tracking-widest text-center py-1 transition-colors border-t border-slate-800">
                        Clear filter
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function BuildingTwin3D({
                                           sensorState = MOCK_SENSOR_STATE,
                                           selectedRoom = null,
                                           onRoomSelect = () => {},
                                           height = '520px',
                                           compact = false,
                                       }) {
    const [localSelected, setLocalSelected] = useState(selectedRoom);
    const [activeFloor,   setActiveFloor]   = useState('All');
    const [sensorFilter,  setSensorFilter]  = useState('all');
    const controlsRef = useRef();

    useEffect(() => { setLocalSelected(selectedRoom); }, [selectedRoom]);

    function handleRoomSelect(id) { setLocalSelected(id); onRoomSelect(id); }
    function handleFloorChange(f) { setActiveFloor(f); setLocalSelected(null); onRoomSelect(null); }
    function resetCamera() { if (controlsRef.current) controlsRef.current.reset(); }

    const selectedRoomData = ROOMS.find(r => r.id === localSelected);
    const activeSensorCfg  = SENSOR_FILTER_CFG.find(c => c.id === sensorFilter);

    return (
        <div className="relative w-full rounded-xl overflow-hidden border border-slate-700"
             style={{ height, background:'#0b0f1a' }}>

            <Canvas frameloop="demand" shadows dpr={[1, 1.5]}
                    gl={{ antialias:true, alpha:false, powerPreference:'high-performance' }}>
                <Suspense fallback={null}>
                    <Scene sensorState={sensorState} selectedRoom={localSelected}
                           onRoomSelect={handleRoomSelect} sensorFilter={sensorFilter} />
                </Suspense>
            </Canvas>

            <ControlsBar activeFloor={activeFloor} onFloorChange={handleFloorChange}
                         onResetCamera={resetCamera} sensorFilter={sensorFilter} onSensorFilter={setSensorFilter} />
            {/* Legend only when no filter active */}
            {!compact && sensorFilter === 'all' && <Legend />}

            {/* Threshold side panel — replaces legend when filter active */}
            {sensorFilter !== 'all' && (
                <ThresholdPanel
                    sensorFilter={sensorFilter}
                    sensorState={sensorState}
                    onClose={() => setSensorFilter('all')}
                />
            )}

            {/* Room sensor detail — bottom left */}
            {localSelected && (
                <SensorPanel room={selectedRoomData} sensor={sensorState[localSelected]}
                             onClose={() => { setLocalSelected(null); onRoomSelect(null); }} />
            )}

            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Phase 3 · Firebase
            </div>
        </div>
    );
}