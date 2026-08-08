export default function SquadAnalysis({ troops }) {
  const roles = new Set(troops.map((troop) => troop.role));
  const has = (predicate) => troops.some(predicate);
  const entries = [
    ["LINHA DE FRENTE", has((troop) => troop.tags?.includes("frontline"))],
    ["GERAÇÃO DE ENERGIA", has((troop) => troop.attack === "energy")],
    ["LONGO ALCANCE", has((troop) => troop.range >= 6)],
    ["CAPACIDADE ANTIAÉREA", has((troop) => /aéreo|antiaérea/i.test(troop.role) || troop.airborneDamageFactor)],
  ];
  return <section className="squad-analysis" aria-label="Análise objetiva do esquadrão">
    <h3>Análise da formação</h3>
    <ul>{entries.map(([label, present]) => <li key={label} className={present ? "present" : ""}>{label} {present ? "PRESENTE" : "AUSENTE"}</li>)}</ul>
    <p>{roles.size} FUNÇÕES TÁTICAS · {troops.reduce((sum, troop) => sum + troop.supply, 0)} SUPPLY POR CICLO</p>
  </section>;
}
