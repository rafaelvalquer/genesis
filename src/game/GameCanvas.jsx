import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENEMIES, TROOPS } from "./content.js";
import { getArenaUrl, loadBattleAssets } from "./assetCatalog.js";
import {
  drawArenaBackground,
  drawArenaForeground,
  drawArenaUnderlay,
  drawContactShadow,
  drawTacticalGrid,
} from "./arenaRenderer.js";
import { drawFrozenEnemyEffect, drawParticles, drawProjectiles, pushEventParticles } from "./projectileRenderer.js";
import { getSpriteRect, getTroopAnimation, isEnemyFrozen } from "./visualGeometry.js";
import {
  FIELD,
  cellFromPoint,
  createBattleSession,
  getSnapshot,
  placeTroop,
  removeTroop,
  selectDecision,
  startWave,
  stepBattle,
} from "./battleModel.js";
import { loadSettings } from "../campaign/storage.js";

function drawSprite(ctx, image, entity, targetHeight, opacity = 1, filter = "none") {
  if (!image?.width || !image?.height) return false;
  const rect = getSpriteRect(entity, targetHeight, image.width / image.height);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

function drawHealth(ctx, entity, width = 54, offset = 47) {
  const ratio = Math.max(0, entity.hp / entity.maxHp);
  ctx.fillStyle = "rgba(2,6,23,.85)";
  ctx.fillRect(entity.x - width / 2, entity.y - offset, width, 6);
  ctx.fillStyle = ratio > 0.55 ? "#34d399" : ratio > 0.25 ? "#fbbf24" : "#fb7185";
  ctx.fillRect(entity.x - width / 2 + 1, entity.y - offset + 1, (width - 2) * ratio, 4);
}

function drawBattle(ctx, session, assets, particlesRef, selectedTroop, removeMode, hoveredCell, settings, now) {
  drawArenaBackground(ctx, session.phase, settings);
  drawArenaUnderlay(ctx, session.phase, settings, session, now);
  drawTacticalGrid(ctx, session, selectedTroop, removeMode, hoveredCell);

  const baseGradient = ctx.createLinearGradient(0, 0, 48, 0);
  baseGradient.addColorStop(0, `${session.phase.palette.primary}55`);
  baseGradient.addColorStop(1, "transparent");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, 58, FIELD.height);

  drawProjectiles(ctx, session.projectiles, settings);

  const sorted = [
    ...session.troops.map((entity) => ({ kind: "troop", entity })),
    ...session.enemies.map((entity) => ({ kind: "enemy", entity })),
  ].sort((left, right) => left.entity.row - right.entity.row || left.entity.x - right.entity.x);

  for (const item of sorted) {
    const entity = item.entity;
    drawContactShadow(ctx, entity, item.kind === "enemy" ? entity.scale : 1, settings);
    if (item.kind === "troop") {
      const config = TROOPS[entity.type];
      const troopAssets = assets.troops[entity.type] || {};
      const animation = getTroopAnimation(entity, config, session.elapsed, {
        idle: troopAssets.idle?.length, attack: troopAssets.attack?.length, defense: troopAssets.defense?.length,
      });
      const frames = troopAssets[animation.state] || troopAssets.idle || [];
      const image = frames[animation.frame % Math.max(1, frames.length)];
      if (!drawSprite(ctx, image, entity, config.attackVisual?.height || (entity.type === "muralhaReforcada" ? 112 : 126))) {
        ctx.fillStyle = config.color;
        ctx.fillRect(entity.x - 24, entity.y - 34, 48, 68);
      }
      drawHealth(ctx, entity, 54, 52);
    } else {
      const config = ENEMIES[entity.type];
      const frozen = isEnemyFrozen(entity, session.elapsed);
      const state = session.elapsed - entity.lastAttackAt < 520 ? "attack" : "walking";
      const frames = assets.enemies[entity.type]?.[state] || assets.enemies[entity.type]?.walking || [];
      const image = frames[Math.floor(session.elapsed / 75) % Math.max(1, frames.length)];
      const enemyHeight = 128 * entity.scale;
      const spriteDrawn = drawSprite(ctx, image, entity, enemyHeight, 1, frozen ? "saturate(.55) brightness(1.16)" : "none");
      if (frozen && spriteDrawn) {
        drawSprite(ctx, image, entity, enemyHeight, 0.38, "brightness(0) saturate(100%) invert(82%) sepia(46%) saturate(1134%) hue-rotate(156deg) brightness(104%) contrast(102%)");
      }
      if (!spriteDrawn) {
        ctx.fillStyle = frozen ? "#38bdf8" : config.color;
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, 24 * entity.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      if (frozen) drawFrozenEnemyEffect(ctx, entity, session.elapsed, settings);
      drawHealth(ctx, entity, entity.variant === "alpha" ? 100 : 58, 58 * entity.scale);
      if (entity.variant === "alpha") {
        ctx.fillStyle = "#fecdd3";
        ctx.font = "700 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("KRΛKHUL ALFA", entity.x, entity.y - 76 * entity.scale);
      }
    }
  }

  drawArenaForeground(ctx, session.phase, settings, session, now);
  particlesRef.current = drawParticles(ctx, particlesRef.current, now, settings);
}

export default function GameCanvas({ phase, unlockedTroops, onFinish, onExit }) {
  const loadout = useMemo(() => unlockedTroops.map((entry) => typeof entry === "string" ? entry : entry.id), [unlockedTroops]);
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);
  const sessionRef = useRef(null);
  const particlesRef = useRef([]);
  const hoveredCellRef = useRef(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const finishSentRef = useRef(false);
  const audioRef = useRef({});
  if (!sessionRef.current) sessionRef.current = createBattleSession(phase, loadout, Date.now());

  const [loading, setLoading] = useState({ ready: false, percent: 0 });
  const [snapshot, setSnapshot] = useState(() => getSnapshot(sessionRef.current));
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedTroop, setSelectedTroop] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [message, setMessage] = useState("Selecione uma unidade e posicione-a no campo.");
  const [banner, setBanner] = useState(`FASE ${Number(phase.id.slice(-2))} · ${phase.name}`);
  const settings = useMemo(loadSettings, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const configureAudio = useCallback((assets) => {
    const build = (name, loop = false) => {
      const url = assets.audio[name];
      if (!url) return null;
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.loop = loop;
      return audio;
    };
    audioRef.current = {
      theme: build("wave_theme.ogg", true),
      alert: build("wave_alert.ogg"),
      deploy: build("deploy.ogg"),
      shoot: [1, 2, 3, 4].map((index) => build(`shoot_ball_${index}.wav`)).filter(Boolean),
      melee: [1, 2, 3, 4].map((index) => build(`melee_${index}.wav`)).filter(Boolean),
    };
  }, []);

  const play = useCallback((channel, intensity = 1) => {
    const source = Array.isArray(audioRef.current[channel])
      ? audioRef.current[channel][Math.floor(Math.random() * audioRef.current[channel].length)]
      : audioRef.current[channel];
    if (!source) return;
    const instance = channel === "theme" ? source : source.cloneNode();
    const group = channel === "theme" ? settings.musicVolume : settings.effectsVolume;
    instance.volume = Math.max(0, Math.min(1, settings.masterVolume * group * intensity));
    instance.play().catch(() => {});
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    loadBattleAssets(phase, loadout, ({ percent }) => !cancelled && setLoading({ ready: false, percent }))
      .then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        configureAudio(assets);
        setLoading({ ready: true, percent: 100 });
      });
    return () => {
      cancelled = true;
      audioRef.current.theme?.pause();
    };
  }, [configureAudio, loadout, phase]);

  useEffect(() => {
    if (!loading.ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationId;
    let previous = performance.now();
    let accumulator = 0;
    let lastUi = 0;
    const loop = (now) => {
      const frameDelta = Math.min(100, now - previous);
      previous = now;
      if (!pausedRef.current) accumulator += frameDelta * speedRef.current;
      while (accumulator >= 32) {
        const events = stepBattle(sessionRef.current, 32);
        pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, settings);
        if (events.some((event) => event.type === "spawn")) play("alert", 0.08);
        if (events.some((event) => event.type === "shoot")) play("shoot", 0.18);
        if (events.some((event) => event.type === "melee")) play("melee", 0.2);
        const phaseEvent = events.find((event) => event.type === "bossPhase");
        if (phaseEvent) setBanner(`⚠ KRΛKHUL ALFA · FASE ${phaseEvent.phase + 1}`);
        if (events.some((event) => event.type === "waveComplete")) {
          audioRef.current.theme?.pause();
          setBanner("ONDA CONCLUÍDA · REORGANIZE A DEFESA");
        }
        accumulator -= 32;
      }
      drawBattle(ctx, sessionRef.current, assetsRef.current, particlesRef, selectedTroop, removeMode, hoveredCellRef.current, settings, sessionRef.current.elapsed);
      if (now - lastUi > 100) {
        lastUi = now;
        setSnapshot(getSnapshot(sessionRef.current));
      }
      if (sessionRef.current.result && !finishSentRef.current) {
        finishSentRef.current = true;
        audioRef.current.theme?.pause();
        onFinish(sessionRef.current.result);
      }
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [loading.ready, onFinish, play, removeMode, selectedTroop, settings]);

  const pointFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return cellFromPoint((event.clientX - rect.left) * FIELD.width / rect.width, (event.clientY - rect.top) * FIELD.height / rect.height);
  };

  const handleCanvasMove = (event) => {
    hoveredCellRef.current = pointFromPointer(event);
  };

  const handleCanvasClick = (event) => {
    if (snapshot.outcome) return;
    const point = pointFromPointer(event);
    if (removeMode) {
      const result = removeTroop(sessionRef.current, point.row, point.col);
      setMessage(result.ok ? `Unidade removida · +${result.refund} energia.` : result.reason);
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (!selectedTroop) return;
    const result = placeTroop(sessionRef.current, selectedTroop, point.row, point.col);
    setMessage(result.ok ? `${TROOPS[selectedTroop].label} implantado.` : result.reason);
    if (result.ok) {
      play("deploy", 0.55);
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, settings);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleStartWave = () => {
    if (startWave(sessionRef.current)) {
      setBanner(`ONDA ${sessionRef.current.waveIndex + 1} · CONTATO`);
      setMessage("Onda em andamento. Novas implantações entram em cooldown.");
      play("alert", 0.75);
      play("theme", 0.75);
      setSnapshot(getSnapshot(sessionRef.current));
    }
  };

  const handleDecision = (option) => {
    if (selectDecision(sessionRef.current, option)) {
      setMessage(`${option.label}: efeito aplicado.`);
      setSnapshot(getSnapshot(sessionRef.current));
    } else {
      setMessage("Supply insuficiente para essa decisão.");
    }
  };

  if (!loading.ready) {
    return <div className="battle-loader" style={{ "--arena-image": `url(${getArenaUrl(phase.arenaId)})`, "--arena-primary": phase.palette.primary }}><div className="loader-scrim" /><div className="loader-content"><div className="loader-mark">GD</div><span className="eyebrow">{phase.name}</span><h2>Preparando campo tático</h2><div className="progress-track"><span style={{ width: `${loading.percent}%` }} /></div><p>{loading.percent}% · sincronizando arena, loadout e hostis</p></div></div>;
  }

  return (
    <section className={`battle-shell environment-${phase.environment}`}>
      <header className="battle-topbar">
        <div><span className="eyebrow">{phase.subtitle}</span><h1>{phase.name}</h1></div>
        <div className="battle-stats">
          <div><span>Energia</span><strong className="cyan">{snapshot.energy}</strong></div>
          <div><span>Supply</span><strong>{snapshot.supply}/{snapshot.supplyMax}</strong></div>
          <div><span>Integridade</span><strong className={snapshot.integrity <= 40 ? "danger" : "success"}>{snapshot.integrity}%</strong></div>
          <div><span>Onda</span><strong>{snapshot.wave}/{snapshot.totalWaves}</strong></div>
          <div><span>Hostis</span><strong>{snapshot.enemies + snapshot.queued}</strong></div>
        </div>
        <div className="battle-actions">
          <button className="icon-button" onClick={() => setPaused((value) => !value)}>{paused ? "▶" : "Ⅱ"}</button>
          <button className="speed-button" disabled={paused} onClick={() => setSpeed((value) => value === 1 ? 2 : 1)}>{speed}×</button>
          <button className="ghost-button" onClick={onExit}>Sair</button>
        </div>
      </header>

      <div className="battle-main">
        <aside className="troop-rail">
          <div className="rail-heading"><span>LOADOUT</span><small>Selecione e posicione</small></div>
          {loadout.map((troopId) => {
            const troop = TROOPS[troopId];
            const cooldown = snapshot.cooldowns[troopId] || 0;
            const disabled = snapshot.energy < troop.price || snapshot.supply < troop.supply || cooldown > 0;
            return <button key={troopId} className={`troop-slot ${selectedTroop === troopId && !removeMode ? "selected" : ""}`} disabled={disabled} onClick={() => { setRemoveMode(false); setSelectedTroop(troopId); }}>
              <span className="troop-color" style={{ background: troop.color }} />
              <span><b>{troop.label}</b><small>{troop.role}</small></span>
              <span className="slot-cost">⚡{troop.price}<small>{cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}s` : `S${troop.supply}`}</small></span>
            </button>;
          })}
          <button className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · 50%</button>
          <div className="rail-tip">{message}</div>
        </aside>

        <div className="canvas-wrap">
          <div className="wave-banner">{banner}</div>
          <canvas ref={canvasRef} width={FIELD.width} height={FIELD.height} onClick={handleCanvasClick} onMouseMove={handleCanvasMove} onMouseLeave={() => { hoveredCellRef.current = null; }} aria-label="Campo de batalha em cinco rotas" />
          {paused && <div className="pause-overlay"><span>SIMULAÇÃO PAUSADA</span><button onClick={() => setPaused(false)}>Continuar</button></div>}
          {snapshot.preparing && !snapshot.pendingDecision && !snapshot.outcome && <button className="start-wave" onClick={handleStartWave}>INICIAR ONDA {snapshot.wave}<span>Ameaça detectada · {phase.waves[snapshot.wave - 1].enemies.reduce((sum, entry) => sum + entry.count, 0)} assinaturas</span></button>}
        </div>
      </div>

      {snapshot.pendingDecision && <div className="modal-backdrop"><div className="decision-modal"><span className="eyebrow amber">Decisão entre ondas</span><h2>Escolha uma vantagem tática</h2><p>A alteração vale até o fim desta fase.</p><div className="decision-grid">{snapshot.pendingDecision.map((option) => <button key={option.id} onClick={() => handleDecision(option)}><b>{option.label}</b><span>{option.description}</span></button>)}</div></div></div>}
    </section>
  );
}
