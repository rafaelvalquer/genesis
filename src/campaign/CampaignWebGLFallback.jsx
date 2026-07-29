import { getArenaUrl } from "../game/assetCatalog.js";

export default function CampaignWebGLFallback({
  chapter, phases, campaign, selectedPhase, onSelectPhase,
}) {
  return <section
    className="campaign-fallback"
    style={{ "--fallback-image": `url(${getArenaUrl(chapter.coverArenaId)})` }}
    aria-label={`Mapa bidimensional de ${chapter.name}`}
  >
    <div className="fallback-planet" aria-hidden="true" />
    <p className="fallback-notice">Visualização orbital 2D · WebGL 2 indisponível</p>
    <div className="fallback-markers">
      {phases.map((phase, localIndex) => {
        const index = Number(phase.id.slice(-2)) - 1;
        const locked = index > campaign.unlockedPhaseIndex;
        const angle = (-125 + localIndex * 36) * Math.PI / 180;
        return <button
          key={phase.id}
          type="button"
          disabled={locked}
          className={[
            selectedPhase?.id === phase.id && "is-selected",
            Number(campaign.phaseStats[phase.id]?.victories || 0) > 0 && "is-completed",
          ].filter(Boolean).join(" ")}
          style={{ left: `${50 + Math.cos(angle) * 37}%`, top: `${50 + Math.sin(angle) * 37}%` }}
          aria-label={`${phase.name}, fase ${index + 1}${locked ? ", bloqueada" : ""}`}
          onClick={() => onSelectPhase(phase)}
        >{locked ? "◆" : String(index + 1).padStart(2, "0")}</button>;
      })}
    </div>
  </section>;
}
