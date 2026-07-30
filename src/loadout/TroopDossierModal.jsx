import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { getTroopInfo } from "../game/troopInfo.js";
import { getTroopPreviewUrl } from "../game/assetCatalog.js";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function TroopDossierModal({ troop, onClose, returnFocusRef, reduceMotion }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const { stats, specials } = getTroopInfo(troop);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return createPortal(<motion.div
    className="modal-backdrop troop-info-backdrop"
    initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
    animate={{ opacity: 1 }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <motion.section
      ref={dialogRef}
      className="troop-info-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`troop-info-title-${troop.id}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
    >
      <button ref={closeButtonRef} type="button" className="troop-info-close" aria-label={`Fechar informações de ${troop.label}`} onClick={onClose}>×</button>
      <div className="troop-info-portrait" style={{ "--troop-color": troop.color }}>
        <img src={getTroopPreviewUrl(troop.id)} alt={troop.label} />
        <span>{troop.role}</span>
      </div>
      <div className="troop-info-content">
        <span className="eyebrow">Dossiê da unidade</span>
        <h2 id={`troop-info-title-${troop.id}`}>{troop.label}</h2>
        {troop.title && <small className="unit-title">{troop.title}</small>}
        <p>{troop.description}</p>
        <dl className="troop-info-stats">{stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        {specials.length > 0 && <div className="troop-info-specials"><span className="eyebrow amber">Características especiais</span>
          <dl>{specials.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        </div>}
      </div>
    </motion.section>
  </motion.div>, document.body);
}
