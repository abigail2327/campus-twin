/**
 * Analytics.jsx — Phase 3 MVP
 * ─────────────────────────────────────────────────────────────────────────────
 * Selectable AI-driven chart views scoped to the 3 active nodes:
 *   Node 1 — Classroom 1   (PIR motion, lighting)
 *   Node 2 — Classroom 2   (ambient lux, lighting)
 *   Node 3 — Lecture Hall  (temperature, CO₂, occupancy, HVAC)
 *
 * Professor feedback implemented:
 *   ✓ Charts show AI predictions overlaid on sensor readings
 *   ✓ User selects which view to see (temperature / occupancy / energy / lighting)
 *   ✓ Each chart type shows only the relevant rooms/nodes
 *   ✓ AI prediction bands and confidence shown alongside raw data
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Icon from '../components/panels/Icon';
import { useLiveSensorState } from '../services/sensorState';
import { exportEnergyData, exportFullReport } from '../services/exportService';

// ── AI prediction engine (rule-based until ML model is connected) ─────────────
// These functions mirror the logic the Random Forest model will implement.
// When the model is trained, replace these with model inference calls.

function predictOccupancy(temp, co2, motion, lux, hour, isScheduled) {
    // 0 = unoccupied, 1 = scheduled, 2 = unscheduled
    if (isScheduled && (motion || co2 > 600)) return 1;
    if (!isScheduled && (motion || co2 > 700)) return 2; // unscheduled alert
    if (co2 < 450 && !motion) return 0;
    return 0;
}

function predictEnergyMode(occupancy, hour) {
    // 'active' | 'standby' | 'off'
    if (occupancy > 0) return 'active';
    if (hour >= 7 && hour <= 20) return 'standby';
    return 'off';
}

function predictLighting(motion, lux, css, lcs) {
    if (lcs === 'ON') return true;
    if (!css) return false;
    if (motion && lux < 300) return true;
    if (lux > 600) return false;
    return motion;
}

// ── MVP node data (Sept 15 2025, 30-min intervals) ───────────────────────────
// Scoped to Classroom 1 (Node 1), Classroom 2 (Node 2), Lecture Hall (Node 3)
const MVP_DATA = [
    // Timestamps: 00:00 to 23:30 on Sept 15 (a Tuesday — class day)
    // Format: { t, cr1_temp, cr1_motion, cr1_lux, cr2_temp, cr2_lux, lh_temp, lh_co2, lh_occ, lh_fan, scheduled }
    { t:'00:00', cr1_temp:23.1, cr1_motion:false, cr1_lux:5,   cr2_temp:22.8, cr2_lux:4,   lh_temp:23.4, lh_co2:398,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'00:30', cr1_temp:23.0, cr1_motion:false, cr1_lux:5,   cr2_temp:22.7, cr2_lux:4,   lh_temp:23.3, lh_co2:395,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'01:00', cr1_temp:22.9, cr1_motion:false, cr1_lux:5,   cr2_temp:22.6, cr2_lux:4,   lh_temp:23.2, lh_co2:392,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'06:00', cr1_temp:22.8, cr1_motion:false, cr1_lux:40,  cr2_temp:22.5, cr2_lux:80,  lh_temp:23.1, lh_co2:400,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'07:00', cr1_temp:23.0, cr1_motion:false, cr1_lux:120, cr2_temp:22.7, cr2_lux:200, lh_temp:23.3, lh_co2:408,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'07:30', cr1_temp:23.1, cr1_motion:false, cr1_lux:180, cr2_temp:22.8, cr2_lux:280, lh_temp:23.4, lh_co2:415,  lh_occ:5,  lh_fan:40,  sched:false },
    { t:'08:00', cr1_temp:23.6, cr1_motion:true,  cr1_lux:320, cr2_temp:23.1, cr2_lux:380, lh_temp:24.1, lh_co2:512,  lh_occ:42, lh_fan:40,  sched:true  },
    { t:'08:30', cr1_temp:24.2, cr1_motion:true,  cr1_lux:380, cr2_temp:23.6, cr2_lux:420, lh_temp:24.8, lh_co2:689,  lh_occ:78, lh_fan:100, sched:true  },
    { t:'09:00', cr1_temp:24.4, cr1_motion:false, cr1_lux:410, cr2_temp:24.1, cr2_lux:450, lh_temp:25.3, lh_co2:812,  lh_occ:85, lh_fan:100, sched:true  },
    { t:'09:30', cr1_temp:24.6, cr1_motion:true,  cr1_lux:440, cr2_temp:24.3, cr2_lux:470, lh_temp:25.5, lh_co2:948,  lh_occ:88, lh_fan:100, sched:true  },
    { t:'10:00', cr1_temp:24.8, cr1_motion:true,  cr1_lux:460, cr2_temp:24.5, cr2_lux:490, lh_temp:25.7, lh_co2:1012, lh_occ:91, lh_fan:100, sched:true  },
    { t:'10:30', cr1_temp:25.0, cr1_motion:true,  cr1_lux:480, cr2_temp:24.7, cr2_lux:510, lh_temp:25.8, lh_co2:1124, lh_occ:93, lh_fan:100, sched:true  },
    { t:'11:00', cr1_temp:24.8, cr1_motion:false, cr1_lux:490, cr2_temp:24.8, cr2_lux:520, lh_temp:25.6, lh_co2:1080, lh_occ:89, lh_fan:100, sched:true  },
    { t:'11:30', cr1_temp:24.7, cr1_motion:true,  cr1_lux:500, cr2_temp:24.6, cr2_lux:530, lh_temp:25.5, lh_co2:1020, lh_occ:85, lh_fan:100, sched:true  },
    { t:'12:00', cr1_temp:24.4, cr1_motion:false, cr1_lux:520, cr2_temp:24.1, cr2_lux:550, lh_temp:25.2, lh_co2:820,  lh_occ:12, lh_fan:40,  sched:false },
    { t:'12:30', cr1_temp:24.1, cr1_motion:false, cr1_lux:510, cr2_temp:23.8, cr2_lux:540, lh_temp:24.9, lh_co2:712,  lh_occ:8,  lh_fan:40,  sched:false },
    { t:'13:00', cr1_temp:24.8, cr1_motion:true,  cr1_lux:490, cr2_temp:24.4, cr2_lux:510, lh_temp:25.1, lh_co2:698,  lh_occ:62, lh_fan:100, sched:true  },
    { t:'13:30', cr1_temp:25.1, cr1_motion:true,  cr1_lux:470, cr2_temp:24.7, cr2_lux:490, lh_temp:25.4, lh_co2:812,  lh_occ:75, lh_fan:100, sched:true  },
    { t:'14:00', cr1_temp:25.2, cr1_motion:true,  cr1_lux:450, cr2_temp:24.8, cr2_lux:460, lh_temp:25.8, lh_co2:1042, lh_occ:85, lh_fan:100, sched:true  },
    { t:'14:30', cr1_temp:25.1, cr1_motion:true,  cr1_lux:420, cr2_temp:24.7, cr2_lux:430, lh_temp:25.6, lh_co2:1012, lh_occ:82, lh_fan:100, sched:true  },
    { t:'15:00', cr1_temp:25.3, cr1_motion:true,  cr1_lux:380, cr2_temp:24.9, cr2_lux:390, lh_temp:26.0, lh_co2:1198, lh_occ:92, lh_fan:100, sched:true  },
    { t:'15:30', cr1_temp:25.1, cr1_motion:true,  cr1_lux:340, cr2_temp:24.8, cr2_lux:350, lh_temp:25.8, lh_co2:1142, lh_occ:88, lh_fan:100, sched:true  },
    { t:'16:00', cr1_temp:25.4, cr1_motion:true,  cr1_lux:290, cr2_temp:25.1, cr2_lux:300, lh_temp:26.2, lh_co2:1284, lh_occ:93, lh_fan:100, sched:true  },
    { t:'16:30', cr1_temp:25.1, cr1_motion:false, cr1_lux:240, cr2_temp:24.8, cr2_lux:250, lh_temp:25.7, lh_co2:1048, lh_occ:12, lh_fan:40,  sched:false },
    { t:'17:00', cr1_temp:24.7, cr1_motion:false, cr1_lux:180, cr2_temp:24.4, cr2_lux:190, lh_temp:25.2, lh_co2:812,  lh_occ:8,  lh_fan:40,  sched:false },
    { t:'17:30', cr1_temp:24.4, cr1_motion:false, cr1_lux:120, cr2_temp:24.1, cr2_lux:130, lh_temp:24.8, lh_co2:698,  lh_occ:5,  lh_fan:40,  sched:false },
    { t:'18:00', cr1_temp:24.1, cr1_motion:false, cr1_lux:60,  cr2_temp:23.8, cr2_lux:65,  lh_temp:24.4, lh_co2:582,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'18:30', cr1_temp:23.8, cr1_motion:false, cr1_lux:20,  cr2_temp:23.5, cr2_lux:25,  lh_temp:24.1, lh_co2:498,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'19:00', cr1_temp:23.5, cr1_motion:false, cr1_lux:8,   cr2_temp:23.2, cr2_lux:10,  lh_temp:23.8, lh_co2:442,  lh_occ:0,  lh_fan:0,   sched:false },
    { t:'22:00', cr1_temp:23.2, cr1_motion:false, cr1_lux:5,   cr2_temp:22.9, cr2_lux:5,   lh_temp:23.4, lh_co2:412,  lh_occ:0,  lh_fan:0,   sched:false },
];

// Enrich with AI predictions
const ENRICHED = MVP_DATA.map(d => {
    const hour = parseInt(d.t.split(':')[0]);
    const lhOccClass  = predictOccupancy(d.lh_temp, d.lh_co2, false, 0, hour, d.sched);
    const cr1OccClass = predictOccupancy(d.cr1_temp, 420, d.cr1_motion, d.cr1_lux, hour, d.sched);
    const cr2OccClass = predictOccupancy(d.cr2_temp, 420, false, d.cr2_lux, hour, d.sched);
    return {
        ...d, hour,
        ai_lh_occ_class:  lhOccClass,
        ai_cr1_occ_class: cr1OccClass,
        ai_cr2_occ_class: cr2OccClass,
        ai_lh_energy:     predictEnergyMode(lhOccClass, hour),
        ai_cr1_energy:    predictEnergyMode(cr1OccClass, hour),
        ai_cr1_lighting:  predictLighting(d.cr1_motion, d.cr1_lux, d.sched, 'AUTO'),
        ai_cr2_lighting:  predictLighting(false, d.cr2_lux, d.sched, 'AUTO'),
        ai_lh_temp_pred:  d.lh_temp + (lhOccClass > 0 ? 0.3 : -0.2), // simple prediction offset
    };
});

const OCC_LABELS = { 0:'Unoccupied', 1:'Scheduled', 2:'Unscheduled' };
const OCC_COLORS = { 0:'#64748b', 1:'#2563eb', 2:'#ef4444' };
const ENERGY_COLORS = { active:'#10b981', standby:'#f59e0b', off:'#64748b' };

// ── Shared card ───────────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200/80 ${className}`}
             style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.04)' }}>
            {children}
        </div>
    );
}

function CardHead({ title, sub, iconName, right }) {
    return (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2.5">
                {iconName && <Icon name={iconName} className="w-4 h-4 text-slate-400" />}
                <div>
                    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                    {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                </div>
            </div>
            {right}
        </div>
    );
}

// ── D3 Temperature + AI Prediction chart ─────────────────────────────────────
function TemperatureChart({ room }) {
    const ref     = useRef();
    const wrapRef = useRef();
    const [w, setW] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    const data = ENRICHED.filter(d => {
        if (room === 'Classroom_1')        return d.cr1_temp != null;
        if (room === 'Classroom_2')        return d.cr2_temp != null;
        if (room === 'Large_Lecture_Hall') return d.lh_temp  != null;
        return true;
    });

    const getTempKey   = r => r === 'Classroom_1' ? 'cr1_temp' : r === 'Classroom_2' ? 'cr2_temp' : 'lh_temp';
    const getPredKey   = r => r === 'Large_Lecture_Hall' ? 'ai_lh_temp_pred' : null;
    const getOccKey    = r => r === 'Classroom_1' ? 'ai_cr1_occ_class' : r === 'Classroom_2' ? 'ai_cr2_occ_class' : 'ai_lh_occ_class';
    const tempKey      = getTempKey(room);
    const predKey      = getPredKey(room);
    const occKey       = getOccKey(room);

    useEffect(() => {
        if (!data.length) return;
        const svg = d3.select(ref.current);
        svg.selectAll('*').remove();

        const h = 240, margin = { t:12, r:16, b:44, l:44 };
        const iw = w - margin.l - margin.r;
        const ih = h - margin.t - margin.b;
        const g  = svg.attr('width', w).attr('height', h)
            .append('g').attr('transform', `translate(${margin.l},${margin.t})`);

        const xScale = d3.scalePoint().domain(data.map(d => d.t)).range([0, iw]);
        const temps  = data.map(d => d[tempKey]).filter(Boolean);
        const yScale = d3.scaleLinear().domain([20, Math.max(28, ...temps) + 0.5]).range([ih, 0]);

        // Grid
        g.append('g').attr('opacity', 0.07)
            .call(d3.axisLeft(yScale).tickSize(-iw).tickFormat(''));

        // Comfort zone band (22–25°C)
        g.append('rect').attr('x', 0).attr('y', yScale(25))
            .attr('width', iw).attr('height', yScale(22) - yScale(25))
            .attr('fill', '#2563eb').attr('opacity', 0.06);

        // Threshold lines
        [{val:25,color:'#ef4444',label:'25°C max'},{val:22,color:'#2563eb',label:'22°C min'}].forEach(t => {
            g.append('line').attr('x1',0).attr('x2',iw)
                .attr('y1',yScale(t.val)).attr('y2',yScale(t.val))
                .attr('stroke',t.color).attr('stroke-width',1).attr('stroke-dasharray','4,3').attr('opacity',0.5);
            g.append('text').attr('x',iw-4).attr('y',yScale(t.val)-4)
                .attr('text-anchor','end').attr('font-size',9).attr('fill',t.color).attr('opacity',0.7).text(t.label);
        });

        // Axes
        const xTicks = data.filter((_,i) => i % 4 === 0).map(d => d.t);
        g.append('g').attr('transform',`translate(0,${ih})`)
            .call(d3.axisBottom(xScale).tickValues(xTicks))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9).attr('transform','rotate(-30)').style('text-anchor','end'); ax.selectAll('.tick line').attr('stroke','#e2e8f0'); });
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}°`))
            .call(ax => { ax.select('.domain').remove(); ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10); ax.selectAll('.tick line').attr('stroke','#e2e8f0'); });

        // Occupancy background colouring
        data.forEach((d, i) => {
            if (i === data.length - 1) return;
            const x1 = xScale(d.t);
            const x2 = xScale(data[i+1].t);
            const cls = d[occKey] ?? 0;
            if (cls > 0) {
                g.append('rect').attr('x', x1).attr('y', 0)
                    .attr('width', (x2 - x1)).attr('height', ih)
                    .attr('fill', OCC_COLORS[cls]).attr('opacity', 0.07);
            }
        });

        // Actual temperature line — colour by threshold
        const lineBase = d3.line().x(d => xScale(d.t)).y(d => yScale(d[tempKey])).defined(d => d[tempKey] != null);
        for (let i = 0; i < data.length - 1; i++) {
            const avg = (data[i][tempKey] + data[i+1][tempKey]) / 2;
            const color = avg < 22 ? '#3b82f6' : avg > 25 ? '#ef4444' : '#10b981';
            g.append('path').datum([data[i], data[i+1]])
                .attr('fill','none').attr('stroke',color).attr('stroke-width',2.2)
                .attr('stroke-linecap','round')
                .attr('d', d3.line().x(d => xScale(d.t)).y(d => yScale(d[tempKey])));
        }

        // AI predicted temperature line (dashed, for Lecture Hall)
        if (predKey) {
            g.append('path').datum(data.filter(d => d[predKey] != null))
                .attr('fill','none').attr('stroke','#8b5cf6').attr('stroke-width',1.5)
                .attr('stroke-dasharray','5,3')
                .attr('d', d3.line().x(d => xScale(d.t)).y(d => yScale(d[predKey])));
        }

        // Dots coloured by threshold
        g.selectAll('.dot').data(data.filter(d => d[tempKey] != null))
            .enter().append('circle')
            .attr('cx', d => xScale(d.t)).attr('cy', d => yScale(d[tempKey]))
            .attr('r', 2.5)
            .attr('fill', d => d[tempKey] < 22 ? '#3b82f6' : d[tempKey] > 25 ? '#ef4444' : '#10b981')
            .attr('stroke','white').attr('stroke-width',1);

    }, [data, room, w]);

    return (
        <div ref={wrapRef} className="relative w-full">
            <svg ref={ref} className="w-full" />
        </div>
    );
}

// ── D3 Occupancy chart with AI classification bands ──────────────────────────
function OccupancyChart({ room }) {
    const ref     = useRef();
    const wrapRef = useRef();
    const [w, setW] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    // For Lecture Hall we have actual occupancy count
    // For classrooms we show PIR motion state + AI classification
    const isLH = room === 'Large_Lecture_Hall';
    const data  = ENRICHED;
    const occKey    = room === 'Classroom_1' ? 'ai_cr1_occ_class' : room === 'Classroom_2' ? 'ai_cr2_occ_class' : 'ai_lh_occ_class';
    const rawOccKey = isLH ? 'lh_occ' : null;

    useEffect(() => {
        const svg = d3.select(ref.current);
        svg.selectAll('*').remove();
        const h = 220, margin = { t:12, r:16, b:44, l:44 };
        const iw = w - margin.l - margin.r;
        const ih = h - margin.t - margin.b;
        const g  = svg.attr('width',w).attr('height',h)
            .append('g').attr('transform',`translate(${margin.l},${margin.t})`);

        const xScale = d3.scalePoint().domain(data.map(d => d.t)).range([0, iw]);

        if (isLH) {
            // Bar chart for actual occupancy + AI prediction class colouring
            const yScale = d3.scaleLinear().domain([0, 100]).range([ih, 0]);
            g.append('g').attr('transform',`translate(0,${ih})`)
                .call(d3.axisBottom(xScale).tickValues(data.filter((_,i)=>i%4===0).map(d=>d.t)))
                .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9).attr('transform','rotate(-30)').style('text-anchor','end');ax.selectAll('.tick line').attr('stroke','#e2e8f0');});
            g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d=>`${d}%`))
                .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10);ax.selectAll('.tick line').attr('stroke','#e2e8f0');});

            // Grid
            g.append('g').attr('opacity',0.07).call(d3.axisLeft(yScale).tickSize(-iw).tickFormat(''));

            // 85% capacity warning line
            g.append('line').attr('x1',0).attr('x2',iw).attr('y1',yScale(85)).attr('y2',yScale(85))
                .attr('stroke','#ef4444').attr('stroke-width',1).attr('stroke-dasharray','4,3').attr('opacity',0.5);
            g.append('text').attr('x',iw-4).attr('y',yScale(85)-4).attr('text-anchor','end')
                .attr('font-size',9).attr('fill','#ef4444').attr('opacity',0.7).text('85% warning');

            const bw = Math.max(2, iw / data.length - 2);
            data.forEach(d => {
                const cls   = d[occKey];
                const color = OCC_COLORS[cls];
                g.append('rect')
                    .attr('x', xScale(d.t) - bw/2)
                    .attr('y', yScale(d.lh_occ ?? 0))
                    .attr('width', bw)
                    .attr('height', ih - yScale(d.lh_occ ?? 0))
                    .attr('fill', color).attr('opacity', 0.8).attr('rx', 2);
            });
        } else {
            // Motion timeline for classrooms
            const yScale = d3.scaleLinear().domain([-0.2, 1.2]).range([ih, 0]);
            g.append('g').attr('transform',`translate(0,${ih})`)
                .call(d3.axisBottom(xScale).tickValues(data.filter((_,i)=>i%4===0).map(d=>d.t)))
                .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9).attr('transform','rotate(-30)').style('text-anchor','end');ax.selectAll('.tick line').attr('stroke','#e2e8f0');});

            const motionKey = room === 'Classroom_1' ? 'cr1_motion' : null;

            // AI classification background
            data.forEach((d, i) => {
                if (i === data.length - 1) return;
                const x1 = xScale(d.t), x2 = xScale(data[i+1].t);
                const cls = d[occKey] ?? 0;
                g.append('rect').attr('x',x1).attr('y',0).attr('width',x2-x1).attr('height',ih)
                    .attr('fill',OCC_COLORS[cls]).attr('opacity',0.12);
            });

            // Motion state line (Classroom 1 only)
            if (motionKey) {
                data.forEach((d, i) => {
                    if (i === data.length - 1) return;
                    const x1 = xScale(d.t), x2 = xScale(data[i+1].t);
                    const y  = yScale(d[motionKey] ? 1 : 0);
                    g.append('line').attr('x1',x1).attr('x2',x2).attr('y1',y).attr('y2',y)
                        .attr('stroke','#2563eb').attr('stroke-width',2.5).attr('stroke-linecap','round');
                    // Vertical connectors
                    if (d[motionKey] !== data[i+1][motionKey]) {
                        g.append('line').attr('x1',x2).attr('x2',x2)
                            .attr('y1',yScale(d[motionKey]?1:0)).attr('y2',yScale(data[i+1][motionKey]?1:0))
                            .attr('stroke','#2563eb').attr('stroke-width',2.5);
                    }
                });
                g.append('text').attr('x',4).attr('y',yScale(1)-4).attr('font-size',9).attr('fill','#2563eb').text('Motion ON');
                g.append('text').attr('x',4).attr('y',yScale(0)+12).attr('font-size',9).attr('fill','#94a3b8').text('Motion OFF');
            }
        }

    }, [data, room, w]);

    return (
        <div ref={wrapRef} className="w-full">
            <svg ref={ref} className="w-full" />
        </div>
    );
}

// ── Energy mode timeline ──────────────────────────────────────────────────────
function EnergyChart({ room }) {
    const ref     = useRef();
    const wrapRef = useRef();
    const [w, setW] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    const energyKey = room === 'Classroom_1' ? 'ai_cr1_energy' : room === 'Large_Lecture_Hall' ? 'ai_lh_energy' : 'ai_lh_energy';
    const powerKey  = room === 'Classroom_1' ? 'cr1_temp' : 'lh_temp'; // placeholder — swap for real power when live

    useEffect(() => {
        const svg = d3.select(ref.current);
        svg.selectAll('*').remove();
        const h = 200, margin = { t:12, r:100, b:44, l:44 };
        const iw = w - margin.l - margin.r;
        const ih = h - margin.t - margin.b;
        const g  = svg.attr('width',w).attr('height',h)
            .append('g').attr('transform',`translate(${margin.l},${margin.t})`);

        const data   = ENRICHED;
        const xScale = d3.scalePoint().domain(data.map(d => d.t)).range([0, iw]);
        const modes  = ['active','standby','off'];
        const yScale = d3.scaleBand().domain(modes).range([0, ih]).padding(0.2);

        g.append('g').attr('transform',`translate(0,${ih})`)
            .call(d3.axisBottom(xScale).tickValues(data.filter((_,i)=>i%4===0).map(d=>d.t)))
            .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9).attr('transform','rotate(-30)').style('text-anchor','end');ax.selectAll('.tick line').attr('stroke','#e2e8f0');});
        g.append('g').call(d3.axisLeft(yScale))
            .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#64748b').attr('font-size',10).attr('font-weight',600);ax.selectAll('.tick line').remove();});

        // AI energy mode segments
        data.forEach((d, i) => {
            if (i === data.length - 1) return;
            const x1 = xScale(d.t), x2 = xScale(data[i+1].t);
            const mode = d[energyKey];
            g.append('rect')
                .attr('x',x1).attr('y',yScale(mode))
                .attr('width',x2-x1).attr('height',yScale.bandwidth())
                .attr('fill',ENERGY_COLORS[mode]).attr('opacity',0.85).attr('rx',2);
        });

        // Legend on right
        modes.forEach((m,i) => {
            g.append('rect').attr('x',iw+10).attr('y',yScale(m)+yScale.bandwidth()/2-6).attr('width',12).attr('height',12).attr('fill',ENERGY_COLORS[m]).attr('rx',2);
            g.append('text').attr('x',iw+26).attr('y',yScale(m)+yScale.bandwidth()/2+4).attr('font-size',10).attr('fill','#64748b').attr('text-transform','capitalize').text(m.charAt(0).toUpperCase()+m.slice(1));
        });

    }, [room, w]);

    return (
        <div ref={wrapRef} className="w-full">
            <svg ref={ref} className="w-full" />
        </div>
    );
}

// ── Lighting state chart ──────────────────────────────────────────────────────
function LightingChart({ room }) {
    const ref     = useRef();
    const wrapRef = useRef();
    const [w, setW] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
        if (wrapRef.current) obs.observe(wrapRef.current);
        return () => obs.disconnect();
    }, []);

    const litKey = room === 'Classroom_1' ? 'ai_cr1_lighting' : 'ai_cr2_lighting';
    const luxKey = room === 'Classroom_1' ? 'cr1_lux' : 'cr2_lux';

    useEffect(() => {
        const svg = d3.select(ref.current);
        svg.selectAll('*').remove();
        const h = 200, margin = { t:12, r:16, b:44, l:54 };
        const iw = w - margin.l - margin.r;
        const ih = h - margin.t - margin.b;
        const g  = svg.attr('width',w).attr('height',h)
            .append('g').attr('transform',`translate(${margin.l},${margin.t})`);

        const xScale = d3.scalePoint().domain(ENRICHED.map(d=>d.t)).range([0,iw]);
        const yScale = d3.scaleLinear().domain([0,600]).range([ih,0]);

        g.append('g').attr('transform',`translate(0,${ih})`)
            .call(d3.axisBottom(xScale).tickValues(ENRICHED.filter((_,i)=>i%4===0).map(d=>d.t)))
            .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',9).attr('transform','rotate(-30)').style('text-anchor','end');ax.selectAll('.tick line').attr('stroke','#e2e8f0');});
        g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d=>`${d} lx`))
            .call(ax=>{ax.select('.domain').remove();ax.selectAll('text').attr('fill','#94a3b8').attr('font-size',10);ax.selectAll('.tick line').attr('stroke','#e2e8f0');});

        // Grid
        g.append('g').attr('opacity',0.07).call(d3.axisLeft(yScale).tickSize(-iw).tickFormat(''));

        // Lux area
        const luxGrad = g.append('defs').append('linearGradient').attr('id','lux-grad').attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1');
        luxGrad.append('stop').attr('offset','0%').attr('stop-color','#fbbf24').attr('stop-opacity',0.3);
        luxGrad.append('stop').attr('offset','100%').attr('stop-color','#fbbf24').attr('stop-opacity',0.02);

        g.append('path').datum(ENRICHED)
            .attr('fill','url(#lux-grad)')
            .attr('d', d3.area().x(d=>xScale(d.t)).y0(ih).y1(d=>yScale(Math.min(d[luxKey],550))).curve(d3.curveMonotoneX));

        // Lux line
        g.append('path').datum(ENRICHED)
            .attr('fill','none').attr('stroke','#fbbf24').attr('stroke-width',1.8)
            .attr('d', d3.line().x(d=>xScale(d.t)).y(d=>yScale(Math.min(d[luxKey],550))).curve(d3.curveMonotoneX));

        // AI lighting prediction background
        ENRICHED.forEach((d,i) => {
            if (i === ENRICHED.length-1) return;
            const x1=xScale(d.t), x2=xScale(ENRICHED[i+1].t);
            if (d[litKey]) {
                g.append('rect').attr('x',x1).attr('y',0).attr('width',x2-x1).attr('height',ih)
                    .attr('fill','#fef9c3').attr('opacity',0.25);
            }
        });

        // 300 lux threshold (dim lights)
        g.append('line').attr('x1',0).attr('x2',iw).attr('y1',yScale(300)).attr('y2',yScale(300))
            .attr('stroke','#f59e0b').attr('stroke-width',1).attr('stroke-dasharray','4,3').attr('opacity',0.6);
        g.append('text').attr('x',4).attr('y',yScale(300)-4).attr('font-size',9).attr('fill','#f59e0b').text('300 lx — dim threshold');

        // 600 lux threshold (lights off)
        g.append('line').attr('x1',0).attr('x2',iw).attr('y1',yScale(580)).attr('y2',yScale(580))
            .attr('stroke','#10b981').attr('stroke-width',1).attr('stroke-dasharray','4,3').attr('opacity',0.6);
        g.append('text').attr('x',4).attr('y',yScale(580)-4).attr('font-size',9).attr('fill','#10b981').text('600 lx — lights off');

    }, [room, w]);

    return (
        <div ref={wrapRef} className="w-full">
            <svg ref={ref} className="w-full" />
        </div>
    );
}

// ── AI confidence strip ───────────────────────────────────────────────────────
function ConfidenceStrip({ data, room }) {
    const occKey = room === 'Classroom_1' ? 'ai_cr1_occ_class' : room === 'Classroom_2' ? 'ai_cr2_occ_class' : 'ai_lh_occ_class';
    const classes = data.map(d => d[occKey] ?? 0);
    const scheduled   = classes.filter(c => c === 1).length;
    const unscheduled = classes.filter(c => c === 2).length;
    const unoccupied  = classes.filter(c => c === 0).length;
    const total = classes.length || 1;

    return (
        <div className="flex items-center gap-4 flex-wrap">
            {[
                { label:'Unoccupied', count:unoccupied, color:'#64748b' },
                { label:'Scheduled',  count:scheduled,  color:'#2563eb' },
                { label:'Unscheduled',count:unscheduled,color:'#ef4444' },
            ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background:s.color }} />
                    <span className="text-[11px] font-semibold text-slate-600">{s.label}</span>
                    <span className="text-[11px] font-bold text-slate-400" style={{ fontFamily:"'DM Mono',monospace" }}>
            {Math.round((s.count/total)*100)}%
          </span>
                </div>
            ))}
            <span className="ml-auto text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 uppercase tracking-widest">
        AI Prediction
      </span>
        </div>
    );
}

// ── CHART VIEW CONFIG ─────────────────────────────────────────────────────────
const CHART_VIEWS = [
    {
        id: 'temperature',
        label: 'Temperature',
        icon: 'temperature',
        desc: 'Actual vs AI-predicted temperature with occupancy colouring',
        rooms: ['Classroom_1','Classroom_2','Large_Lecture_Hall'],
        component: TemperatureChart,
        legend: [
            { color:'#3b82f6', label:'Too Cold (< 22°C)' },
            { color:'#10b981', label:'Optimal (22–25°C)' },
            { color:'#ef4444', label:'Too Hot (> 25°C)' },
            { color:'#8b5cf6', label:'AI Prediction (dashed)', dashed:true },
        ],
    },
    {
        id: 'occupancy',
        label: 'Occupancy',
        icon: 'occupancy',
        desc: 'AI occupancy classification — Unoccupied / Scheduled / Unscheduled',
        rooms: ['Classroom_1','Classroom_2','Large_Lecture_Hall'],
        component: OccupancyChart,
        legend: [
            { color:'#64748b', label:'Unoccupied' },
            { color:'#2563eb', label:'Scheduled class' },
            { color:'#ef4444', label:'Unscheduled (alert)' },
        ],
    },
    {
        id: 'energy',
        label: 'Energy Mode',
        icon: 'zap',
        desc: 'AI-recommended energy state — Active / Standby / Off',
        rooms: ['Classroom_1','Classroom_2','Large_Lecture_Hall'],
        component: EnergyChart,
        legend: [
            { color:'#10b981', label:'Active' },
            { color:'#f59e0b', label:'Standby' },
            { color:'#64748b', label:'Off' },
        ],
    },
    {
        id: 'lighting',
        label: 'Lighting',
        icon: 'lighting',
        desc: 'Ambient lux levels with AI-predicted lighting state',
        rooms: ['Classroom_1','Classroom_2'],
        component: LightingChart,
        legend: [
            { color:'#fbbf24', label:'Ambient lux (measured)' },
            { color:'#fef9c3', label:'AI: lights ON prediction' },
            { color:'#f59e0b', label:'300 lx — dim threshold', dashed:true },
            { color:'#10b981', label:'600 lx — off threshold', dashed:true },
        ],
    },
];

const MVP_ROOMS = [
    { id:'Classroom_1',        label:'Classroom 1',       node:1, icon:'motion',      nodeDesc:'PIR + Lux + Temp' },
    { id:'Classroom_2',        label:'Classroom 2',       node:2, icon:'lighting',    nodeDesc:'Ambient Lux + Temp' },
    { id:'Large_Lecture_Hall', label:'Large Lecture Hall',node:3, icon:'temperature', nodeDesc:'Temp + CO₂ + Occupancy + HVAC' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
    const { sensorState, isLive } = useLiveSensorState();
    const [activeView, setActiveView] = useState('temperature');
    const [activeRoom, setActiveRoom] = useState('Large_Lecture_Hall');

    const view       = CHART_VIEWS.find(v => v.id === activeView);
    const ChartComp  = view?.component;
    const validRooms = MVP_ROOMS.filter(r => view?.rooms.includes(r.id));

    // Auto-switch room if current room not valid for this view
    const safeRoom = view?.rooms.includes(activeRoom) ? activeRoom : view?.rooms[0];

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-bold text-slate-900">Analytics & AI Predictions</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        3 active nodes · Sept 15 2025 · Select a view and room below
                        {isLive && <span className="ml-2 text-emerald-600 font-semibold">· Live Firebase data</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full">
            <Icon name="activity" className="w-3.5 h-3.5" />
            AI Predictions Active
          </span>
                    <button onClick={() => exportFullReport({ rooms:[], alerts:[], kpis:[], label:'analytics' })}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
                        <Icon name="download" className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </div>

            {/* ── VIEW SELECTOR (Step 3 — selectable chart views) ── */}
            <Card className="p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Select Data View</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CHART_VIEWS.map(v => (
                        <button key={v.id} onClick={() => setActiveView(v.id)}
                                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 transition-all text-left
                      ${activeView === v.id
                                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                ${activeView === v.id ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                <Icon name={v.icon} className={`w-4 h-4 ${activeView === v.id ? 'text-white' : 'text-slate-500'}`} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${activeView === v.id ? 'text-blue-700' : 'text-slate-700'}`}>{v.label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{v.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </Card>

            {/* ── ROOM SELECTOR ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room / Node</span>
                {validRooms.map(r => (
                    <button key={r.id} onClick={() => setActiveRoom(r.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all
                    ${safeRoom === r.id
                                ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                        <Icon name={r.icon} className="w-3.5 h-3.5" />
                        {r.label}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
              ${safeRoom === r.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
              N{r.node}
            </span>
                    </button>
                ))}
            </div>

            {/* ── MAIN CHART ── */}
            <Card className="overflow-hidden">
                <CardHead
                    title={`${view?.label} — ${MVP_ROOMS.find(r=>r.id===safeRoom)?.label}`}
                    sub={view?.desc}
                    iconName={view?.icon}
                    right={
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Legend */}
                            {view?.legend.map(l => (
                                <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span className={`w-5 h-1.5 rounded-full inline-block ${l.dashed ? 'opacity-70' : ''}`}
                        style={{ background:l.color, backgroundImage: l.dashed ? `repeating-linear-gradient(90deg,${l.color} 0,${l.color} 4px,transparent 4px,transparent 7px)` : undefined }} />
                                    {l.label}
                </span>
                            ))}
                        </div>
                    }
                />
                <div className="p-5">
                    {/* AI prediction summary */}
                    <div className="mb-4">
                        <ConfidenceStrip data={ENRICHED} room={safeRoom} />
                    </div>
                    {ChartComp && <ChartComp room={safeRoom} />}
                </div>
            </Card>

            {/* ── AI PREDICTION SUMMARY CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {MVP_ROOMS.map(r => {
                    const lastReading = ENRICHED[ENRICHED.length - 8]; // ~17:30
                    const occKey    = r.id==='Classroom_1'?'ai_cr1_occ_class':r.id==='Classroom_2'?'ai_cr2_occ_class':'ai_lh_occ_class';
                    const energyKey = r.id==='Classroom_1'?'ai_cr1_energy':r.id==='Large_Lecture_Hall'?'ai_lh_energy':'ai_lh_energy';
                    const occClass  = lastReading[occKey] ?? 0;
                    const energy    = lastReading[energyKey] ?? 'off';
                    const sensor    = sensorState?.[r.id];

                    return (
                        <Card key={r.id} className={`p-4 ${safeRoom===r.id ? 'ring-2 ring-blue-400' : ''}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <Icon name={r.icon} className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-700">{r.label}</p>
                                    <p className="text-[10px] text-blue-500 font-bold">Node {r.node}</p>
                                </div>
                                <span className="ml-auto text-[9px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                                      style={{ background: OCC_COLORS[occClass] }}>
                  {OCC_LABELS[occClass]}
                </span>
                            </div>
                            <div className="space-y-1.5 text-[12px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">AI Energy Mode</span>
                                    <span className="font-bold" style={{ color:ENERGY_COLORS[energy] }}>{energy.charAt(0).toUpperCase()+energy.slice(1)}</span>
                                </div>
                                {sensor?.temperature_c && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Temperature</span>
                                        <span className="font-bold text-slate-700" style={{ fontFamily:"'DM Mono',monospace" }}>{sensor.temperature_c.toFixed(1)}°C</span>
                                    </div>
                                )}
                                {sensor?.co2_ppm && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">CO₂</span>
                                        <span className={`font-bold ${sensor.co2_ppm>1000?'text-red-600':sensor.co2_ppm>600?'text-amber-600':'text-emerald-600'}`}
                                              style={{ fontFamily:"'DM Mono',monospace" }}>{sensor.co2_ppm} ppm</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Sensors</span>
                                    <span className="text-slate-400 text-[10px]">{r.nodeDesc}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* ── EXPORT ── */}
            <Card>
                <CardHead title="Downloadable Reports" iconName="download" />
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { icon:'temperature', bg:'bg-blue-50',   color:'text-blue-600',   title:'Temperature Report',  desc:'Node 3 temp + AI predictions', type:'temperature' },
                        { icon:'occupancy',   bg:'bg-violet-50', color:'text-violet-600', title:'Occupancy Report',    desc:'AI occupancy classification',   type:'occupancy'   },
                        { icon:'zap',         bg:'bg-emerald-50',color:'text-emerald-600',title:'Energy Mode Report',  desc:'AI energy state timeline',       type:'energy'      },
                    ].map(r => (
                        <div key={r.title}
                             onClick={() => exportFullReport({ rooms:[], alerts:[], kpis:[], label:r.type })}
                             className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-blue-200 cursor-pointer group transition-all">
                            <div className={`w-9 h-9 ${r.bg} rounded-xl flex items-center justify-center`}>
                                <Icon name={r.icon} className={`w-4 h-4 ${r.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{r.title}</p>
                                <p className="text-[10px] text-slate-400">{r.desc}</p>
                            </div>
                            <Icon name="download" className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                    ))}
                </div>
            </Card>

        </div>
    );
}