// src/config/zones.js
export const FLOORS = {
    1: {
        label: 'Floor 1',
        zones: [
            { id: 'lobby',         label: 'Lobby / Reception',  floor: 1 },
            { id: 'classroom-1',   label: 'Classroom 1',         floor: 1 },
            { id: 'classroom-2',   label: 'Classroom 2',         floor: 1 },
            { id: 'lecture-hall',  label: 'Large Lecture Hall',  floor: 1 },
        ]
    },
    2: {
        label: 'Floor 2',
        zones: [
            { id: 'lounge',          label: 'Lounge / Study Area', floor: 2 },
            { id: 'computer-lab',    label: 'Computer Lab',         floor: 2 },
            { id: 'faculty-office',  label: 'Faculty Office',       floor: 2 },
            { id: 'control-room',    label: 'Control Room',         floor: 2 },
            { id: 'mechanical-room', label: 'Mechanical Room',      floor: 2 },
        ]
    }
}

export const ZONES     = [...FLOORS[1].zones, ...FLOORS[2].zones]
export const ZONE_IDS  = ZONES.map(z => z.id)