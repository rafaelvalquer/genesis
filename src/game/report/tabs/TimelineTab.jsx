import { useRef, useState } from "react";
import { formatNumber, formatTimelineTime } from "../tacticalFormatters.js";

function TimelineChart({ timeline, valueKey, maxKey, label, selectedIndex, cursorTimeMs, onSelect, onCursor }) {
  const pendingCursor = useRef(null);
  const samples = timeline.samples || [];
  const width = 720; const height = 110;
  const duration = Math.max(1, timeline.durationMs || samples.at(-1)?.timeMs || 1);
  const maximum = maxKey ? Math.max(1, ...samples.map((sample) => sample[maxKey] || 0)) : Math.max(1, ...samples.map((sample) => sample[valueKey] || 0));
  const points = samples.map((sample) => `${sample.timeMs / duration * width},${height - (sample[valueKey] || 0) / maximum * (height - 16)}`).join(" ");
  const cursorX = cursorTimeMs == null ? null : cursorTimeMs / duration * width;
  const handleMove = (event) => {
    const svg = event.currentTarget; const ctm = svg.getScreenCTM();
    if (!samples.length || !ctm) return;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    const target = Math.max(0, Math.min(duration, transformed.x / width * duration));
    if (pendingCursor.current) cancelAnimationFrame(pendingCursor.current);
    pendingCursor.current = requestAnimationFrame(() => {
      onCursor(target);
      let nearest = 0;
      samples.forEach((sample, index) => { if (Math.abs(sample.timeMs - target) < Math.abs(samples[nearest].timeMs - target)) nearest = index; });
      onSelect(nearest);
    });
  };
  return <article className="timeline-chart"><header><b>{label}</b><span>{formatNumber(maximum)}</span></header><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} durante a batalha`} onPointerMove={handleMove} onPointerLeave={() => onCursor(null)}><line x1="0" y1={height - 1} x2={width} y2={height - 1} /><polyline points={points} />{cursorX != null && <line className="timeline-cursor" x1={cursorX} y1="0" x2={cursorX} y2={height} />}{(timeline.events || []).filter((event) => event.type === "wave_start" || event.type === "boss_start").map((event, index) => <g key={`${event.type}-${index}`}><line className="timeline-marker" x1={event.timeMs / duration * width} y1="0" x2={event.timeMs / duration * width} y2={height} /><text x={event.timeMs / duration * width + 4} y="12">{event.type === "boss_start" ? "BOSS" : `W${event.wave + 1}`}</text></g>)}</svg></article>;
}

export default function TimelineTab({ timeline = {} }) {
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [cursorTimeMs, setCursorTimeMs] = useState(null);
  const selected = timeline.samples?.[timelineIndex];
  return <div className="tactical-tab-content tactical-timeline"><div className="timeline-tooltip">{selected ? <><strong>{formatTimelineTime(selected.timeMs)} · W{selected.wave + 1}</strong><span>⚡ {formatNumber(selected.energy)}/{formatNumber(selected.energyMax)}</span><span>SUP {formatNumber(selected.supply)}/{formatNumber(selected.supplyMax)}</span><span>TROPAS {formatNumber(selected.activeTroops)}</span></> : "Sem amostras de telemetria"}</div><div className="timeline-chart-scroll"><div className="timeline-chart-canvas"><TimelineChart timeline={timeline} valueKey="energy" maxKey="energyMax" label="Energia" selectedIndex={timelineIndex} cursorTimeMs={cursorTimeMs} onSelect={setTimelineIndex} onCursor={setCursorTimeMs} /><TimelineChart timeline={timeline} valueKey="supply" maxKey="supplyMax" label="Supply" selectedIndex={timelineIndex} cursorTimeMs={cursorTimeMs} onSelect={setTimelineIndex} onCursor={setCursorTimeMs} /><TimelineChart timeline={timeline} valueKey="activeTroops" label="Tropas ativas" selectedIndex={timelineIndex} cursorTimeMs={cursorTimeMs} onSelect={setTimelineIndex} onCursor={setCursorTimeMs} /></div></div></div>;
}
