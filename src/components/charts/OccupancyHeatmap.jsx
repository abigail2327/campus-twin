import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * OccupancyHeatmap - D3 Heatmap for Occupancy Patterns
 *
 * Shows occupancy % by room × hour with color intensity.
 *
 * PROPS:
 * @param {Object} data - Object with room names as keys, each containing array of 24 hourly values
 *   Example: { "Classroom_1": [1.1, 1.3, ..., 1.8], "Classroom_2": [...], ... }
 * @param {number} width - Chart width (default: 1200)
 * @param {number} height - Chart height (default: 400)
 */

const OccupancyHeatmap = ({
                              data = {},
                              width = 1200,
                              height = 400
                          }) => {
    const svgRef = useRef();

    useEffect(() => {
        if (!data || Object.keys(data).length === 0) return;

        // Clear previous chart
        d3.select(svgRef.current).selectAll('*').remove();

        const rooms = Object.keys(data);
        const hours = Array.from({ length: 24 }, (_, i) => i);

        // Margins
        const margin = { top: 40, right: 30, bottom: 30, left: 140 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleBand()
            .domain(hours)
            .range([0, innerWidth])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(rooms)
            .range([0, innerHeight])
            .padding(0.1);

        // Color scale (teal gradient)
        const colorScale = d3.scaleSequential()
            .domain([0, 100])
            .interpolator(d3.interpolateRgb('#111827', '#00d4b4'));

        // Axes
        const xAxis = d3.axisTop(xScale)
            .tickValues(hours.filter(h => h % 3 === 0))
            .tickFormat(d => `${String(d).padStart(2, '0')}:00`);

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => d.replace(/_/g, ' ').replace('Large Lecture Hall', 'Lect Hall'));

        svg.append('g')
            .call(xAxis)
            .style('color', '#64748b')
            .style('font-size', '10px');

        svg.append('g')
            .call(yAxis)
            .style('color', '#64748b')
            .style('font-size', '10px');

        // Create cells
        rooms.forEach(room => {
            const roomData = data[room];

            hours.forEach((hour, i) => {
                const value = roomData[i] || 0;

                svg.append('rect')
                    .attr('x', xScale(hour))
                    .attr('y', yScale(room))
                    .attr('width', xScale.bandwidth())
                    .attr('height', yScale.bandwidth())
                    .attr('fill', colorScale(value))
                    .attr('stroke', '#0b0f1a')
                    .attr('stroke-width', 1)
                    .attr('rx', 2)
                    .style('cursor', 'pointer')
                    .on('mouseover', function(event) {
                        d3.select(this).attr('opacity', 0.7);

                        tooltip.transition().duration(200).style('opacity', 1);
                        tooltip.html(`
              <strong style="color: #00d4b4">${room.replace(/_/g, ' ')}</strong><br/>
              <strong>Hour:</strong> ${String(hour).padStart(2, '0')}:00<br/>
              <strong>Occupancy:</strong> ${value.toFixed(1)}%
            `)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 28) + 'px');
                    })
                    .on('mouseout', function() {
                        d3.select(this).attr('opacity', 1);
                        tooltip.transition().duration(200).style('opacity', 0);
                    });
            });
        });

        // Legend
        const legendWidth = 300;
        const legendHeight = 20;

        const legendScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickFormat(d => `${d}%`);

        const legend = svg.append('g')
            .attr('transform', `translate(${innerWidth - legendWidth}, ${-30})`);

        // Gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'heatmap-gradient');

        gradient.selectAll('stop')
            .data([
                { offset: '0%', color: '#111827' },
                { offset: '50%', color: 'rgba(0,212,180,0.5)' },
                { offset: '100%', color: '#00d4b4' }
            ])
            .enter()
            .append('stop')
            .attr('offset', d => d.offset)
            .attr('stop-color', d => d.color);

        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#heatmap-gradient)');

        legend.append('g')
            .attr('transform', `translate(0, ${legendHeight})`)
            .call(legendAxis)
            .style('color', '#64748b')
            .style('font-size', '10px');

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
            padding: '24px',
            overflowX: 'auto'
        }}>
            <div style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#00d4b4',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '4px'
            }}>
                Occupancy % by Room × Hour (Weekdays)
            </div>
            <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '20px'
            }}>
                Darker teal = higher occupancy · class schedule patterns clearly visible per room
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default OccupancyHeatmap;