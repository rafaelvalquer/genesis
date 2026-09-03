import { DECISION_STAGE_RULES } from "../content.js";

export function DecisionModal({ level, options, onChoose }) {
  const categories = { attack: "Ataque", defense: "Defesa", economy: "Economia", specialization: "Especialização" };
  const stage = DECISION_STAGE_RULES[level]?.label || "Decisão tática";
  return <div className="modal-backdrop"><div className="decision-modal"><span className="eyebrow amber">Decisão · {stage}</span><h2>Escolha uma vantagem tática</h2><p>Escolha obrigatória antes da próxima onda. A duração está indicada em cada efeito.</p><div className="decision-grid">{options.map((option) => <button key={option.id} onClick={() => onChoose(option)}><span className="decision-meta"><em>{categories[option.category]}</em><em>Poder {option.power}</em>{option.scope === "nextWave" && <em>Somente próxima onda</em>}</span><b>{option.label}</b><span>{option.description}</span></button>)}</div></div></div>;
}

export default DecisionModal;
