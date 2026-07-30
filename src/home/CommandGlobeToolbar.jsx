import { Link } from "react-router-dom";

export default function CommandGlobeToolbar({ chapter, phase, previewing, onExplore }) {
  return <div className="command-globe-toolbar">
    <span>{previewing ? `PRÉ-VISUALIZAÇÃO · CAPÍTULO ${String(chapter.number).padStart(2, "0")}` : `CAPÍTULO ${String(chapter.number).padStart(2, "0")} · ${chapter.name}`}</span>
    <b>{phase.name}</b>
    <Link
      className="command-explore-map"
      to={`/fases?capitulo=${chapter.number}&fase=${phase.id}`}
      aria-label={`Explorar ${phase.name} no mapa da campanha`}
      onClick={onExplore}
    >EXPLORAR NO MAPA →</Link>
  </div>;
}
