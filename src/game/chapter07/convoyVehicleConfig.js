export const CONVOY_VEHICLES = Object.freeze([
  "tr7_pioneiro", "tr7r_peregrino", "tr7a_bastilha", "tr7f_ferrum",
  "tr9_atlas", "tr9p_vertice", "tr9s_sobrevivente", "trx_exodo",
]);

export const CONVOY_VEHICLE_BY_PHASE = Object.freeze(Object.fromEntries(
  CONVOY_VEHICLES.map((vehicleId, index) => [`fase_${49 + index}`, vehicleId]),
));

export function getConvoyVehicleId(phase) {
  return phase?.convoy?.vehicleId || CONVOY_VEHICLE_BY_PHASE[phase?.id] || CONVOY_VEHICLES[0];
}
