export function calculateConvoyStars({ outcome, convoyHp, convoyMaxHp, durationMs, targetDurationMs }) {
  if (outcome !== "victory") return 0;
  const integrity = convoyMaxHp > 0 ? convoyHp / convoyMaxHp * 100 : 0;
  return 1 + Number(integrity >= 70) + Number(integrity >= 40 && durationMs <= targetDurationMs);
}
