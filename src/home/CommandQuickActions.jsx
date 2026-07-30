import { motion } from "motion/react";
import { Link } from "react-router-dom";

export default function CommandQuickActions({ onReset, reduceMotion }) {
  return <section className="command-quick-actions command-module" aria-label="Ações rápidas">
    <header><span className="command-kicker">SUBSISTEMAS</span><h2>ACESSO RÁPIDO</h2></header>
    <nav>
      {[
        ["/fases", "◇", "CAMPANHA"],
        ["/enciclopedia", "▦", "ENCICLOPÉDIA"],
        ["/configuracoes", "⌁", "CONFIGURAÇÕES"],
        ["/testes", "△", "CAMPO DE TESTES"],
      ].map(([to, glyph, label]) => <motion.div key={to} whileHover={reduceMotion ? undefined : { x: 2 }}>
        <Link to={to}><span>{glyph}</span>{label}</Link>
      </motion.div>)}
    </nav>
    <details className="command-maintenance">
      <summary>MANUTENÇÃO DO SISTEMA</summary>
      <p>O progresso está salvo somente neste dispositivo.</p>
      <button type="button" onClick={onReset}>APAGAR PROGRESSO LOCAL</button>
    </details>
  </section>;
}
