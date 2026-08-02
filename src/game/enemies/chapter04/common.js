export function chapterFourState(session, queued, config) {
  const type = queued.type;
  return {
    chapterFourState: type === "gorjal" ? "charge" : type === "voltriz" || type === "nimbarca" ? "flying" : "walking",
    chapterFourStateStartedAt: session.elapsed, chapterFourStateEndsAt: Infinity, chapterFourActionApplied: false,
    stunnedStartedAt: -Infinity, nextSpecialAt: type === "gorjal" ? Infinity : type === "derivante" ? session.elapsed + config.breachCheckEveryMs : type === "nimbarca" ? session.elapsed + (queued.variant === "alpha" ? 7000 : config.resonancePulseEveryMs) : Infinity,
    rooted: false, raizTargetLostAt: type === "raizFulgor" ? null : undefined, blockedSince: null,
    jumpSourceRow: null, jumpSourceY: null, jumpTargetRow: null, jumpTargetY: null, electricAttackTargetId: null,
  };
}
