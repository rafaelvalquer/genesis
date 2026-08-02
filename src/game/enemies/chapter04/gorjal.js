import { enemyBehavior } from "../enemyBehavior.js";
import { chapterFourState } from "./common.js";
import { CELL, FIELD } from "../../visualGeometry.js";
export const gorjalBehavior = enemyBehavior({ createState: (s, q, c) => ({ ...chapterFourState(s, q, c), gorjalAttackTargetId: null, gorjalChargeTargetId: null, gorjalLastChargedTroopId: null, gorjalChargeEndX: Math.max(FIELD.baseX, FIELD.spawnX - c.initialChargeMaxTiles * CELL.width), gorjalChargeCooldownStartedAt: null, gorjalInitialCharge: c.initialChargeOnSpawn !== false, gorjalInitialChargeCompleted: false, gorjalInitialChargeStartedEventSent: false }), update: (r, e, c, dt, events) => (r.updateGorjal(e, c, dt, events), true) });
