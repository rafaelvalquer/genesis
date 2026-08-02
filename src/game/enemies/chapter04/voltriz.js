import { enemyBehavior } from "../enemyBehavior.js";
import { chapterFourState } from "./common.js";
export const voltrizBehavior = enemyBehavior({ createState: (s, q, c) => ({ ...chapterFourState(s, q, c), voltrizTargetId: null }), update: (r, e, c, dt, events) => (r.updateVoltriz(e, c, dt, events), true) });
