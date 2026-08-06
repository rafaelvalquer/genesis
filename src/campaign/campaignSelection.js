import {
  CHAPTERS,
  getChapterForPhase,
  getPhase,
  getPhaseIndex,
  PHASES,
} from "../game/content.js";

export function isCampaignChapterUnlocked(
  chapter,
  unlockedPhaseIndex,
) {
  if (!chapter?.phaseIds?.length) {
    return false;
  }

  return (
    getPhaseIndex(chapter.phaseIds[0])
    <= unlockedPhaseIndex
  );
}

function getLatestAccessiblePhase(
  chapter,
  unlockedPhaseIndex,
) {
  return [...(chapter?.phaseIds || [])]
    .reverse()
    .map(getPhase)
    .find((phase) => (
      phase
      && getPhaseIndex(phase.id)
        <= unlockedPhaseIndex
    )) || null;
}

export function resolveCampaignSelection({
  searchParams,
  unlockedPhaseIndex,
}) {
  const safeUnlockedIndex = Math.max(
    0,
    Math.min(
      Number(unlockedPhaseIndex) || 0,
      PHASES.length - 1,
    ),
  );

  const currentPhase = (
    PHASES[safeUnlockedIndex]
    || PHASES[0]
  );

  const currentChapter = (
    getChapterForPhase(currentPhase)
    || CHAPTERS[0]
  );

  const requestedPhase = getPhase(
    searchParams?.get?.("fase"),
  );

  const requestedPhaseAccessible = Boolean(
    requestedPhase
    && getPhaseIndex(requestedPhase.id)
      <= safeUnlockedIndex,
  );

  const requestedPhaseChapter = (
    requestedPhaseAccessible
      ? getChapterForPhase(requestedPhase)
      : null
  );

  const requestedNumber = Number(
    searchParams?.get?.("capitulo"),
  );

  const requestedChapter = CHAPTERS.find(
    (chapter) => (
      chapter.number === requestedNumber
    ),
  );

  const activeChapter = (
    requestedPhaseChapter
    || (
      requestedChapter
      && isCampaignChapterUnlocked(
        requestedChapter,
        safeUnlockedIndex,
      )
        ? requestedChapter
        : currentChapter
    )
  );

  const selectedPhase = (
    requestedPhaseAccessible
    && requestedPhaseChapter?.id
      === activeChapter.id
      ? requestedPhase
      : getLatestAccessiblePhase(
        activeChapter,
        safeUnlockedIndex,
      )
  ) || getPhase(activeChapter.phaseIds[0]);

  return {
    activeChapter,
    selectedPhase,
    phases: PHASES,
    chapterPhases: activeChapter.phaseIds
      .map(getPhase)
      .filter(Boolean),
  };
}

export function createPhaseSelectionParams(
  searchParams,
  phase,
) {
  const chapter = getChapterForPhase(phase);

  if (!phase || !chapter) {
    return null;
  }

  const next = new URLSearchParams(
    searchParams,
  );

  next.set(
    "capitulo",
    String(chapter.number),
  );

  next.set(
    "fase",
    phase.id,
  );

  return next;
}

export function resolveChapterSelectionPhase({
  chapter,
  unlockedPhaseIndex,
  rememberedPhaseId,
}) {
  if (
    !isCampaignChapterUnlocked(
      chapter,
      unlockedPhaseIndex,
    )
  ) {
    return null;
  }

  const rememberedPhase = getPhase(
    rememberedPhaseId,
  );

  if (
    rememberedPhase
    && chapter.phaseIds.includes(
      rememberedPhase.id,
    )
    && getPhaseIndex(rememberedPhase.id)
      <= unlockedPhaseIndex
  ) {
    return rememberedPhase;
  }

  return getLatestAccessiblePhase(
    chapter,
    unlockedPhaseIndex,
  );
}
