/**
 * exportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all data exports for the SmartTwin dashboard.
 *
 * Security measures:
 *  - All values are sanitized before export to prevent CSV injection
 *    (formulas starting with =, +, -, @ are prefixed with a tab character)
 *  - Filenames are sanitized to prevent path traversal
 *  - Content-Type headers are explicitly set
 *  - No raw Firebase tokens or internal IDs are ever exported
 *
 * Phase 3 swap: replace the mock data passed in from each page with
 * live Firebase data — the export functions themselves never change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Security: sanitize a single cell value against CSV injection ──────────────
function sanitizeCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Prevent formula injection: prefix dangerous characters with a tab
    if (/^[=+\-@\t\r]/.test(str)) return `\t${str}`;
    return str;
}

// ── Build a CSV string from headers + rows ────────────────────────────────────
function buildCSV(headers, rows) {
    const escape = val => {
        const cell = sanitizeCell(val);
        // Wrap in quotes if contains comma, quote, or newline
        if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
        return cell;
    };

    const headerRow = headers.map(escape).join(',');
    const dataRows  = rows.map(row => headers.map(h => escape(row[h] ?? '')).join(','));
    return [headerRow, ...dataRows].join('\r\n');
}

// ── Trigger a browser download ────────────────────────────────────────────────
function triggerDownload(content, filename, mimeType) {
    // Sanitize filename — strip any path separators or dangerous chars
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_');

    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = safeFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after a short delay to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────
function nowStamp() {
    return new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function formatDate(date = new Date()) {
    return date.toLocaleString('en-AE', {
        timeZone:     'Asia/Dubai',
        year:         'numeric',
        month:        '2-digit',
        day:          '2-digit',
        hour:         '2-digit',
        minute:       '2-digit',
        hour12:       false,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT FUNCTIONS
// Each function accepts the data array directly — no coupling to data source.
// Phase 3: pass Firebase snapshot data instead of mock arrays.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export the event log from the Alerts page as CSV.
 * @param {Array} events  - Array of event log objects
 * @param {string} filter - Active filter label (for filename context)
 */
export function exportAlertLog(events, filter = 'All') {
    if (!events?.length) return;

    const headers = ['Timestamp', 'Level', 'Event', 'Source', 'Status'];

    const rows = events.map(e => ({
        Timestamp: sanitizeCell(e.ts),
        Level:     sanitizeCell(e.level),
        Event:     sanitizeCell(e.event),
        Source:    sanitizeCell(e.source),
        Status:    sanitizeCell(e.ack),
    }));

    const csv = buildCSV(headers, rows);
    triggerDownload(csv, `smarttwin_alerts_${filter}_${nowStamp()}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export room/zone sensor data as CSV.
 * @param {Array} rooms - Array of room objects
 */
export function exportRoomData(rooms) {
    if (!rooms?.length) return;

    const headers = ['Room ID', 'Name', 'Floor', 'Status', 'Temperature (°C)', 'Humidity (%)', 'CO2 (ppm)', 'Lighting', 'Occupancy', 'Capacity', 'Exported At'];

    const rows = rooms.map(r => ({
        'Room ID':            sanitizeCell(r.id),
        'Name':               sanitizeCell(r.name),
        'Floor':              sanitizeCell(r.floor),
        'Status':             sanitizeCell(r.status),
        'Temperature (°C)':   sanitizeCell(r.temp),
        'Humidity (%)':       sanitizeCell(r.humidity),
        'CO2 (ppm)':          sanitizeCell(r.co2),
        'Lighting':           sanitizeCell(r.lighting),
        'Occupancy':          sanitizeCell(r.occ),
        'Capacity':           sanitizeCell(r.cap),
        'Exported At':        formatDate(),
    }));

    const csv = buildCSV(headers, rows);
    triggerDownload(csv, `smarttwin_rooms_${nowStamp()}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export device twin data as CSV.
 * @param {Array} devices - Array of device objects
 */
export function exportDeviceData(devices) {
    if (!devices?.length) return;

    const headers = ['Device ID', 'Name', 'Type', 'Floor', 'Room', 'Status', 'Firmware', 'Battery (%)', 'Power Source', 'Exported At'];

    const rows = devices.map(d => ({
        'Device ID':      sanitizeCell(d.id),
        'Name':           sanitizeCell(d.name),
        'Type':           sanitizeCell(d.type),
        'Floor':          sanitizeCell(d.floor),
        'Room':           sanitizeCell(d.room),
        'Status':         sanitizeCell(d.status),
        'Firmware':       sanitizeCell(d.firmware),
        'Battery (%)':    d.battery !== null ? sanitizeCell(d.battery) : 'Mains',
        'Power Source':   sanitizeCell(d.power),
        'Exported At':    formatDate(),
    }));

    const csv = buildCSV(headers, rows);
    triggerDownload(csv, `smarttwin_devices_${nowStamp()}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export analytics energy data as CSV.
 * @param {Object} energyData - { labels, actual, forecast }
 * @param {string} range      - Time range label e.g. '30d'
 */
export function exportEnergyData(energyData, range = '30d') {
    if (!energyData?.labels?.length) return;

    const headers = ['Period', 'Actual (kWh)', 'Forecast (kWh)', 'Variance (kWh)', 'Exported At'];

    const rows = energyData.labels.map((label, i) => {
        const actual   = energyData.actual[i]   ?? 0;
        const forecast = energyData.forecast[i] ?? 0;
        return {
            'Period':           sanitizeCell(label),
            'Actual (kWh)':     sanitizeCell(actual),
            'Forecast (kWh)':   sanitizeCell(forecast),
            'Variance (kWh)':   sanitizeCell((actual - forecast).toFixed(2)),
            'Exported At':      formatDate(),
        };
    });

    const csv = buildCSV(headers, rows);
    triggerDownload(csv, `smarttwin_energy_${range}_${nowStamp()}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Generate a full building report as a structured CSV summary.
 * Includes rooms, active alerts, and a KPI summary block.
 * @param {Object} payload - { rooms, alerts, kpis, label }
 */
export function exportFullReport(payload) {
    const { rooms = [], alerts = [], kpis = [], label = 'full' } = payload;

    const lines = [];

    // Header block
    lines.push(`SmartTwin Campus Report`);
    lines.push(`Generated: ${formatDate()}`);
    lines.push(`Building: RIT Dubai — Dubai Silicon Oasis`);
    lines.push('');

    // KPI summary
    lines.push('--- KEY METRICS ---');
    lines.push('Metric,Value,Unit');
    kpis.forEach(k => lines.push(`${sanitizeCell(k.label)},${sanitizeCell(k.value)},${sanitizeCell(k.unit ?? '')}`));
    lines.push('');

    // Room data
    lines.push('--- ROOM SENSOR DATA ---');
    lines.push('Room ID,Name,Floor,Status,Temp (°C),Humidity (%),CO2 (ppm),Occupancy,Capacity');
    rooms.forEach(r => {
        lines.push([
            sanitizeCell(r.id),
            sanitizeCell(r.name),
            sanitizeCell(r.floor),
            sanitizeCell(r.status),
            sanitizeCell(r.temp),
            sanitizeCell(r.humidity),
            sanitizeCell(r.co2),
            sanitizeCell(r.occ),
            sanitizeCell(r.cap),
        ].join(','));
    });
    lines.push('');

    // Active alerts
    lines.push('--- ACTIVE ALERTS ---');
    lines.push('Severity,Title,Location,Time');
    alerts.forEach(a => {
        lines.push([
            sanitizeCell(a.severity),
            sanitizeCell(a.title),
            sanitizeCell(a.location),
            sanitizeCell(a.time ?? a.detected ?? ''),
        ].join(','));
    });

    const csv = lines.join('\r\n');
    triggerDownload(csv, `smarttwin_report_${label}_${nowStamp()}.csv`, 'text/csv;charset=utf-8;');
}