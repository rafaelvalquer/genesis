import { enemyBehavior } from "../enemyBehavior.js";
import { chapterFourState } from "./common.js";
import { FIELD } from "../../visualGeometry.js";
export const derivanteBehavior = enemyBehavior({ createState: (s, q, c) => ({ ...chapterFourState(s, q, c), derivanteAttackTargetId: null, derivanteBehavior: "hunting", derivanteCoverEnemyId: null, derivanteCoverTargetDistance: null, derivanteCoverLostAt: -Infinity, derivanteJumpReason: null, derivanteJumpSourceX: FIELD.spawnX, derivanteJumpTargetX: null, derivanteNextDodgeAt: s.elapsed + 1500, derivanteIncomingProjectileId: null, derivanteAttackApplied: false }), update: (r, e, c, dt, events) => (r.updateDerivante(e, c, dt, events), true) });
