import { enemyBehavior } from "../enemyBehavior.js";
import { chapterFourState } from "./common.js";
export const nimbarcaBehavior = enemyBehavior({ createState: (s, q, c) => ({ ...chapterFourState(s, q, c), nimbarcaAttackTargetId: null }), update: (r, e, c, dt, events) => (r.updateNimbarca(e, c, dt, events), true) });
