import ChapterProgressItem from "./ChapterProgressItem.jsx";
import CampaignOverviewStrip from "./CampaignOverviewStrip.jsx";

export default function ChapterProgress({ chapters, metrics, displayedChapter, onSelect, onPreview, reduceMotion }) {
  return <section className="chapter-progress command-module" aria-labelledby="chapter-progress-title">
    <header><h2 id="chapter-progress-title">PROGRESSO DA CAMPANHA</h2></header>
    <CampaignOverviewStrip metrics={metrics} />
    <div className="command-chapter-list" role="tablist" aria-label="Capítulos da campanha">
      {chapters.map((data) => <ChapterProgressItem
        key={data.chapter.id}
        data={data}
        selected={displayedChapter.id === data.chapter.id}
        onSelect={onSelect}
        onPreview={onPreview}
        reduceMotion={reduceMotion}
      />)}
    </div>
  </section>;
}
