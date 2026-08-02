import { enemyBehavior } from "../enemyBehavior.js";
import { chapterFourState } from "./common.js";
export const raizFulgorBehavior = enemyBehavior({ createState: chapterFourState, update: (r, e, c, dt, events) => (r.updateRaizFulgor(e, c, dt, events), true) });
