// src/store/useZoneStore.js
import { create } from 'zustand'
import { ZONE_IDS } from '../config/zones'

const defaultZone = () => ({
    reported: {
        lux:       null,
        temp:      null,
        pir:       false,
        power:     null,
        fan_speed: null,
        timestamp: null,
    },
    desired: {
        light:     'off',
        fan_speed: 0,
    },
    status:      'unknown', // 'occupied' | 'empty' | 'alert' | 'unknown'
    lastUpdated: null,
})

export const useZoneStore = create((set, get) => ({
    // State
    zones:            Object.fromEntries(ZONE_IDS.map(id => [id, defaultZone()])),
    selectedZone:     null,
    activeFloor:      1,             // which floor the floor plan shows
    connectionStatus: 'disconnected',
    alerts:           [],            // system-wide alert list

    // Actions
    setSelectedZone:     (id)     => set({ selectedZone: id }),
    setActiveFloor:      (floor)  => set({ activeFloor: floor }),
    setConnectionStatus: (status) => set({ connectionStatus: status }),

    addAlert: (alert) => set(state => ({
        alerts: [{ ...alert, id: Date.now(), ts: new Date() }, ...state.alerts].slice(0, 50)
    })),

    updateReported: (zoneId, data) => set(state => ({
        zones: {
            ...state.zones,
            [zoneId]: {
                ...state.zones[zoneId],
                reported:    { ...state.zones[zoneId].reported, ...data },
                status:      data.pir ? 'occupied' : 'empty',
                lastUpdated: Date.now(),
            }
        }
    })),

    updateDesired: (zoneId, data) => set(state => ({
        zones: {
            ...state.zones,
            [zoneId]: {
                ...state.zones[zoneId],
                desired: { ...state.zones[zoneId].desired, ...data }
            }
        }
    })),

    // Derived helpers
    getTotalPower: () =>
        Object.values(get().zones)
            .reduce((sum, z) => sum + (z.reported.power ?? 0), 0),

    getOccupiedCount: () =>
        Object.values(get().zones)
            .filter(z => z.status === 'occupied').length,

    getAlertCount: () =>
        Object.values(get().zones)
            .filter(z => z.status === 'alert').length,
}))