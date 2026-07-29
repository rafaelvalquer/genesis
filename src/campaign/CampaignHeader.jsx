import { motion } from "motion/react";
import { PHASES } from "../game/content.js";

export default function CampaignHeader({ campaign, chapter }) {
  const victories = Object.values(campaign.phaseStats).filter((stats) => Number(stats.victories || 0) > 0).length;
  const accessible = Math.min(PHASES.length, campaign.unlockedPhaseIndex + 1);
  return <header className="campaign-header">
    <div className="campaign-heading">
      <span className="eyebrow">COMANDO ORBITAL // CARTOGRAFIA TÁTICA</span>
      <h1>Mapa de Operações</h1>
      <p>Arraste para girar <i>•</i> roda para aproximar <i>•</i> setas para navegar</p>
    </div>
    <div className="campaign-overview">
      <motion.div key={victories} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
        <strong>{victories}<small>/{PHASES.length}</small></strong><span>operações<br />concluídas</span>
      </motion.div>
      <div><strong>{accessible}</strong><span>setores<br />acessíveis</span></div>
      <div><small>CAPÍTULO ATUAL</small><b>{String(chapter.number).padStart(2, "0")} · {chapter.name}</b></div>
    </div>
  </header>;
}
