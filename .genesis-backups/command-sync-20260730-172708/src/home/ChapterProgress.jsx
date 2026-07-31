import ChapterProgressItem from "./ChapterProgressItem.jsx";
import CampaignOverviewStrip from "./CampaignOverviewStrip.jsx";

export default function ChapterProgress({
  chapters,
  metrics,
  displayedChapter,
  onSelect,
  reduceMotion,
}) {
  const selectedData = chapters.find(
    (data) => data.chapter.id === displayedChapter.id,
  );

  return <section
    className="chapter-progress command-module"
    aria-labelledby="chapter-progress-title"
  >
    <header className="chapter-progress-header">
      <div>
        <h2 id="chapter-progress-title">PROGRESSO DA CAMPANHA</h2>
        <p>Selecione um capítulo para sincronizar o planeta, as missões e a inteligência lateral.</p>
      </div>
      <span aria-live="polite">
        CAPÍTULO {String(displayedChapter.number).padStart(2, "0")} ATIVO
      </span>
    </header>

    <CampaignOverviewStrip metrics={metrics} />

    <div
      className="command-chapter-list"
      role="tablist"
      aria-label="Capítulos da campanha"
    >
      {chapters.map((data) => (
        <ChapterProgressItem
          key={data.chapter.id}
          data={data}
          selected={displayedChapter.id === data.chapter.id}
          onSelect={onSelect}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>

    {selectedData && (
      <p className="chapter-progress-active-summary" aria-live="polite">
        <b>{selectedData.chapter.name}</b>
        <span>
          {selectedData.accessible} de {selectedData.total} operações acessíveis
          {" · "}
          {selectedData.completed} concluídas
        </span>
      </p>
    )}
  </section>;
}
