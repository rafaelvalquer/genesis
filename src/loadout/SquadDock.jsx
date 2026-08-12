import { AnimatePresence, motion } from "motion/react";
import SquadSlot from "./SquadSlot.jsx";

export default function SquadDock({ troops, limit, onRemove, reduceMotion, capacityPulse, canConfirm, confirming, onConfirm }) {
  const slots = Array.from({ length: limit }, (_, index) => troops[index] || null);
  return <motion.section layout className={`squad-dock ${capacityPulse ? "capacity-pulse" : ""}`} aria-labelledby="squad-dock-title">
    <header><span><span className="eyebrow">ORDEM DE IMPLANTAÇÃO</span><h2 id="squad-dock-title">Esquadrão</h2></span><b>{troops.length} DE {limit}</b></header>
    <ol>
      <AnimatePresence initial={false} mode="popLayout">
        {slots.map((troop, index) => <SquadSlot
          key={troop?.id || `empty-${index}`}
          troop={troop}
          index={index}
          onRemove={onRemove}
          reduceMotion={reduceMotion}
        />)}
      </AnimatePresence>
    </ol><button type="button" className="primary-button squad-start-button" aria-label={confirming ? "CONFIRMAR LOADOUT · esquadrão sincronizado" : "CONFIRMAR LOADOUT · iniciar missão"} disabled={!canConfirm || confirming} onClick={onConfirm}>{confirming ? "ESQUADRÃO SINCRONIZADO" : "INICIAR MISSÃO"} <span>→</span></button>
  </motion.section>;
}
