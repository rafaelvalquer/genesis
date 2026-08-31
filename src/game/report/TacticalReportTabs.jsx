import { useRef } from "react";
import { TacticalTabIcon } from "./icons/TacticalIcons.jsx";

const TABS = [
  { id: "overview", label: "Visão geral", group: "primary" }, { id: "troops", label: "Tropas", group: "primary" }, { id: "threats", label: "Ameaças", group: "primary" },
  { id: "routes", label: "Rotas", group: "investigation" }, { id: "timeline", label: "Linha do tempo", group: "investigation" },
];

export default function TacticalReportTabs({ activeTab, onChange }) {
  const refs = useRef([]);
  const onKeyDown = (event, index) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].id); refs.current[next]?.focus();
  };
  return <nav className="tactical-tabs" role="tablist" aria-label="Seções do relatório tático">{TABS.map((tab, index) => <button key={tab.id} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`tactical-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`tactical-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className={`${activeTab === tab.id ? "active" : ""} ${tab.group === "investigation" ? "tactical-tab-investigation" : ""}`} onClick={() => onChange(tab.id)} onKeyDown={(event) => onKeyDown(event, index)}><TacticalTabIcon id={tab.id} /><span>{tab.label}</span></button>)}</nav>;
}
