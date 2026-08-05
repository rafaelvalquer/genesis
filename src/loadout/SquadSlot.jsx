import { motion } from "motion/react";
import { getTroopPreviewUrl } from "../game/assets/troopPreviewCatalog.js";

export default function SquadSlot({ troop, index, onRemove, reduceMotion }) {
  if (!troop) return <motion.li layout className="squad-slot empty" aria-label={`Slot ${index + 1} vazio`}>
    <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
    <span className="empty-capsule" aria-hidden="true">◇</span>
    <span><b>AGUARDANDO</b><small>Cápsula livre</small></span>
  </motion.li>;
  return <motion.li
    layout
    className="squad-slot occupied"
    style={{ "--troop-color": troop.color }}
    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: .86 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: .72 }}
    transition={{ type: "spring", stiffness: 330, damping: 28 }}
  >
    <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
    <img src={getTroopPreviewUrl(troop.id)} alt="" />
    <span><b>{troop.label}</b><small>{troop.role}</small></span>
    <button type="button" aria-label={`Remover ${troop.label} do slot ${index + 1}`} onClick={() => onRemove(troop.id)}>×</button>
  </motion.li>;
}
