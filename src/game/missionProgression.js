export const getProgressionKind = (phase) => phase?.progressionMode === "convoy" ? "convoy" : "waves";
export const getMissionEncounters = (phase) => getProgressionKind(phase) === "convoy" ? phase?.sectors || [] : phase?.waves || [];
export const getMissionEncounterCount = (phase) => getMissionEncounters(phase).length;
export const getProgressionLabel = (phase) => getProgressionKind(phase) === "convoy" ? "Setores" : "Ondas";
export const getEncounterLabel = (phase, index) => `${getProgressionKind(phase) === "convoy" ? "SETOR" : "ONDA"} ${index + 1}`;

export function createLegacyWaveViewForSector(sector) {
  return {
    id: sector.id,
    enemies: (sector.openingPackets || []).flatMap((packet) => packet.units || []),
    spawnWindowMs: Math.max(0, ...(sector.openingPackets || []).map((packet) => packet.atMs || 0)),
    coordinated: true,
    sectorAdapter: true,
  };
}
