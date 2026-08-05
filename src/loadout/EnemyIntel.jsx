import { ENEMIES } from "../game/content.js";
import { getEnemyPreviewUrl } from "../game/assets/enemyPreviewCatalog.js";

export function deriveEnemyIntel(phase) {
  const records = new Map();
  phase.waves.forEach((wave, waveIndex) => {
    (wave.enemies || []).forEach((entry) => {
      const key = `${entry.type}:${entry.variant || ""}`;
      const current = records.get(key) || {
        id: entry.type,
        variant: entry.variant,
        count: 0,
        firstWave: waveIndex + 1,
        enemy: ENEMIES[entry.type],
      };
      current.count += Number(entry.count || 0);
      records.set(key, current);
    });
  });
  return [...records.values()].sort((left, right) => right.count - left.count);
}

export default function EnemyIntel({ phase }) {
  const intel = deriveEnemyIntel(phase);
  const visible = intel.slice(0, 5);
  return <section className="enemy-intel" aria-labelledby="enemy-intel-title">
    <h3 id="enemy-intel-title">Registros hostis</h3>
    <ul>{visible.map((entry) => <li key={`${entry.id}:${entry.variant || ""}`}>
      <img src={getEnemyPreviewUrl(entry.id)} alt="" />
      <span><b>{entry.enemy?.label || entry.id}</b><small>ONDA {entry.firstWave} · ≈ {entry.count} ALVOS</small></span>
      {(entry.enemy?.boss || entry.variant === "alpha") && <em>{entry.enemy?.boss ? "CHEFE" : "VARIANTE"}</em>}
    </li>)}</ul>
    {intel.length > 5 && <p>+{intel.length - 5} OUTROS REGISTROS</p>}
  </section>;
}
