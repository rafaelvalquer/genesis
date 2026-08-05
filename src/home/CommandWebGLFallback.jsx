import { getArenaUrl } from "../game/assets/arenaCatalog.js";

export default function CommandWebGLFallback({ chapter, phase }) {
  return <div className="command-globe-fallback">
    <img src={getArenaUrl(chapter.coverArenaId)} alt="" />
    <div className="command-css-planet" aria-hidden="true"><i /><i /></div>
    <div className="command-orbital-marker fallback-marker" aria-hidden="true">
      <span>{phase.boss ? "ALVO PRIORITÁRIO" : "SETOR ATIVO"}</span>
      <b>OPERAÇÃO {phase.id.slice(-2)}</b>
      <small>{phase.name}</small>
    </div>
  </div>;
}
