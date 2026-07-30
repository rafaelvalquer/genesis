import { useEffect, useState } from "react";

export default function CommandHeader({ chapter, phase }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setTime(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);
  return <header className="command-header">
    <div>
      <span className="command-kicker">PONTE DE OBSERVAÇÃO // NÓ ORBITAL 01</span>
      <h1>COMANDO <em>ORBITAL</em></h1>
      <p>CAPÍTULO {String(chapter.number).padStart(2, "0")} · {chapter.name.toUpperCase()} <i /> OPERAÇÃO {phase.id.slice(-2)} · {phase.name.toUpperCase()}</p>
    </div>
    <div className="command-system-readout">
      <span><i /> SISTEMAS OPERACIONAIS</span>
      <b>{time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b>
      <small>SAVE LOCAL · LINK 98%</small>
    </div>
  </header>;
}
