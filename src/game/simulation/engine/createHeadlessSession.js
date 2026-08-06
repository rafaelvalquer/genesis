import {
  createBattleSession,
  validateLoadoutForPhase,
} from "../../battleModel.js";

export function createHeadlessSession({
  phase,
  loadout,
  seed,
  battleOptions = {},
}) {
  if (!phase) {
    throw new Error(
      "Fase obrigatória para a simulação.",
    );
  }

  const validation = (
    validateLoadoutForPhase(
      phase,
      loadout,
    )
  );

  if (!validation.ok) {
    throw new Error(
      `Loadout inválido para ${phase.id}: ${validation.reason}`,
    );
  }

  return createBattleSession(
    phase,
    validation.loadout,
    seed,
    {
      ...battleOptions,
      sandbox: false,
    },
  );
}
