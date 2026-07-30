export default function CommandTransitionOverlay({ active }) {
  return <div className={`command-transition-overlay ${active ? "active" : ""}`} aria-hidden="true">
    <span>TRANSFERINDO CONTROLE PARA O MAPA ORBITAL</span>
  </div>;
}
