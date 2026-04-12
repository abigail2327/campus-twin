export const dittoClient = {
    connect:      () => console.log('[STUB] Ditto connect'),
    patchDesired: (zoneId, patch) => console.log('[STUB] Ditto patch', zoneId, patch),
    disconnect:   () => {},
}
