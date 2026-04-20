/**
 * OntologyGraph.jsx — Step 5
 * ─────────────────────────────────────────────────────────────────────────────
 * D3 force-directed ontology graph showing relationships between:
 *   Sensors → IoT Nodes → Rooms → Digital Twin → AI Layer → Control Outputs
 *
 * Scoped to 3 MVP nodes:
 *   Node 1 → Classroom 1    (PIR + Lux + Temp)
 *   Node 2 → Classroom 2    (Ambient Lux + Temp)
 *   Node 3 → Lecture Hall   (Temp + CO₂ + Occupancy + HVAC servo)
 *
 * Clicking a node highlights it and shows a detail panel.
 * Professor feedback: makes sensor→DT→AI relationships explicit and explorable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Icon from '../components/panels/Icon';
import { useLiveSensorState } from '../services/sensorState';

// ── Graph data — scoped to 3 MVP nodes ───────────────────────────────────────
const NODES = [
    // ── Sensors ─────────────────────────────────────────────────────────────────
    { id:'pir_cr1',   label:'PIR Sensor',       group:'sensor', type:'motion',      room:'Classroom_1',        icon:'motion',      desc:'Detects motion via passive infrared. Triggers light activation in Node 1.' },
    { id:'lux_cr1',   label:'Lux Sensor',       group:'sensor', type:'lux',         room:'Classroom_1',        icon:'lighting',    desc:'Measures ambient light level. Used alongside PIR to decide lighting state.' },
    { id:'temp_cr1',  label:'Temp Sensor',       group:'sensor', type:'temperature', room:'Classroom_1',        icon:'temperature', desc:'DHT22 — room temperature reading every 30 seconds.' },
    { id:'ina_cr1',   label:'INA219 (N1)',       group:'sensor', type:'power',       room:'Classroom_1',        icon:'zap',         desc:'Power monitor on 12V bus — measures Wh consumed by Node 1 circuit.' },

    { id:'lux_cr2',   label:'Ambient Lux',       group:'sensor', type:'lux',         room:'Classroom_2',        icon:'lighting',    desc:'Ambient light sensor — daylight harvesting. Dims/cuts lights based on lux threshold.' },
    { id:'temp_cr2',  label:'Temp Sensor',       group:'sensor', type:'temperature', room:'Classroom_2',        icon:'temperature', desc:'DHT22 — room temperature reading every 30 seconds.' },
    { id:'ina_cr2',   label:'INA219 (N2)',       group:'sensor', type:'power',       room:'Classroom_2',        icon:'zap',         desc:'Power monitor on 12V bus — measures Wh consumed by Node 2 circuit.' },

    { id:'occ_lh',    label:'Occupancy Counter', group:'sensor', type:'occupancy',   room:'Large_Lecture_Hall', icon:'occupancy',   desc:'People counter (potentiometer sim). Primary input to AI occupancy classifier.' },
    { id:'temp_lh',   label:'Temp Sensor',       group:'sensor', type:'temperature', room:'Large_Lecture_Hall', icon:'temperature', desc:'Internal temperature sensor. External sensor placed outside for comparison.' },
    { id:'co2_lh',    label:'CO₂ Sensor',        group:'sensor', type:'co2',         room:'Large_Lecture_Hall', icon:'co2',         desc:'Air quality sensor. CO₂ > 1000 ppm triggers maximum ventilation via HVAC.' },
    { id:'ina_lh',    label:'INA219 (N3)',       group:'sensor', type:'power',       room:'Large_Lecture_Hall', icon:'zap',         desc:'Power monitor on 12V bus — measures Wh consumed by Node 3 + AHU.' },

    // ── IoT Nodes ────────────────────────────────────────────────────────────────
    { id:'node1', label:'Node 1\nClassroom 1',    group:'node', icon:'cpu', desc:'Arduino Uno. Controls motion-activated LED lighting. Signals: LOS, LCS, CSS (in) · LSS, motion, power_w (out).' },
    { id:'node2', label:'Node 2\nClassroom 2',    group:'node', icon:'cpu', desc:'Arduino Uno. Controls ambient lux-based dimmable lighting. Signals: LOS, LCS, CSS (in) · LSS, ambient_dark, power_w (out).' },
    { id:'node3', label:'Node 3\nLecture Hall',   group:'node', icon:'cpu', desc:'Arduino Uno. Controls HVAC servo damper + fan. Signals: LOS, LCS, HCS, occupancy (in) · LSS, occ, damper_angle, fan_speed_pct, temp, power_w (out).' },

    // ── Raspberry Pi ──────────────────────────────────────────────────────────────
    { id:'rpi',   label:'Raspberry Pi\nGateway',  group:'gateway', icon:'settings', desc:'Edge gateway. Collects all 3 node packets via serial, writes /telemetry to Firebase. Reads /signals and forwards control commands to nodes.' },

    // ── Digital Twin ─────────────────────────────────────────────────────────────
    { id:'dt',    label:'Digital Twin\n(Dashboard)', group:'twin', icon:'layers', desc:'React + Three.js dashboard. Subscribes to /telemetry via Firebase onValue(). Computes KPIs, alerts, and derives AI predictions.' },

    // ── Firebase ──────────────────────────────────────────────────────────────────
    { id:'firebase', label:'Firebase\nRealtime DB', group:'cloud', icon:'database', desc:'Cloud database. Paths: /telemetry/{roomId} · /signals/{roomId} · /campus_clock · /alerts' },

    // ── AI Layer ─────────────────────────────────────────────────────────────────
    { id:'ai_occ',   label:'AI Occupancy\nClassifier', group:'ai', icon:'activity', desc:'Random Forest classifier (training on 800K synthetic rows). Output: 0=Unoccupied, 1=Scheduled, 2=Unscheduled.' },
    { id:'ai_energy',label:'AI Energy\nOptimiser',     group:'ai', icon:'zap',      desc:'Maps occupancy class + time-of-day to energy mode: Active / Standby / Off.' },
    { id:'ai_light', label:'AI Lighting\nPredictor',   group:'ai', icon:'lighting', desc:'Predicts optimal lighting state from motion, lux, schedule, and LCS mode.' },

    // ── Control Outputs ───────────────────────────────────────────────────────────
    { id:'hvac_ctrl', label:'HVAC Control\n(Damper + Fan)', group:'output', icon:'hvac',     desc:'Servo damper (0–90°) + 12V DC fan (0/40/100%) — controlled by AI occupancy classification.' },
    { id:'led_ctrl',  label:'LED Lighting\nControl',        group:'output', icon:'lighting', desc:'LED modules in CR1 and CR2 — controlled by PIR/lux + AI lighting predictor.' },
];

const LINKS = [
    // Sensors → Nodes
    { source:'pir_cr1',  target:'node1', label:'motion' },
    { source:'lux_cr1',  target:'node1', label:'lux' },
    { source:'temp_cr1', target:'node1', label:'temp_c' },
    { source:'ina_cr1',  target:'node1', label:'power_w' },
    { source:'lux_cr2',  target:'node2', label:'ambient_lux' },
    { source:'temp_cr2', target:'node2', label:'temp_c' },
    { source:'ina_cr2',  target:'node2', label:'power_w' },
    { source:'occ_lh',   target:'node3', label:'occupancy' },
    { source:'temp_lh',  target:'node3', label:'temp_c' },
    { source:'co2_lh',   target:'node3', label:'co2_ppm' },
    { source:'ina_lh',   target:'node3', label:'power_w' },
    // Nodes → Raspberry Pi
    { source:'node1', target:'rpi', label:'serial' },
    { source:'node2', target:'rpi', label:'serial' },
    { source:'node3', target:'rpi', label:'serial' },
    // Pi → Firebase
    { source:'rpi', target:'firebase', label:'/telemetry' },
    // Firebase → DT
    { source:'firebase', target:'dt', label:'onValue()' },
    // DT → Firebase (signals)
    { source:'dt', target:'firebase', label:'/signals' },
    // Firebase → Pi (read signals)
    { source:'firebase', target:'rpi', label:'read signals' },
    // Pi → Nodes (control)
    { source:'rpi', target:'node1', label:'LOS/LCS/CSS' },
    { source:'rpi', target:'node2', label:'LOS/LCS/CSS' },
    { source:'rpi', target:'node3', label:'HCS/occ' },
    // DT → AI
    { source:'dt', target:'ai_occ',    label:'temp,co2,motion,lux,hour' },
    { source:'dt', target:'ai_light',  label:'motion,lux,css,lcs' },
    // AI → DT (predictions)
    { source:'ai_occ',    target:'ai_energy', label:'occ_class' },
    { source:'ai_occ',    target:'dt',        label:'prediction' },
    { source:'ai_energy', target:'dt',        label:'energy_mode' },
    { source:'ai_light',  target:'dt',        label:'light_state' },
    // DT → Outputs (via signals)
    { source:'ai_energy', target:'hvac_ctrl', label:'damper/fan' },
    { source:'ai_light',  target:'led_ctrl',  label:'on/off/dim' },
];

// ── Visual config per group ───────────────────────────────────────────────────
const GROUP_STYLE = {
    // Brighter fills + white text for readability on dark canvas
    sensor:  { fill:'#1d4ed8', stroke:'#60a5fa', textColor:'#ffffff', r:22 },
    node:    { fill:'#047857', stroke:'#34d399', textColor:'#ffffff', r:28 },
    gateway: { fill:'#b45309', stroke:'#fbbf24', textColor:'#ffffff', r:24 },
    cloud:   { fill:'#4338ca', stroke:'#a5b4fc', textColor:'#ffffff', r:24 },
    twin:    { fill:'#1e40af', stroke:'#93c5fd', textColor:'#ffffff', r:30 },
    ai:      { fill:'#6d28d9', stroke:'#c4b5fd', textColor:'#ffffff', r:26 },
    output:  { fill:'#166534', stroke:'#4ade80', textColor:'#ffffff', r:22 },
};

const GROUP_LABEL = {
    sensor:'Sensor',gateway:'Edge',cloud:'Cloud',twin:'Digital Twin',ai:'AI Layer',node:'IoT Node',output:'Output',
};

function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

export default function OntologyGraph() {
    const svgRef      = useRef();
    const wrapRef     = useRef();
    const simRef      = useRef();
    const [selected,  setSelected]  = useState(null);
    const [dims,      setDims]      = useState({ w:800, h:520 });
    const [filter,    setFilter]    = useState('all');
    const { sensorState, isLive }   = useLiveSensorState();

    // Resize observer
    useEffect(() => {
        const obs = new ResizeObserver(e => {
            const { width } = e[0].contentRect;
            setDims({ w: width, h: Math.max(420, width * 0.62) });
        });
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    // Build graph
    useEffect(() => {
        const { w, h } = dims;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const filtered = filter === 'all'
            ? NODES
            : NODES.filter(n => n.group === filter || n.group === 'twin');

        const filteredIds = new Set(filtered.map(n => n.id));
        const filteredLinks = LINKS.filter(l =>
            filteredIds.has(l.source) && filteredIds.has(l.target)
        );

        const nodesCopy = filtered.map(n => ({ ...n }));
        const linksCopy = filteredLinks.map(l => ({ ...l }));

        svg.attr('width', w).attr('height', h)
            .style('background', '#0f172a')
            .style('border-radius', '12px');

        // Defs — arrow markers
        const defs = svg.append('defs');
        ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#818cf8','#16a34a'].forEach((color, i) => {
            defs.append('marker')
                .attr('id', `arrow${i}`)
                .attr('viewBox','0 -5 10 10').attr('refX',24).attr('refY',0)
                .attr('markerWidth',5).attr('markerHeight',5).attr('orient','auto')
                .append('path').attr('d','M0,-5L10,0L0,5').attr('fill', color).attr('opacity', 0.7);
        });

        const sim = d3.forceSimulation(nodesCopy)
            .force('link', d3.forceLink(linksCopy).id(d => d.id).distance(d => {
                // Space nodes appropriately by group
                const sg = NODES.find(n => n.id === (d.source.id ?? d.source))?.group;
                const tg = NODES.find(n => n.id === (d.target.id ?? d.target))?.group;
                if (sg === 'sensor' && tg === 'node') return 90;
                if (sg === 'node' && tg === 'gateway') return 100;
                if (sg === 'gateway' && tg === 'cloud') return 90;
                return 120;
            }).strength(0.6))
            .force('charge', d3.forceManyBody().strength(-320))
            .force('center', d3.forceCenter(w / 2, h / 2))
            .force('collision', d3.forceCollide(50))
            .force('x', d3.forceX(w / 2).strength(0.03))
            .force('y', d3.forceY(h / 2).strength(0.03));

        simRef.current = sim;

        // Grid dots background
        const gridG = svg.append('g').attr('opacity', 0.07);
        for (let x = 0; x < w; x += 28)
            for (let y = 0; y < h; y += 28)
                gridG.append('circle').attr('cx', x).attr('cy', y).attr('r', 0.8).attr('fill', '#475569');

        // Links
        const linkG = svg.append('g');
        const link = linkG.selectAll('line')
            .data(linksCopy).enter().append('line')
            .attr('stroke', '#334155')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.8)
            .attr('marker-end', 'url(#arrow0)');

        // Link labels
        const linkLabel = svg.append('g')
            .selectAll('text').data(linksCopy).enter().append('text')
            .attr('font-size', 8).attr('fill', '#64748b')
            .attr('font-family', "'DM Mono', monospace")
            .attr('text-anchor', 'middle').attr('pointer-events', 'none')
            .text(d => d.label);

        // Node groups
        const nodeG = svg.append('g');
        const node = nodeG.selectAll('g')
            .data(nodesCopy).enter().append('g')
            .attr('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
                .on('drag',  (e, d) => { d.fx=e.x; d.fy=e.y; })
                .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
            )
            .on('click', (e, d) => { e.stopPropagation(); setSelected(s => s?.id===d.id ? null : d); });

        // Glow filter
        const glowFilter = defs.append('filter').attr('id','glow');
        glowFilter.append('feGaussianBlur').attr('stdDeviation','3').attr('result','coloredBlur');
        const feMerge = glowFilter.append('feMerge');
        feMerge.append('feMergeNode').attr('in','coloredBlur');
        feMerge.append('feMergeNode').attr('in','SourceGraphic');

        // Node circles
        node.append('circle')
            .attr('r', d => GROUP_STYLE[d.group]?.r ?? 22)
            .attr('fill', d => GROUP_STYLE[d.group]?.fill ?? '#1e293b')
            .attr('stroke', d => GROUP_STYLE[d.group]?.stroke ?? '#64748b')
            .attr('stroke-width', 1.8)
            .attr('filter', 'url(#glow)');

        // Node labels (multi-line)
        node.each(function(d) {
            const style = GROUP_STYLE[d.group];
            const lines = d.label.split('\n');
            const g = d3.select(this);
            lines.forEach((line, i) => {
                g.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('y', (i - (lines.length - 1) / 2) * 11)
                    .attr('font-size', lines.length > 1 ? 8 : 9)
                    .attr('font-weight', '700')
                    .attr('font-family', "'DM Sans', sans-serif")
                    .attr('fill', style?.textColor ?? '#94a3b8')
                    .attr('pointer-events', 'none')
                    .text(line);
            });
        });

        // Hover highlight
        node.on('mouseover', function(e, d) {
            const style = GROUP_STYLE[d.group];
            d3.select(this).select('circle')
                .attr('stroke-width', 3)
                .attr('r', (style?.r ?? 22) + 3);
            // Highlight connected links
            link.attr('stroke-opacity', l =>
                (l.source.id===d.id||l.target.id===d.id) ? 1 : 0.12
            ).attr('stroke', l =>
                l.source.id===d.id ? '#10b981' : l.target.id===d.id ? '#3b82f6' : '#1e3a5f'
            );
        })
            .on('mouseout', function(e, d) {
                const style = GROUP_STYLE[d.group];
                d3.select(this).select('circle')
                    .attr('stroke-width', 1.8)
                    .attr('r', style?.r ?? 22);
                link.attr('stroke-opacity', 0.5).attr('stroke', '#1e3a5f');
            });

        // Click on background deselects
        svg.on('click', () => setSelected(null));

        sim.on('tick', () => {
            link
                .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            linkLabel
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2 - 5);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        return () => { sim.stop(); };
    }, [dims, filter]);

    const groups = ['all','sensor','node','gateway','cloud','ai','output'];
    const groupLabels = { all:'All', sensor:'Sensors', node:'IoT Nodes', gateway:'Edge/Pi', cloud:'Firebase', ai:'AI Layer', output:'Outputs' };

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-bold text-slate-900">Ontology Graph</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Sensor → Node → Digital Twin → AI relationships · 3 MVP nodes · drag nodes · click for details
                    </p>
                </div>
                {isLive && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Firebase Data
          </span>
                )}
            </div>

            {/* Filter tabs */}
            <Card className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter</span>
                    {groups.map(g => (
                        <button key={g} onClick={() => setFilter(g)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${filter===g
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {groupLabels[g]}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Main graph + detail panel */}
            <div className="grid grid-cols-12 gap-5">

                {/* Graph */}
                <div className={`${selected ? 'col-span-12 lg:col-span-8' : 'col-span-12'}`}>
                    <Card className="overflow-hidden">
                        <div ref={wrapRef} className="w-full">
                            <svg ref={svgRef} className="w-full" style={{ display:'block' }} />
                        </div>
                    </Card>
                </div>

                {/* Detail panel */}
                {selected && (
                    <div className="col-span-12 lg:col-span-4">
                        <Card className="h-full flex flex-col overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                         style={{ background: GROUP_STYLE[selected.group]?.fill ?? '#1e293b', border:`1.5px solid ${GROUP_STYLE[selected.group]?.stroke ?? '#64748b'}` }}>
                                        <Icon name={selected.icon ?? 'settings'} className="w-4 h-4" style={{ color: GROUP_STYLE[selected.group]?.textColor }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{selected.label.replace('\n',' ')}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest"
                                           style={{ color: GROUP_STYLE[selected.group]?.stroke ?? '#64748b' }}>
                                            {GROUP_LABEL[selected.group]}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                    <Icon name="x" className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="p-5 flex-1 space-y-4 overflow-y-auto">
                                {/* Description */}
                                <p className="text-sm text-slate-600 leading-relaxed">{selected.desc}</p>

                                {/* Live sensor reading if applicable */}
                                {selected.room && sensorState?.[selected.room] && (() => {
                                    const s = sensorState[selected.room];
                                    const readings = [
                                        selected.type==='temperature' && s.temperature_c != null && { label:'Temperature', value:`${s.temperature_c.toFixed(1)}°C`, color: s.temperature_c>25?'text-red-600':s.temperature_c<22?'text-blue-600':'text-emerald-600' },
                                        selected.type==='co2'         && s.co2_ppm != null         && { label:'CO₂',       value:`${s.co2_ppm} ppm`,              color: s.co2_ppm>1000?'text-red-600':s.co2_ppm>600?'text-amber-500':'text-emerald-600' },
                                        selected.type==='power'       && s.power_w != null          && { label:'Power',     value: s.power_w>=1000?`${(s.power_w/1000).toFixed(2)} kW`:`${s.power_w.toFixed(0)} W`, color:'text-slate-800' },
                                        selected.type==='motion'      && s.motion != null            && { label:'Motion',   value: s.motion?'Detected':'Clear',    color: s.motion?'text-blue-600':'text-slate-400' },
                                        selected.type==='lux'         && s.lux != null               && { label:'Lux',      value:`${s.lux} lx`,                   color: s.lux<300?'text-amber-600':s.lux>600?'text-emerald-600':'text-slate-700' },
                                        selected.type==='occupancy'   && s.occupancy != null         && { label:'Occupancy',value:`${s.occupancy} / ${s.max_occupancy}`, color: s.occupancy/s.max_occupancy>0.85?'text-red-600':'text-emerald-600' },
                                    ].filter(Boolean);
                                    if (!readings.length) return null;
                                    return (
                                        <div className="bg-slate-900 rounded-xl p-4">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Live Reading
                                            </p>
                                            {readings.map(r => (
                                                <div key={r.label} className="flex justify-between items-center mb-1.5">
                                                    <span className="text-[11px] text-slate-400">{r.label}</span>
                                                    <span className={`text-sm font-bold ${r.color}`} style={{ fontFamily:"'DM Mono',monospace" }}>{r.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Connections */}
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Connections</p>
                                    <div className="space-y-1.5">
                                        {LINKS.filter(l => l.source===selected.id || l.target===selected.id).map((l,i) => {
                                            const isOut = l.source === selected.id;
                                            const otherId = isOut ? l.target : l.source;
                                            const other = NODES.find(n => n.id === otherId);
                                            return (
                                                <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isOut?'bg-blue-950 text-blue-400':'bg-slate-800 text-slate-400'}`}>
                            {isOut?'OUT':'IN'}
                          </span>
                                                    <span className="text-slate-500">{l.label}</span>
                                                    <span className="text-slate-300 font-semibold ml-auto truncate">{other?.label.replace('\n',' ')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Legend */}
            <Card className="p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Node Types</p>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(GROUP_STYLE).map(([group, style]) => (
                        <div key={group} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background:style.fill, border:`1.5px solid ${style.stroke}` }} />
                            <span className="text-[11px] font-semibold text-slate-500">{GROUP_LABEL[group]}</span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}