import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * EnergyBarChart - D3 Bar Chart for Energy Consumption
 *
 * Shows average daily energy consumption per room with color-coded bars.
 *
 * PROPS:
 * @param {Array} data - Array of objects: [{room, energy_wh}, ...]
 * @param {number} width - Chart width (default: 800)
 * @param {number} height - Chart height (default: 400)
 */

const EnergyBarChart = ({
                            data = [],
                            width = 800,
                            height = 400
                        }) => {
    const svgRef = useRef();

    useEffect(() => {
        if (!data || data.length === 0) return;

        // Clear previous chart
        d3.select(svgRef.current).selectAll('*').remove();

        // Margins
        const margin = { top: 20, right: 30, bottom: 80, left: 80 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Color palette
        const colors = [
            '#00d4b4', '#3b82f6', '#f43f5e', '#f59e0b',
            '#a78bfa', '#34d399', '#fb923c', '#e879f9', '#94a3b8'
        ];

        // Scales
        const xScale = d3.scaleBand()
            .domain(data.map(d => d.room.replace(/_/g, ' ').replace('Large Lecture Hall', 'Lect Hall')))
            .range([0, innerWidth])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.energy_wh)])
            .range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale)
            .ticks(8)
            .tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(1)}k` : d);

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis)
            .style('color', '#64748b')
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '11px');

        svg.append('g')
            .call(yAxis)
            .style('color', '#64748b');

        // Y-axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -innerHeight / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .attr('fill', '#64748b')
            .attr('font-size', '12px')
            .text('Avg Daily Energy (Wh)');

        // Grid lines
        svg.append('g')
            .attr('class', 'grid')
            .attr('opacity', 0.1)
            .call(d3.axisLeft(yScale)
                .tickSize(-innerWidth)
                .tickFormat('')
            );

        // Bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.room.replace(/_/g, ' ').replace('Large Lecture Hall', 'Lect Hall')))
            .attr('y', innerHeight)  // Start from bottom for animation
            .attr('width', xScale.bandwidth())
            .attr('height', 0)
            .attr('fill', (d, i) => colors[i % colors.length])
            .attr('rx', 5)
            .transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr('y', d => yScale(d.energy_wh))
            .attr('height', d => innerHeight - yScale(d.energy_wh));

        // Tooltip
        const tooltip = d3.select('body')
            .append('div')
            .style('position', 'absolute')
            .style('background', '#0b0f1a')
            .style('border', '1px solid #1f2d45')
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('color', '#e2e8f0')
            .style('pointer-events', 'none')
            .style('opacity', 0);

        svg.selectAll('.bar')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.7);
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
          <strong style="color: #00d4b4">${d.room.replace(/_/g, ' ')}</strong><br/>
          <strong>Daily Energy:</strong> ${d.energy_wh.toLocaleString()} Wh<br/>
          <strong>Monthly:</strong> ${(d.energy_wh * 30 / 1000).toFixed(1)} kWh
        `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                tooltip.transition().duration(200).style('opacity', 0);
            });

        // Cleanup
        return () => {
            tooltip.remove();
        };

    }, [data, width, height]);

    return (
        <div style={{
            background: '#111827',
            border: '1px solid #1f2d45',
            borderRadius: '12px',
            padding: '24px'
        }}>
            <div style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#00d4b4',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '4px'
            }}>
                Daily Energy Consumption per Room
            </div>
            <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '20px'
            }}>
                Average Wh/day from synthetic telemetry — cube law fan modulation applied
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default EnergyBarChart;