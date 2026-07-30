import { getArenaUrl } from "../game/assetCatalog.js";

export default function CommandWebGLFallback({ chapter, phase, onOpenMap }) {
  return <div className="command-globe-fallback">
    <img src={getArenaUrl(chapter.coverArenaId)} alt="" />
    <div className="command-css-planet" aria-hidden="true"><i /><i /></div>
    <button
      type="button"
      className="command-orbital-marker fallback-marker"
      title={`Abrir ${phase.name} no mapa orbital`}
      aria-label={`Operação ${phase.id.slice(-2)}, ${phase.name}. Abrir mapa orbital.`}
      onClick={onOpenMap}
    >
      <span>{phase.boss ? "ALVO PRIORITÁRIO" : "SETOR ATIVO"}</span>
      <b>OPERAÇÃO {phase.id.slice(-2)}</b>
      <small>{phase.name}</small>
    </button>
  </div>;
}
