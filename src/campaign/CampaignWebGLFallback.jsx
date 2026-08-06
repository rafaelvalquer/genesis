import {
  getChapterForPhase,
  getPhaseIndex,
} from "../game/content.js";
import {
  getArenaUrl,
} from "../game/assets/arenaCatalog.js";
import {
  CAMPAIGN_PHASE_LOCATIONS,
} from "./campaignSceneData.js";

function fallbackPosition(phase) {
  const location = (
    CAMPAIGN_PHASE_LOCATIONS[phase.id]
  );

  if (!location) {
    return {
      left: "50%",
      top: "50%",
    };
  }

  const left = (
    50
    + location.longitude / 180 * 42
  );

  const top = (
    50
    - location.latitude / 90 * 39
  );

  return {
    left: `${Math.max(6, Math.min(94, left))}%`,
    top: `${Math.max(8, Math.min(92, top))}%`,
  };
}

export default function CampaignWebGLFallback({
  chapter,
  chapters,
  phases,
  campaign,
  selectedPhase,
  onSelectPhase,
}) {
  return (
    <section
      className="campaign-fallback campaign-fallback-all-chapters"
      style={{
        "--fallback-image": (
          `url(${getArenaUrl(
            chapter.coverArenaId,
          )})`
        ),
      }}
      aria-label="Mapa bidimensional de todos os capítulos"
    >
      <div
        className="fallback-planet"
        aria-hidden="true"
      />

      <p className="fallback-notice">
        Visualização orbital 2D · WebGL 2 indisponível
      </p>

      <div className="fallback-markers">
        {phases.map((phase) => {
          const index = getPhaseIndex(
            phase.id,
          );

          const phaseChapter = (
            getChapterForPhase(phase)
          );

          const chapterActive = (
            phaseChapter?.id === chapter.id
          );

          const chapterUnlocked = (
            phaseChapter
            && getPhaseIndex(
              phaseChapter.phaseIds[0],
            ) <= campaign.unlockedPhaseIndex
          );

          const locked = (
            index > campaign.unlockedPhaseIndex
          );

          const completed = (
            Number(
              campaign.phaseStats[
                phase.id
              ]?.victories || 0,
            ) > 0
          );

          return (
            <button
              key={phase.id}
              type="button"
              disabled={locked}
              className={[
                selectedPhase?.id === phase.id
                  && "is-selected",
                completed
                  && "is-completed",
                chapterActive
                  ? "is-chapter-active"
                  : "is-chapter-inactive",
                !chapterUnlocked
                  && "is-chapter-locked",
              ].filter(Boolean).join(" ")}
              style={{
                ...fallbackPosition(phase),
                "--fallback-marker-color": (
                  phaseChapter?.palette
                    ?.primary
                  || "#67e8f9"
                ),
              }}
              data-chapter-id={
                phaseChapter?.id
              }
              data-chapter-active={
                chapterActive
                  ? "true"
                  : "false"
              }
              aria-label={[
                phaseChapter?.name,
                phase.name,
                `fase ${index + 1}`,
                locked ? "bloqueada" : null,
              ].filter(Boolean).join(", ")}
              title={
                locked
                  ? "Setor bloqueado"
                  : `${phaseChapter?.name || "Capítulo"} · ${phase.name}`
              }
              onClick={() => (
                onSelectPhase(phase)
              )}
            >
              {locked
                ? "◆"
                : String(index + 1)
                  .padStart(2, "0")}
            </button>
          );
        })}
      </div>

      <div
        className="fallback-chapter-legend"
        aria-label="Capítulos do planeta"
      >
        {chapters.map((entry) => (
          <span
            key={entry.id}
            className={
              entry.id === chapter.id
                ? "active"
                : ""
            }
            style={{
              "--legend-color": (
                entry.palette.primary
              ),
            }}
          >
            {String(entry.number)
              .padStart(2, "0")}
          </span>
        ))}
      </div>
    </section>
  );
}
