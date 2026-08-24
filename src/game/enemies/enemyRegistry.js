import { GENERIC_ENEMY_BEHAVIOR } from "./enemyBehavior.js";
import { scarabEmperorBehavior } from "./chapter03/scarabEmperor.js";
import { workerQueenBehavior, workerQueenEggBehavior } from "./chapter03/workerQueen.js";
import { duneRipperBehavior } from "./chapter03/duneRipper.js";
import { voltrizBehavior } from "./chapter04/voltriz.js";
import { gorjalBehavior } from "./chapter04/gorjal.js";
import { nimbarcaBehavior } from "./chapter04/nimbarca.js";
import { derivanteBehavior } from "./chapter04/derivante.js";
import { raizFulgorBehavior } from "./chapter04/raizFulgor.js";
import { enguiaRasgamarBehavior } from "./chapter05/enguiaRasgamar.js";
import { mordelumeBehavior } from "./chapter05/mordelume.js";
import { carapacaNereidaBehavior } from "./chapter05/carapacaNereida.js";
import { medusaVeuSalinoBehavior } from "./chapter05/medusaVeuSalino.js";
import { leviathanNereidaBehavior } from "./chapter05/leviathanNereida.js";
import { salamandraCinereaBehavior } from "./salamandraCinerea.js";
import { rasgaCeusCinereoBehavior } from "./chapter06/rasgaCeusCinereo.js";
import { devoradorCaldeiraBehavior } from "./chapter06/devoradorCaldeira.js";
import { vermeIncubadorBehavior } from "./chapter06/vermeIncubador.js";
import { predadorCaldeiraBehavior } from "./chapter06/predadorCaldeira.js";
import { cuspidorBrasaBehavior } from "./chapter06/cuspidorBrasa.js";
import { colossoCaldeiraBehavior } from "./chapter06/colossoCaldeira.js";
import { macacoEsporosBehavior } from "./chapter07/macacoEsporos.js";

export const ENEMY_BEHAVIORS = Object.freeze({ scarabEmperor: scarabEmperorBehavior, workerQueen: workerQueenBehavior, workerQueenEgg: workerQueenEggBehavior, duneRipper: duneRipperBehavior, voltriz: voltrizBehavior, gorjal: gorjalBehavior, nimbarca: nimbarcaBehavior, derivante: derivanteBehavior, raizFulgor: raizFulgorBehavior, enguiaRasgamar: enguiaRasgamarBehavior, mordelume: mordelumeBehavior, carapacaNereida: carapacaNereidaBehavior, medusaVeuSalino: medusaVeuSalinoBehavior, leviathanNereida: leviathanNereidaBehavior, salamandraCinerea: salamandraCinereaBehavior, rasgaCeusCinereo: rasgaCeusCinereoBehavior, devoradorCaldeira: devoradorCaldeiraBehavior, vermeIncubador: vermeIncubadorBehavior, predadorCaldeira: predadorCaldeiraBehavior, cuspidorBrasa: cuspidorBrasaBehavior, colossoCaldeira: colossoCaldeiraBehavior, macacoEsporos: macacoEsporosBehavior });
export function getEnemyBehavior(type) { return ENEMY_BEHAVIORS[type] || GENERIC_ENEMY_BEHAVIOR; }
