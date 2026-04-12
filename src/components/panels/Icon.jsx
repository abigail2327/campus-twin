// Shared icon library — all inline SVG, no emojis, consistent 20px stroke style
// Usage: <Icon name="temperature" className="w-4 h-4 text-slate-500" />

const PATHS = {
    // Navigation
    dashboard:    <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    building:     <><path d="M3 21h18M9 21V7l6-4v18M9 7H3v14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><path d="M13 21v-4h2v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    rooms:        <><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.5"/></>,
    device:       <><rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="1.5"/><path d="M12 18h.01" strokeLinecap="round" strokeWidth="2"/></>,
    alerts:       <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    analytics:    <><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    settings:     <><circle cx="12" cy="12" r="3" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.5"/></>,

    // Status & severity
    warning:      <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeWidth="2"/></>,
    critical:     <><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="2"/></>,
    info:         <><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeWidth="2"/></>,
    check:        <><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    x:            <><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeWidth="1.5"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth="1.5"/></>,
    shield:       <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,

    // Sensors & environment
    temperature:  <><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    humidity:     <><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    co2:          <><path d="M2 12h4M18 12h4M12 2v4M12 18v4" strokeLinecap="round" strokeWidth="1.5"/><circle cx="12" cy="12" r="6" strokeWidth="1.5"/><path d="M9 12a3 3 0 006 0" strokeLinecap="round" strokeWidth="1.5"/></>,
    occupancy:    <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><circle cx="9" cy="7" r="4" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    energy:       <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    water:        <><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    lighting:     <><circle cx="12" cy="12" r="5" strokeWidth="1.5"/><line x1="12" y1="1" x2="12" y2="3" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="21" x2="12" y2="23" strokeLinecap="round" strokeWidth="1.5"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" strokeLinecap="round" strokeWidth="1.5"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" strokeLinecap="round" strokeWidth="1.5"/><line x1="1" y1="12" x2="3" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="21" y1="12" x2="23" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" strokeLinecap="round" strokeWidth="1.5"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" strokeLinecap="round" strokeWidth="1.5"/></>,
    hvac:         <><path d="M12 3v1M12 20v1M3 12h1M20 12h1" strokeLinecap="round" strokeWidth="1.5"/><path d="M12 8a4 4 0 100 8 4 4 0 000-8z" strokeWidth="1.5"/><path d="M12 8V3M12 21v-4M8 12H3M21 12h-4" strokeLinecap="round" strokeWidth="1.5"/><path d="M9.17 9.17L5.64 5.64M18.36 18.36l-3.54-3.54M14.83 9.17l3.53-3.53M5.64 18.36l3.53-3.53" strokeLinecap="round" strokeWidth="1.5"/></>,
    fire:         <><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    motion:       <><circle cx="12" cy="12" r="2" strokeWidth="1.5"/><path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14" strokeLinecap="round" strokeWidth="1.5"/></>,

    // Devices
    sensor:       <><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" strokeWidth="1.5"/><path d="M12 6a6 6 0 100 12A6 6 0 0012 6z" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" strokeWidth="1.5"/></>,
    camera:       <><path d="M23 7l-7 5 7 5V7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><rect x="1" y="5" width="15" height="14" rx="2" strokeWidth="1.5"/></>,
    lock:         <><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    unlock:       <><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 019.9-1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    wifi:         <><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><line x1="12" y1="20" x2="12.01" y2="20" strokeLinecap="round" strokeWidth="2"/></>,
    battery:      <><rect x="2" y="7" width="16" height="10" rx="2" strokeWidth="1.5"/><path d="M22 11v2" strokeLinecap="round" strokeWidth="2"/></>,
    power:        <><path d="M18.36 6.64a9 9 0 11-12.73 0" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="2" x2="12" y2="12" strokeLinecap="round" strokeWidth="1.5"/></>,
    cpu:          <><rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" strokeWidth="1.5"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" strokeLinecap="round" strokeWidth="1.5"/></>,

    // Actions
    search:       <><circle cx="11" cy="11" r="8" strokeWidth="1.5"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeWidth="1.5"/></>,
    filter:       <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    download:     <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    upload:       <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    refresh:      <><polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    edit:         <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    trash:        <><polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    eye:          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" strokeWidth="1.5"/></>,
    plus:         <><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeWidth="1.5"/><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeWidth="1.5"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    chevronLeft:  <><polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    moreVertical: <><circle cx="12" cy="5" r="1" strokeWidth="2"/><circle cx="12" cy="12" r="1" strokeWidth="2"/><circle cx="12" cy="19" r="1" strokeWidth="2"/></>,
    externalLink: <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    copy:         <><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    share:        <><circle cx="18" cy="5" r="3" strokeWidth="1.5"/><circle cx="6" cy="12" r="3" strokeWidth="1.5"/><circle cx="18" cy="19" r="3" strokeWidth="1.5"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeLinecap="round" strokeWidth="1.5"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeLinecap="round" strokeWidth="1.5"/></>,
    phone:        <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    mail:         <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeWidth="1.5"/><polyline points="22 6 12 13 2 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    key:          <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    logout:       <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    user:         <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><circle cx="12" cy="7" r="4" strokeWidth="1.5"/></>,
    webhook:      <><path d="M18 16.98h-5.99c-1.1 0-1.95.68-2.23 1.61A7 7 0 003 15c0-3.87 3.13-7 7-7 .97 0 1.9.19 2.75.54M8 22l-1-4M21 8l-1-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><path d="M12 10V4L8 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    cloud:        <><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    zap:          <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    calendar:     <><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.5"/><line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeWidth="1.5"/><line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeWidth="1.5"/><line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeWidth="1.5"/></>,
    clock:        <><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    activity:     <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    map:          <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><line x1="8" y1="2" x2="8" y2="18" strokeLinecap="round" strokeWidth="1.5"/><line x1="16" y1="6" x2="16" y2="22" strokeLinecap="round" strokeWidth="1.5"/></>,
    layers:       <><polygon points="12 2 2 7 12 12 22 7 12 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><polyline points="2 17 12 22 22 17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><polyline points="2 12 12 17 22 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    sliders:      <><line x1="4" y1="21" x2="4" y2="14" strokeLinecap="round" strokeWidth="1.5"/><line x1="4" y1="10" x2="4" y2="3" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="21" x2="12" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="8" x2="12" y2="3" strokeLinecap="round" strokeWidth="1.5"/><line x1="20" y1="21" x2="20" y2="16" strokeLinecap="round" strokeWidth="1.5"/><line x1="20" y1="12" x2="20" y2="3" strokeLinecap="round" strokeWidth="1.5"/><line x1="1" y1="14" x2="7" y2="14" strokeLinecap="round" strokeWidth="1.5"/><line x1="9" y1="8" x2="15" y2="8" strokeLinecap="round" strokeWidth="1.5"/><line x1="17" y1="16" x2="23" y2="16" strokeLinecap="round" strokeWidth="1.5"/></>,
    trendUp:      <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    trendDown:    <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/><polyline points="17 18 23 18 23 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></>,
    exclamation:  <><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeWidth="1.5"/><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="2"/></>,
};

export function Icon({ name, className = 'w-4 h-4' }) {
    const paths = PATHS[name];
    if (!paths) return null;
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {paths}
        </svg>
    );
}

export default Icon;