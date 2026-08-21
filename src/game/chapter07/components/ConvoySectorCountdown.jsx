export default function ConvoySectorCountdown({ convoy }) {
  if (convoy?.state !== "sectorCountdown") return null;
  const remaining = Math.max(0, convoy.countdownRemainingMs ?? 2400);
  const count = Math.max(1, Math.min(3, Math.ceil(remaining / 800)));
  return <div className="convoy-sector-countdown" role="status" aria-live="assertive"><span>SETOR {convoy.sector}/4</span><strong>{count}</strong><small>AVANÇAR</small></div>;
}
