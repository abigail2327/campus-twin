import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * TemperatureChart - D3 Line Chart for Smart Campus Digital Twin
 *
 * FEATURES:
 * - Threshold-based coloring (blue < 22°C, teal 22-25°C, red > 25°C)
 * - Bold line when temperature exceeds comfort zone
 * - Responsive to container size
 * - Works with static CSV data or live Firebase stream
 *
 * PROPS:
 * @param {Array} data - Array of objects: [{timestamp, temp, room}, ...]
 * @param {string} room - Room name to filter (optional, shows all if not provided)
 * @param {number} width - Chart width (default: 800)
 * @param {number} height - Chart height (default: 400)
 */

const TemperatureChart = ({
                              data = [],
                              room = null,
                              width = 800,
                              height = 400
                          }) => {
    const svgRef = useRef();
    const [filteredData, setFilteredData] = useState([]);

    // Filter data by room if specified
    useEffect(() => {
        if (!data || data.length === 0) return;

        let processed = data;
        if (room) {
            processed = data.filter(d => d.room === room);
        }

        // Sort by timestamp
        processed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        setFilteredData(processed);
    }, [data, room]);

    useEffect(() => {
        if (!filteredData || filteredData.length === 0) return;

        // Clear previous chart
        d3.select(svgRef.current).selectAll('*').remove();

        // Margins
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(filteredData, d => new Date(d.timestamp)))
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([20, 28])
            .range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(8)
            .tickFormat(d3.timeFormat('%H:%M'));

        const yAxis = d3.axisLeft(yScale)
            .ticks(8)
            .tickFormat(d => `${d}°C`);

        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis)
            .style('color', '#64748b')
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        svg.append('g')
            .call(yAxis)
            .style('color', '#64748b');

        // Grid lines
        svg.append('g')
            .attr('class', 'grid')
            .attr('opacity', 0.1)
            .call(d3.axisLeft(yScale)
                .tickSize(-innerWidth)
                .tickFormat('')
            );

        // Comfort zone bands
        svg.append('rect')
            .attr('x', 0)
            .attr('y', yScale(25))
            .attr('width', innerWidth)
            .attr('height', yScale(22) - yScale(25))
            .attr('fill', '#00d4b4')
            .attr('opacity', 0.08);

        // Comfort zone labels
        svg.append('text')
            .attr('x', innerWidth - 10)
            .attr('y', yScale(25) - 5)
            .attr('text-anchor', 'end')
            .attr('font-size', '11px')
            .attr('fill', '#f43f5e')
            .text('Upper Comfort (25°C)');

        svg.append('text')
            .attr('x', innerWidth - 10)
            .attr('y', yScale(22) + 15)
            .attr('text-anchor', 'end')
            .attr('font-size', '11px')
            .attr('fill', '#3b82f6')
            .text('Lower Comfort (22°C)');

        // Line generator
        const line = d3.line()
            .x(d => xScale(new Date(d.timestamp)))
            .y(d => yScale(d.temperature_c))
            .curve(d3.curveMonotoneX);

        // Draw segments with threshold coloring
        for (let i = 0; i < filteredData.length - 1; i++) {
            const d1 = filteredData[i];
            const d2 = filteredData[i + 1];

            const segment = [d1, d2];
            const avgTemp = (d1.temperature_c + d2.temperature_c) / 2;

            // Determine color and stroke width based on temperature
            let color = '#00d4b4';  // Teal (optimal)
            let strokeWidth = 2;

            if (avgTemp < 22) {
                color = '#3b82f6';  // Blue (cold)
            } else if (avgTemp > 25) {
                color = '#f43f5e';  // Red (hot)
                strokeWidth = 4;     // Bold
            }

            svg.append('path')
                .datum(segment)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', strokeWidth)
                .attr('d', line);
        }

        // Add dots at data points
        svg.selectAll('.dot')
            .data(filteredData)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(new Date(d.timestamp)))
            .attr('cy', d => yScale(d.temperature_c))
            .attr('r', 3)
            .attr('fill', d => {
                if (d.temperature_c < 22) return '#3b82f6';
                if (d.temperature_c > 25) return '#f43f5e';
                return '#00d4b4';
            })
            .attr('opacity', 0.6);

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

        svg.selectAll('.dot')
            .on('mouseover', (event, d) => {
                const status = d.temperature_c < 22 ? 'TOO COLD' :
                    d.temperature_c > 25 ? 'TOO HOT' : 'Optimal';
                const statusColor = d.temperature_c < 22 ? '#3b82f6' :
                    d.temperature_c > 25 ? '#f43f5e' : '#00d4b4';

                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
          <strong style="color: #00d4b4">${d.room || 'Room'}</strong><br/>
          <strong>Time:</strong> ${new Date(d.timestamp).toLocaleTimeString()}<br/>
          <strong>Temp:</strong> ${d.temperature_c.toFixed(1)}°C<br/>
          <strong>Status:</strong> <span style="color: ${statusColor}">${status}</span>
        `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition().duration(200).style('opacity', 0);
            });

        // Cleanup
        return () => {
            tooltip.remove();
        };

    }, [filteredData, width, height]);

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
                marginBottom: '16px'
            }}>
                Temperature Trend {room && `— ${room.replace(/_/g, ' ')}`}
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default TemperatureChart;