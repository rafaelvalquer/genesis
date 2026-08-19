import { useEffect, useMemo, useRef, useState } from "react";
import { getEnemyCatalogEntries, TROOPS } from "../game/content.js";
import { loadAnimationEntity, releaseAnimationEntityAssets } from "./animationLabAssetLoader.js";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const labelFor = (state) => state.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
const troopEntries = Object.values(TROOPS);

function timingFor(asset, state, frames) {
  const entity = asset?.entity || {};
  const manifestAnimation = asset?.manifest?.animations?.[state];
  const visual = entity[`${state}Visual`] || (state === "idle" ? entity.idleVisual : null) || entity.attackVisual || entity.deathVisual;
  const frameMs = manifestAnimation?.frameMs || visual?.frameMs || (visual?.durationMs && frames ? visual.durationMs / frames : 120);
  const durationMs = manifestAnimation?.frames && manifestAnimation.frameMs ? manifestAnimation.frames * manifestAnimation.frameMs : visual?.durationMs || frameMs * Math.max(1, frames);
  const impactFrame = manifestAnimation?.impactFrame ?? entity.attackImpactFrame?.[state.replace(/Attack$/, "").replace("rift", "rift")] ?? visual?.releaseFrame ?? null;
  const impactMs = manifestAnimation?.impactMs ?? entity.attackImpactMs?.[state.replace(/Attack$/, "").replace("rift", "rift")] ?? visual?.impactMs ?? null;
  return { frameMs, durationMs, impactFrame, impactMs };
}

function frameAnchor(asset, state, frame) {
  const manifest = asset?.manifest;
  const visual = asset?.entity?.[`${state}Visual`] || asset?.entity?.attackVisual;
  return manifest?.frameAnchors?.[state]?.[frame]
    || visual?.frameAnchors?.[state]?.[frame]
    || manifest?.anchor
    || { x: 0.5, y: 1, scale: 1 };
}

// The Colosso is anchored close to its feet. Some attack poses legitimately
// occupy much more vertical space, so applying their game scale blindly in a
// fixed 768px preview can crop the head or raised fist. Fit the already-scaled
// image into the preview with a small safety margin; this never distorts it.
function previewScaleForImage(image, anchor, requestedScale) {
  if (!image || typeof document === "undefined") return requestedScale;
  const scratch = document.createElement("canvas"); scratch.width = scratch.height = 768;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return requestedScale;
  context.drawImage(image, 0, 0, 768, 768);
  const pixels = context.getImageData(0, 0, 768, 768).data;
  let minX = 768; let minY = 768; let maxX = -1; let maxY = -1;
  for (let y = 0; y < 768; y += 1) for (let x = 0; x < 768; x += 1) {
    if (pixels[(y * 768 + x) * 4 + 3] < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return requestedScale;
  const rootX = 768 * (anchor?.x ?? .5); const rootY = 768 * (anchor?.y ?? 1); const margin = 14;
  const limits = [
    minX < rootX ? (rootX - margin) / (rootX - minX) : Infinity,
    maxX > rootX ? (768 - margin - rootX) / (maxX - rootX) : Infinity,
    minY < rootY ? (rootY - margin) / (rootY - minY) : Infinity,
    maxY > rootY ? (768 - margin - rootY) / (maxY - rootY) : Infinity,
  ];
  return Math.max(.1, Math.min(requestedScale, ...limits) * .995);
}

function PreviewCanvas({ image, anchor, showGrid, showAnchor, state, frame }) {
  const ref = useRef(null);
  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, 768, 768);
    ctx.fillStyle = "#07111d"; ctx.fillRect(0, 0, 768, 768);
    if (showGrid) {
      ctx.strokeStyle = "rgba(103,232,249,.18)"; ctx.lineWidth = 1;
      for (let step = 0; step <= 768; step += 96) { ctx.beginPath(); ctx.moveTo(step, 0); ctx.lineTo(step, 768); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, step); ctx.lineTo(768, step); ctx.stroke(); }
      ctx.strokeStyle = "rgba(251,191,36,.45)"; ctx.beginPath(); ctx.moveTo(384, 0); ctx.lineTo(384, 768); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 384); ctx.lineTo(768, 384); ctx.stroke();
    }
    if (image) {
      const requestedScale = Number(anchor?.scale) > 0 ? Number(anchor.scale) : 1;
      const scale = previewScaleForImage(image, anchor, requestedScale);
      ctx.save(); ctx.translate(768 * (anchor?.x ?? .5), 768 * (anchor?.y ?? 1)); ctx.scale(scale, scale); ctx.translate(-768 * (anchor?.x ?? .5), -768 * (anchor?.y ?? 1));
      ctx.drawImage(image, 0, 0, 768, 768); ctx.restore();
    } else {
      ctx.fillStyle = "rgba(251,113,133,.14)"; ctx.fillRect(48, 48, 672, 672); ctx.strokeStyle = "#fb7185"; ctx.strokeRect(48, 48, 672, 672);
      ctx.fillStyle = "#fecdd3"; ctx.textAlign = "center"; ctx.font = "700 22px Chakra Petch, sans-serif"; ctx.fillText("SPRITE AUSENTE", 384, 365); ctx.font = "14px Inter, sans-serif"; ctx.fillText(`${state} / frame ${frame}`, 384, 400);
    }
    if (showAnchor) { const x = 768 * (anchor?.x ?? .5); const y = 768 * (anchor?.y ?? 1); ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14); ctx.stroke(); ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
  }, [image, anchor, showGrid, showAnchor, state, frame]);
  return <canvas ref={ref} className="animation-preview-canvas" width="768" height="768" aria-label={`Preview ${state} frame ${frame}`} />;
}

function FrameThumb({ image }) {
  const ref = useRef(null);
  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    const canvas = ref.current; const ctx = canvas?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, 96, 74); ctx.fillStyle = "#0b1828"; ctx.fillRect(0, 0, 96, 74);
    if (image) ctx.drawImage(image, 0, 0, 96, 74);
  }, [image]);
  return image ? <canvas ref={ref} width="96" height="74" aria-hidden="true" /> : <i>?</i>;
}

export default function AnimationLabPage() {
  const [category, setCategory] = useState("enemies");
  const entries = category === "troops" ? troopEntries : getEnemyCatalogEntries();
  const [selectedId, setSelectedId] = useState("colossoCaldeira");
  const [asset, setAsset] = useState(null); const [error, setError] = useState("");
  const [state, setState] = useState("idle"); const [frame, setFrame] = useState(0); const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(1); const [showGrid, setShowGrid] = useState(true); const [showAnchor, setShowAnchor] = useState(true);
  const selected = entries.find((entry) => entry.id === selectedId) || entries[0];
  const states = useMemo(() => selected?.assetStates || (category === "troops" ? ["idle", "attack"] : ["walking", "attack", "idle"]), [category, selected]);
  useEffect(() => { if (!states.includes(state)) { setState(states[0] || "idle"); setFrame(0); } }, [states, state]);
  useEffect(() => {
    const controller = new AbortController(); setAsset(null); setError(""); setPlaying(false); setFrame(0);
    loadAnimationEntity({ type: category === "troops" ? "troop" : "enemy", id: selected?.id, signal: controller.signal }).then((result) => setAsset(result)).catch((loadError) => { if (loadError.name !== "AbortError") setError(loadError.message); });
    return () => { controller.abort(); };
  }, [category, selected?.id]);
  useEffect(() => () => { if (asset) releaseAnimationEntityAssets(asset); }, [asset]);
  const frames = asset?.states?.[state] || []; const meta = timingFor(asset, state, frames.length); const anchor = frameAnchor(asset, state, frame); const image = frames[frame] || null;
  useEffect(() => { setFrame((current) => Math.min(current, Math.max(0, frames.length - 1))); }, [state, frames.length]);
  useEffect(() => { if (!playing || frames.length < 2) return undefined; const id = window.setInterval(() => setFrame((current) => (current + 1) % frames.length), Math.max(20, meta.frameMs / speed)); return () => window.clearInterval(id); }, [playing, frames.length, meta.frameMs, speed]);
  const selectCategory = (next) => { setCategory(next); const nextEntries = next === "troops" ? troopEntries : getEnemyCatalogEntries(); setSelectedId(nextEntries[0]?.id); };
  return <main className="page-content animation-lab-page">
    <header className="page-heading"><div><span className="eyebrow">INSPEÇÃO DE ASSETS</span><h1>Laboratório de Animações</h1><p>Visualização frame a frame de tropas, monstros e bosses sem carregar o motor de batalha.</p></div><span className="animation-lab-count">{entries.length}<small> entidades</small></span></header>
    <div className="animation-lab-tabs" role="tablist" aria-label="Categorias do laboratório">{[["troops", "Tropas"], ["enemies", "Monstros"]].map(([id, label]) => <button key={id} role="tab" aria-selected={category === id} className={category === id ? "active" : ""} onClick={() => selectCategory(id)}>{label}</button>)}</div>
    <section className="animation-lab-layout">
      <aside className="animation-lab-sidebar"><label className="animation-lab-select"><span>PERSONAGEM</span><select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label><div className="animation-state-list"><span className="eyebrow">ANIMAÇÕES</span>{states.map((entry) => <button key={entry} className={state === entry ? "active" : ""} onClick={() => { setState(entry); setFrame(0); }}>{labelFor(entry)}<small>{asset?.states?.[entry]?.length || "—"} frames</small></button>)}</div></aside>
      <div className="animation-lab-main"><div className="animation-preview"><PreviewCanvas image={image} anchor={anchor} showGrid={showGrid} showAnchor={showAnchor} state={state} frame={frame} />{error && <p className="animation-lab-error">{error}</p>}</div><div className="animation-lab-controls"><button className="secondary-button" aria-label="Frame anterior" onClick={() => setFrame((current) => frames.length ? (current - 1 + frames.length) % frames.length : 0)}>◀</button><button className="primary-button" onClick={() => setPlaying((current) => !current)}>{playing ? "Pausar" : "Play"}</button><button className="secondary-button" aria-label="Próximo frame" onClick={() => setFrame((current) => frames.length ? (current + 1) % frames.length : 0)}>▶</button><div className="animation-speed" role="group" aria-label="Velocidade">{SPEEDS.map((value) => <button key={value} className={speed === value ? "active" : ""} onClick={() => setSpeed(value)}>{value}x</button>)}</div><label className="animation-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Grade</label><label className="animation-check"><input type="checkbox" checked={showAnchor} onChange={(event) => setShowAnchor(event.target.checked)} /> Anchor</label></div><div className="animation-lab-technical"><strong>{selected?.label || "—"} · {labelFor(state)}</strong><span>Frame: <b>{frames.length ? frame : "—"} / {frames.length}</b></span><span>Arquivo: <b>{asset?.files?.[state]?.[frame] || `frame${frame}.png`}</b></span><span>Dimensão: <b>{image ? `${image.width} × ${image.height}` : "—"}</b></span><span>Timing: <b>{Math.round(meta.frameMs)} ms/frame · {Math.round(meta.durationMs)} ms total</b></span><span>Anchor: <b>{Number(anchor.x).toFixed(4)} / {Number(anchor.y).toFixed(4)}</b></span><span>Scale: <b>{Number(anchor.scale || 1).toFixed(4)}</b></span>{meta.impactFrame != null && <span>Impacto: <b>frame {meta.impactFrame} · {meta.impactMs} ms</b></span>}</div><div className="animation-filmstrip" aria-label="Frames da animação">{(frames.length ? frames : [null]).map((entry, index) => <button key={index} className={frame === index ? "active" : ""} aria-label={`Selecionar frame ${index}`} onClick={() => { setFrame(index); setPlaying(false); }}><span><FrameThumb image={entry} /></span><small>{index}</small></button>)}</div></div>
    </section>
  </main>;
}
