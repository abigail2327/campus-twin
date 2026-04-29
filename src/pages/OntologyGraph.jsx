/**
 * OntologyGraph.jsx — Immersive Live Monitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Dark canvas D3 force graph.
 * Features:
 *   - Glowing nodes with colour per group, no filter tabs
 *   - Animated data-flow pulses on Firebase update
 *   - AI classifier labels shown inline on node
 *   - Focus+context: click fades non-neighbours to 12% opacity
 *   - Side panel on click with live readings + AI output
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Icon from '../components/panels/Icon';
import { useLiveSensorState, useAIPredictions } from '../services/sensorState';

// ── Graph data ────────────────────────────────────────────────────────────────
const NODES = [
    // Sensors — exactly as deployed
    { id:'pir_cr1',  label:'PIR Sensor',    sublabel:'Classroom A',  group:'sensor',  type:'motion',      room:'Classroom_1',        icon:'motion',    desc:'HC-SR501 passive infrared. Binary occupancy: 1=motion detected, 0=clear. Triggers LED lighting. Also cross-referenced with INA219 for energy theft anomaly detection.' },
    { id:'ldr_cr2',  label:'LDR Sensor',    sublabel:'Classroom B',  group:'sensor',  type:'lux',         room:'Classroom_2',        icon:'lighting',  desc:'Light Dependent Resistor. Measures ambient brightness. AI model uses lux + time-of-day + schedule to issue dimming commands — not a simple threshold.' },
    { id:'pir_lh',   label:'PIR Sensor',    sublabel:'Lecture Hall', group:'sensor',  type:'motion',      room:'Large_Lecture_Hall', icon:'motion',    desc:'HC-SR501 in the lecture hall. Provides binary occupancy state for HVAC and lighting control decisions.' },
    { id:'dht_lh',   label:'DHT Temp',      sublabel:'Lecture Hall', group:'sensor',  type:'temperature', room:'Large_Lecture_Hall', icon:'temperature', desc:'DHT-compatible temperature sensor. Indoor + outdoor probe pair. Outdoor probe captures UAE ambient (40–48°C summer) for HVAC load calculation.' },
    { id:'pot_lh',   label:'Potentiometer', sublabel:'Fire Sim',     group:'sensor',  type:'fire',        room:'Large_Lecture_Hall', icon:'alerts',    desc:'Simulates a fire emergency. Turning the dial creates an instantaneous temperature spike — the AI distinguishes this from a gradual hot-day rise to trigger a fire alert.' },
    { id:'fan_lh',   label:'Fan / HVAC',    sublabel:'Lecture Hall', group:'output',  type:'hvac',        room:'Large_Lecture_Hall', icon:'hvac',      desc:'12V DC fan representing the HVAC system. Activated and modulated by AI occupancy + temperature predictions.' },
    { id:'ina_campus',label:'INA219',       sublabel:'Campus Power', group:'sensor',  type:'power',       room:'Mechanical_Room',    icon:'zap',       desc:'Single INA219 power monitor for the entire building. Measures total campus energy consumption. One node for all three rooms — not per room.' },
    // IoT Nodes
    { id:'node1',    label:'Node 1',        sublabel:'Classroom 1',  group:'node',    icon:'cpu',  desc:'Arduino MKR WAN 1310. PIR-based occupancy and LED lighting control. Sends: motion (0/1). Receives: lighting commands. Anomaly: power draw with zero motion = energy theft flag.' },
    { id:'node2',    label:'Node 2',        sublabel:'Classroom 2',  group:'node',    icon:'cpu',  desc:'Arduino MKR WAN 1310. LDR adaptive lighting — AI model decides dim level from lux + schedule + time-of-day. Sends: lux reading. Receives: dimming command.' },
    { id:'node3',    label:'Node 3',        sublabel:'Lecture Hall', group:'node',    icon:'cpu',  desc:'Arduino MKR WAN 1310. Most complex node — PIR + DHT temp (indoor + outdoor) + potentiometer fire sim + fan HVAC. Sends: motion, temp_indoor, temp_outdoor, pot_value. Receives: fan_speed command.' },
    // Gateway
    { id:'ttn',      label:'TTN',           sublabel:'LoRa Network', group:'gateway', icon:'wifi',     desc:'The Things Network. Receives LoRa packets from all three nodes. Bridges to MQTT on Mosquitto.' },
    { id:'rpi',      label:'Raspberry Pi',  sublabel:'Edge Gateway', group:'gateway', icon:'settings', desc:'Edge gateway. Bridges MQTT to Firebase /telemetry. Reads /signals and forwards control to nodes.' },
    // Cloud
    { id:'firebase', label:'Firebase',      sublabel:'Realtime DB',  group:'cloud',   icon:'database', desc:'Paths: /telemetry/{roomId} · /signals/{roomId} · /campus_clock · /alerts · /predictions' },
    // Digital Twin
    { id:'dt',       label:'SmartTwin',     sublabel:'Dashboard',    group:'twin',    icon:'layers',   desc:'React + Three.js dashboard. Subscribes to Firebase onValue(). Renders 3D model, KPIs, AI predictions.' },
    // AI
    { id:'ai_occ',   label:'Occupancy AI',  sublabel:'Classifier',   group:'ai',      icon:'activity', desc:'Random Forest. 384K rows, 74 features, 99.38% accuracy. Classes: 0=empty, 1=scheduled, 2=unscheduled. UC-B recall: 96.4%.' },
    { id:'ai_energy',label:'Energy AI',     sublabel:'Optimiser',    group:'ai',      icon:'zap',      desc:'Maps occupancy class + time to energy mode: auto / eco / standby / off. 99.39% accuracy.' },
    { id:'ai_light', label:'Lighting AI',   sublabel:'Predictor',    group:'ai',      icon:'lighting', desc:'Predicts lighting state from motion, lux, schedule, LCS. 99.6% accuracy on Spring 2027 test set.' },
    // Outputs
    { id:'led_ctrl', label:'LED Lighting',  sublabel:'CR1 + CR2',    group:'output',  icon:'lighting', desc:'LED modules in Classroom 1 and 2. Controlled by PIR/lux sensor + AI lighting predictor.' },
];

const LINKS = [
    { source:'pir_cr1',   target:'node1',    label:'motion'        },
    { source:'ldr_cr2',   target:'node2',    label:'lux'           },
    { source:'pir_lh',    target:'node3',    label:'motion'        },
    { source:'dht_lh',    target:'node3',    label:'temp_in/out'   },
    { source:'pot_lh',    target:'node3',    label:'fire_sim'      },
    { source:'ina_campus',target:'rpi',      label:'total_power_w' },
    { source:'node1',   target:'ttn',      label:'LoRa'         },
    { source:'node2',   target:'ttn',      label:'LoRa'         },
    { source:'node3',   target:'ttn',      label:'LoRa'         },
    { source:'ttn',     target:'rpi',      label:'MQTT'         },
    { source:'rpi',     target:'firebase', label:'/telemetry'   },
    { source:'firebase',target:'dt',       label:'onValue()'    },
    { source:'dt',      target:'firebase', label:'/signals'     },
    { source:'firebase',target:'rpi',      label:'read signals' },
    { source:'rpi',     target:'node1',    label:'LOS/LCS'      },
    { source:'rpi',     target:'node2',    label:'LOS/LCS'      },
    { source:'rpi',     target:'node3',    label:'HCS/occ'      },
    { source:'dt',      target:'ai_occ',   label:'sensors+time' },
    { source:'dt',      target:'ai_light', label:'motion,lux'   },
    { source:'ai_occ',  target:'ai_energy',label:'occ_class'    },
    { source:'ai_occ',  target:'dt',       label:'prediction'   },
    { source:'ai_energy',target:'dt',      label:'energy_mode'  },
    { source:'ai_light',target:'dt',       label:'light_state'  },
    { source:'ai_energy',target:'fan_lh',   label:'fan_speed'   },
    { source:'ai_light',target:'led_ctrl', label:'on/off/dim'   },
];

// Group visual config — fills and strokes designed for dark background
const G = {
    sensor:  { fill:'#0f2a5e', stroke:'#3b82f6', text:'#93c5fd', r:20 },
    node:    { fill:'#052e1c', stroke:'#10b981', text:'#6ee7b7', r:26 },
    gateway: { fill:'#2d1a00', stroke:'#f59e0b', text:'#fcd34d', r:22 },
    cloud:   { fill:'#1e1052', stroke:'#8b5cf6', text:'#c4b5fd', r:24 },
    twin:    { fill:'#0a1f4e', stroke:'#60a5fa', text:'#bfdbfe', r:28 },
    ai:      { fill:'#2e0d6e', stroke:'#a78bfa', text:'#ddd6fe', r:24 },
    output:  { fill:'#063318', stroke:'#22c55e', text:'#86efac', r:20 },
};
const GROUP_LABEL = {
    sensor:'Sensor', node:'IoT Node', gateway:'Edge', cloud:'Cloud DB',
    twin:'Digital Twin', ai:'AI Layer', output:'Output',
};

export default function OntologyGraph() {
    const svgRef      = useRef();
    const wrapRef     = useRef();
    const simRef      = useRef();
    const nodeDataRef = useRef([]);
    const selectedRef = useRef(null);
    const prevSigRef  = useRef(null);

    const [selected,  setSelected]  = useState(null);
    const [focusedId, setFocusedId] = useState(null);
    const [dims,      setDims]      = useState({ w:900, h:560 });

    const { sensorState, isLive }  = useLiveSensorState();
    const { predictions, aiLive }  = useAIPredictions();
    const lhPred = predictions?.Large_Lecture_Hall ?? predictions?.['lecture-hall'];

    // ── Resize ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const obs = new ResizeObserver(e => {
            const w = e[0].contentRect.width;
            setDims({ w, h: Math.max(480, w * 0.62) });
        });
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    // ── Pulse animation ───────────────────────────────────────────────────────
    const firePulse = useCallback((srcId, tgtId, color) => {
        const svg = d3.select(svgRef.current);
        const nodes = nodeDataRef.current;
        const src = nodes.find(n => n.id === srcId);
        const tgt = nodes.find(n => n.id === tgtId);
        if (!src?.x || !tgt?.x) return;
        svg.append('circle')
            .attr('r', 5).attr('fill', color).attr('opacity', 0.95)
            .attr('pointer-events', 'none')
            .style('filter', `drop-shadow(0 0 5px ${color})`)
            .transition().duration(800).ease(d3.easeCubicInOut)
            .attrTween('cx', () => t => src.x + (tgt.x - src.x) * t)
            .attrTween('cy', () => t => src.y + (tgt.y - src.y) * t)
            .on('end', function() { d3.select(this).remove(); });
    }, []);

    useEffect(() => {
        if (!sensorState || !isLive) return;
        const sig = JSON.stringify(sensorState);
        if (sig === prevSigRef.current) return;
        prevSigRef.current = sig;
        const cascade = [
            [0,    'node3',   'ttn',       G.node.stroke],
            [80,   'node1',   'ttn',       G.node.stroke],
            [160,  'node2',   'ttn',       G.node.stroke],
            [480,  'ttn',     'rpi',       G.gateway.stroke],
            [860,  'rpi',     'firebase',  G.cloud.stroke],
            [1240, 'firebase','dt',        G.twin.stroke],
            [1600, 'dt',      'ai_occ',    G.ai.stroke],
            [1980, 'ai_occ',  'ai_energy', G.ai.stroke],
            [2300, 'ai_energy','hvac_ctrl',G.output.stroke],
        ];
        const timers = cascade.map(([d, s, t, c]) => setTimeout(() => firePulse(s, t, c), d));
        return () => timers.forEach(clearTimeout);
    }, [sensorState, isLive, firePulse]);

    // ── Build D3 graph ────────────────────────────────────────────────────────
    useEffect(() => {
        const { w, h } = dims;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        svg.attr('width', w).attr('height', h);

        const nodesCopy = NODES.map(n => ({ ...n }));
        const linksCopy = LINKS.map(l => ({ ...l }));

        // ── Background ───────────────────────────────────────────────────────
        svg.append('rect').attr('width', w).attr('height', h)
            .attr('fill', '#060a14').attr('rx', 16);

        // Radial gradient bg glow (centre)
        const defs = svg.append('defs');
        const rg = defs.append('radialGradient').attr('id','bg-glow')
            .attr('cx','50%').attr('cy','50%').attr('r','50%');
        rg.append('stop').attr('offset','0%').attr('stop-color','#1a2744').attr('stop-opacity',0.6);
        rg.append('stop').attr('offset','100%').attr('stop-color','#060a14').attr('stop-opacity',0);
        svg.append('ellipse')
            .attr('cx', w/2).attr('cy', h/2)
            .attr('rx', w * 0.45).attr('ry', h * 0.4)
            .attr('fill','url(#bg-glow)');

        // Grid dots
        const gridG = svg.append('g').attr('opacity', 0.06);
        for (let x = 20; x < w; x += 32)
            for (let y = 20; y < h; y += 32)
                gridG.append('circle').attr('cx',x).attr('cy',y).attr('r',0.9).attr('fill','#60a5fa');

        // Horizontal layer lines (subtle)
        ['Sensors','Edge','Cloud / AI','Outputs'].forEach((label, i) => {
            const y = h * 0.18 + i * (h * 0.22);
            svg.append('line')
                .attr('x1', 24).attr('x2', w - 24)
                .attr('y1', y).attr('y2', y)
                .attr('stroke','#1e2d4a').attr('stroke-width', 0.5).attr('stroke-dasharray','4 6');
            svg.append('text')
                .attr('x', 28).attr('y', y - 4)
                .attr('fill','#1e3a5f').attr('font-size', 9)
                .attr('font-family',"'DM Sans',sans-serif").attr('font-weight','700')
                .attr('letter-spacing', 1.5).text(label.toUpperCase());
        });

        // Arrow markers per group colour
        Object.entries(G).forEach(([key, style]) => {
            defs.append('marker')
                .attr('id', `arrow-${key}`)
                .attr('viewBox','0 -4 8 8').attr('refX', 28).attr('refY', 0)
                .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient','auto')
                .append('path').attr('d','M0,-4L8,0L0,4').attr('fill', style.stroke).attr('opacity', 0.6);
        });

        // Glow filter
        const gf = defs.append('filter').attr('id','node-glow')
            .attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
        gf.append('feGaussianBlur').attr('stdDeviation', 5).attr('result','blur');
        const fm = gf.append('feMerge');
        fm.append('feMergeNode').attr('in','blur');
        fm.append('feMergeNode').attr('in','SourceGraphic');

        // Strong glow for selected
        const sgf = defs.append('filter').attr('id','node-glow-strong')
            .attr('x','-80%').attr('y','-80%').attr('width','260%').attr('height','260%');
        sgf.append('feGaussianBlur').attr('stdDeviation', 10).attr('result','blur');
        const sfm = sgf.append('feMerge');
        sfm.append('feMergeNode').attr('in','blur');
        sfm.append('feMergeNode').attr('in','SourceGraphic');

        // ── Simulation ───────────────────────────────────────────────────────
        const sim = d3.forceSimulation(nodesCopy)
            .force('link', d3.forceLink(linksCopy).id(d => d.id).distance(d => {
                const sg = NODES.find(n => n.id === (d.source.id ?? d.source))?.group;
                const tg = NODES.find(n => n.id === (d.target.id ?? d.target))?.group;
                if (sg === 'sensor' && tg === 'node') return 80;
                if (sg === 'node'   && tg === 'gateway') return 95;
                return 115;
            }).strength(0.55))
            .force('charge', d3.forceManyBody().strength(-380))
            .force('center', d3.forceCenter(w/2, h/2))
            .force('collision', d3.forceCollide(54))
            .force('x', d3.forceX(w/2).strength(0.02))
            .force('y', d3.forceY(h/2).strength(0.02));
        simRef.current = sim;

        // ── Links ────────────────────────────────────────────────────────────
        const linkG = svg.append('g');
        const link = linkG.selectAll('line').data(linksCopy).enter().append('line')
            .attr('stroke', d => {
                const sg = NODES.find(n => n.id === (typeof d.source==='object'?d.source.id:d.source))?.group ?? 'sensor';
                return G[sg]?.stroke ?? '#334155';
            })
            .attr('stroke-width', 1.2)
            .attr('stroke-opacity', 0.35)
            .attr('marker-end', d => {
                const sg = NODES.find(n => n.id === (typeof d.source==='object'?d.source.id:d.source))?.group ?? 'sensor';
                return `url(#arrow-${sg})`;
            });

        // Link labels
        const linkLabel = svg.append('g')
            .selectAll('text').data(linksCopy).enter().append('text')
            .attr('class','link-label')
            .attr('font-size', 7.5).attr('fill', '#1e3a5f')
            .attr('font-family',"'DM Mono',monospace")
            .attr('text-anchor','middle').attr('pointer-events','none')
            .text(d => d.label);

        // ── Nodes ────────────────────────────────────────────────────────────
        const nodeG = svg.append('g');
        const node = nodeG.selectAll('g').data(nodesCopy).enter().append('g')
            .attr('cursor','pointer')
            .attr('data-id', d => d.id)
            .call(d3.drag()
                .on('start', (e,d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
                .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
                .on('end',   (e,d) => { if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
            )
            .on('click', (e, d) => {
                e.stopPropagation();
                const isDeselect = selectedRef.current?.id === d.id;
                setSelected(isDeselect ? null : d);
                setFocusedId(isDeselect ? null : d.id);
            });

        // Outer glow ring
        node.append('circle')
            .attr('r', d => (G[d.group]?.r ?? 22) + 8)
            .attr('fill', d => G[d.group]?.stroke ?? '#334155')
            .attr('opacity', 0.08)
            .attr('pointer-events','none');

        // Main circle
        node.append('circle')
            .attr('r', d => G[d.group]?.r ?? 22)
            .attr('fill', d => G[d.group]?.fill ?? '#0f172a')
            .attr('stroke', d => G[d.group]?.stroke ?? '#334155')
            .attr('stroke-width', 1.5)
            .attr('filter','url(#node-glow)');

        // Node primary label
        node.append('text')
            .attr('text-anchor','middle').attr('dominant-baseline','middle')
            .attr('y', d => d.sublabel ? -5 : 0)
            .attr('font-size', 8.5).attr('font-weight','700')
            .attr('font-family',"'DM Sans',sans-serif")
            .attr('fill', d => G[d.group]?.text ?? '#94a3b8')
            .attr('pointer-events','none')
            .text(d => d.label);

        // Node sublabel
        node.filter(d => !!d.sublabel)
            .append('text')
            .attr('text-anchor','middle').attr('dominant-baseline','middle')
            .attr('y', 6).attr('font-size', 6.5).attr('font-weight','400')
            .attr('font-family',"'DM Sans',sans-serif")
            .attr('fill', d => G[d.group]?.text ?? '#64748b')
            .attr('opacity', 0.65)
            .attr('pointer-events','none')
            .text(d => d.sublabel);

        // AI sublabels (will be updated via separate effect)
        svg.append('g').attr('class','ai-sublabels').attr('pointer-events','none');

        // Hover
        node.on('mouseover', function(e, d) {
            d3.select(this).select('circle:nth-child(2)')
                .attr('stroke-width', 2.5)
                .attr('r', (G[d.group]?.r ?? 22) + 4)
                .attr('filter','url(#node-glow-strong)');
            link.attr('stroke-opacity', l => {
                const s = typeof l.source==='object'?l.source.id:l.source;
                const t = typeof l.target==='object'?l.target.id:l.target;
                return (s===d.id||t===d.id) ? 0.9 : 0.08;
            });
        })
            .on('mouseout', function(e, d) {
                d3.select(this).select('circle:nth-child(2)')
                    .attr('stroke-width', 1.5)
                    .attr('r', G[d.group]?.r ?? 22)
                    .attr('filter','url(#node-glow)');
                link.attr('stroke-opacity', 0.35);
            });

        svg.on('click', () => { setSelected(null); setFocusedId(null); });

        sim.on('tick', () => {
            link
                .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            linkLabel
                .attr('x', d => (d.source.x + d.target.x)/2)
                .attr('y', d => (d.source.y + d.target.y)/2 - 5);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
            nodeDataRef.current = nodesCopy;
        });

        return () => sim.stop();
    }, [dims]);

    // ── Update AI sublabels when predictions change ───────────────────────────
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        if (svg.empty()) return;
        svg.selectAll('.ai-sublabels text').remove();
        if (!lhPred) return;
        const nodes = nodeDataRef.current;
        const items = [
            { id:'ai_occ',    text: lhPred.occupancy_label ? `${lhPred.occupancy_label.toUpperCase()} · ${Math.round((lhPred.confidence??0)*100)}%` : null, override: lhPred.override_needed },
            { id:'ai_energy', text: lhPred.energy_mode?.toUpperCase() ?? null, override: false },
            { id:'ai_light',  text: lhPred.lighting != null ? (lhPred.lighting ? 'ON' : 'OFF') : null, override: false },
        ];
        const container = svg.select('.ai-sublabels');
        items.forEach(({ id, text, override }) => {
            if (!text) return;
            const nd = nodes.find(n => n.id === id);
            if (!nd?.x) return;
            const col = override ? '#ef4444' : '#a78bfa';
            // Pill background
            const tw = text.length * 5.5 + 12;
            container.append('rect')
                .attr('x', nd.x - tw/2).attr('y', nd.y + G.ai.r + 5)
                .attr('width', tw).attr('height', 14).attr('rx', 4)
                .attr('fill', override ? '#3f0a0a' : '#1a0e3a')
                .attr('stroke', col).attr('stroke-width', 0.8).attr('opacity', 0.9);
            container.append('text')
                .attr('x', nd.x).attr('y', nd.y + G.ai.r + 14)
                .attr('text-anchor','middle').attr('font-size', 7.5)
                .attr('font-weight','700').attr('font-family',"'DM Mono',monospace")
                .attr('fill', col).text(text);
        });
    }, [lhPred]);

    // ── Focus + context ───────────────────────────────────────────────────────
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        if (svg.empty()) return;
        if (!focusedId) {
            svg.selectAll('g[data-id]').transition().duration(280).attr('opacity', 1);
            svg.selectAll('line').transition().duration(280).attr('stroke-opacity', 0.35);
            svg.selectAll('text.link-label').transition().duration(280).attr('opacity', 1);
            return;
        }
        const nb = new Set([focusedId]);
        LINKS.forEach(l => {
            const s = typeof l.source==='object'?l.source.id:l.source;
            const t = typeof l.target==='object'?l.target.id:l.target;
            if (s===focusedId) nb.add(t);
            if (t===focusedId) nb.add(s);
        });
        svg.selectAll('g[data-id]').transition().duration(280)
            .attr('opacity', d => nb.has(d?.id) ? 1 : 0.1);
        svg.selectAll('line').transition().duration(280)
            .attr('stroke-opacity', function(d) {
                if (!d) return 0.04;
                const s = typeof d.source==='object'?d.source.id:d.source;
                const t = typeof d.target==='object'?d.target.id:d.target;
                return (s===focusedId||t===focusedId) ? 0.9 : 0.04;
            });
        svg.selectAll('text.link-label').transition().duration(280)
            .attr('opacity', function(d) {
                if (!d) return 0.04;
                const s = typeof d.source==='object'?d.source.id:d.source;
                const t = typeof d.target==='object'?d.target.id:d.target;
                return (s===focusedId||t===focusedId) ? 1 : 0.04;
            });
    }, [focusedId]);

    selectedRef.current = selected;

    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-slate-900">System Ontology</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Live pipeline monitor · Click any node to inspect · Drag to reposition
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isLive
                        ? <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live · Pulses active
              </span>
                        : <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Simulated data
              </span>
                    }
                    {focusedId && (
                        <button
                            onClick={() => { setFocusedId(null); setSelected(null); }}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {NODES.find(n=>n.id===focusedId)?.label} · focused
                            <span className="ml-1">✕</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Graph + panel */}
            <div className="grid grid-cols-12 gap-4">
                <div className={selected ? 'col-span-12 lg:col-span-8' : 'col-span-12'}>
                    <div ref={wrapRef} className="w-full rounded-2xl overflow-hidden"
                         style={{ boxShadow:'0 0 40px rgba(59,130,246,0.08), 0 2px 12px rgba(0,0,0,0.2)' }}>
                        <svg ref={svgRef} className="w-full" style={{ display:'block' }} />
                    </div>
                </div>

                {/* Side panel */}
                {selected && (
                    <div className="col-span-12 lg:col-span-4">
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden h-full flex flex-col"
                             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>

                            {/* Panel header */}
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"
                                 style={{ background: `${G[selected.group]?.fill ?? '#0f172a'}` }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                         style={{ border:`1.5px solid ${G[selected.group]?.stroke}`, background:'rgba(0,0,0,0.3)' }}>
                                        <Icon name={selected.icon ?? 'settings'} className="w-4 h-4"
                                              style={{ color: G[selected.group]?.stroke }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: G[selected.group]?.text }}>{selected.label}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60"
                                           style={{ color: G[selected.group]?.text }}>
                                            {GROUP_LABEL[selected.group]}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => { setSelected(null); setFocusedId(null); }}
                                        className="opacity-50 hover:opacity-100 transition-opacity"
                                        style={{ color: G[selected.group]?.text }}>
                                    <Icon name="x" className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-5 flex-1 overflow-y-auto space-y-4">
                                <p className="text-sm text-slate-500 leading-relaxed">{selected.desc}</p>

                                {/* AI output panel */}
                                {selected.group === 'ai' && (
                                    <div className="rounded-xl p-4" style={{ background:'#0a0f1e', border:'1px solid #1e2d4a' }}>
                                        <p className="text-[9px] font-bold tracking-widest mb-3 flex items-center gap-1.5"
                                           style={{ color:'#4b5563' }}>
                                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#a78bfa' }} />
                                            LAST MODEL OUTPUT — LECTURE HALL
                                        </p>
                                        {lhPred ? [
                                            { k:'Occupancy',   v: lhPred.occupancy_label?.toUpperCase() ?? '—', col: lhPred.override_needed ? '#ef4444' : '#a78bfa' },
                                            { k:'Energy mode', v: lhPred.energy_mode?.toUpperCase() ?? '—',      col:'#a78bfa' },
                                            { k:'Lighting',    v: lhPred.lighting != null ? (lhPred.lighting?'ON':'OFF') : '—', col:'#a78bfa' },
                                            { k:'Confidence',  v: lhPred.confidence ? `${Math.round(lhPred.confidence*100)}%` : '—', col:'#6b7280' },
                                            { k:'Override',    v: lhPred.override_needed ? 'ACTIVE' : 'none',    col: lhPred.override_needed ? '#ef4444' : '#374151' },
                                        ].map(r => (
                                            <div key={r.k} className="flex justify-between items-center mb-2">
                                                <span className="text-[11px]" style={{ color:'#6b7280' }}>{r.k}</span>
                                                <span className="text-sm font-bold" style={{ color:r.col, fontFamily:"'DM Mono',monospace" }}>{r.v}</span>
                                            </div>
                                        )) : <p className="text-[11px]" style={{ color:'#4b5563' }}>Run inference_server.py to populate</p>}
                                    </div>
                                )}

                                {/* Live sensor reading */}
                                {selected.room && sensorState?.[selected.room] && (() => {
                                    const s = sensorState[selected.room];
                                    const rows = [
                                        selected.type==='temperature' && s.temperature_c != null && { k:'Temperature', v:`${s.temperature_c.toFixed(1)}°C`, bad: s.temperature_c > 27 },
                                        selected.type==='fire'        && s.temperature_c != null && { k:'Temp (fire sim)', v:`${s.temperature_c.toFixed(1)}°C`, bad: s.temperature_c > 35 },

                                        selected.type==='motion'      && s.motion   != null      && { k:'Motion',      v: s.motion?'Detected':'Clear',    bad: false },
                                        selected.type==='lux'         && s.lux      != null      && { k:'Lux',         v:`${s.lux} lx`,                   bad: s.lux < 100 },
                                    ].filter(Boolean);
                                    if (!rows.length) return null;
                                    return (
                                        <div className="rounded-xl p-4" style={{ background:'#0a0f1e', border:'1px solid #1e2d4a' }}>
                                            <p className="text-[9px] font-bold tracking-widest mb-3 flex items-center gap-1.5" style={{ color:'#4b5563' }}>
                                                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
                                                LIVE READING
                                            </p>
                                            {rows.map(r => (
                                                <div key={r.k} className="flex justify-between items-center mb-2">
                                                    <span className="text-[11px]" style={{ color:'#6b7280' }}>{r.k}</span>
                                                    <span className="text-sm font-bold" style={{ color: r.bad?'#ef4444':'#10b981', fontFamily:"'DM Mono',monospace" }}>{r.v}</span>
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
                                            const col = G[other?.group]?.stroke ?? '#64748b';
                                            return (
                                                <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isOut?'bg-emerald-950 text-emerald-400':'bg-blue-950 text-blue-400'}`}>
                            {isOut?'→ OUT':'← IN'}
                          </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">{l.label}</span>
                                                    <div className="ml-auto flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                                                        <span className="text-slate-500 font-semibold truncate">{other?.label}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 px-1">
                {Object.entries(G).map(([group, style]) => (
                    <div key={group} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background:style.fill, border:`1.5px solid ${style.stroke}`, boxShadow:`0 0 6px ${style.stroke}66` }} />
                        <span className="text-[11px] font-semibold text-slate-400">{GROUP_LABEL[group]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}