import { enemyBehavior } from "../enemyBehavior.js";

export const rasgaCeusCinereoBehavior = enemyBehavior({
  createState: (session, queued, config) => ({
    rasgaCeusState: "spawnFlight",
    flightAltitude: config.maximumFlightAltitude,
    maximumFlightAltitude: config.maximumFlightAltitude,
    cruiseAltitude: config.cruiseAltitude,
    groundRangedTargetable: false,
    diveTargetId: null,
    diveStartedAt: -Infinity,
    diveFromX: 0,
    diveFromAltitude: config.maximumFlightAltitude,
    diveTargetX: 0,
    diveTargetY: 0,
    nextDiveAt: session.elapsed + 3500 + Math.floor(session.rng() * 2000),
    strikeConsumed: false,
    rasgaCeusStateStartedAt: session.elapsed,
    rasgaCeusStateEndsAt: session.elapsed + 700,
  }),
  onSpawn: (session) => {
    session.metrics ??= {};
    session.metrics.rasgaCeusSpawned = (session.metrics.rasgaCeusSpawned || 0) + 1;
  },
  update: (runtime, enemy, config, dt, events) => (runtime.updateRasgaCeus(enemy, config, dt, events), true),
});
