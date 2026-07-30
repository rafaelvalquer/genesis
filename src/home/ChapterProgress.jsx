import ChapterProgressItem from "./ChapterProgressItem.jsx";

export default function ChapterProgress({ chapters, onOpen, onPreview, reduceMotion }) {
  return <section className="chapter-progress command-module" aria-labelledby="chapter-progress-title">
    <header><span className="command-kicker">VETORES DE AVANÇO</span><h2 id="chapter-progress-title">PROGRESSO DOS CAPÍTULOS</h2></header>
    <div className="command-chapter-list">
      {chapters.map((data) => <ChapterProgressItem key={data.chapter.id} data={data} onOpen={onOpen} onPreview={onPreview} reduceMotion={reduceMotion} />)}
    </div>
  </section>;
}
