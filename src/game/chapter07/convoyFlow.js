import { getConvoyProgress, getConvoyXForProgress } from "./convoyGeometry.js";
import { buildSectorQueue } from "./convoySpawnDirector.js";
const easeInOutCubic = (v) => v < .5 ? 4 * v ** 3 : 1 - ((-2 * v + 2) ** 3) / 2;
const easeOutCubic = (v) => 1 - (1 - v) ** 3;
export const CONVOY_SECTOR_COUNTDOWN_MS = 2400;
export function startConvoySector(session) { const f=session.convoyFlow; if (!f||session.outcome||!["initialPreparation","checkpointPreparation","convoyEntry"].includes(f.state)) return false; if(f.state==="checkpointPreparation")f.sectorIndex+=1; if(f.sectorIndex>=session.phase.sectors.length)return false; f.state="sectorActive"; f.sectorStartedAt=session.elapsed; f.lastTransitionAt=session.elapsed; const s=session.phase.sectors[f.sectorIndex]; f.spawnDirector={generationId:f.spawnDirector.generationId+1,sectorId:s.id,nextReinforcementAt:session.elapsed+s.reinforcement.startsAtMs,warningEmitted:false}; session.queue=buildSectorQueue(session.phase,f.sectorIndex,session.seed); session.waveStartedAt=session.elapsed; session.nextSpawnAt=session.elapsed+(session.queue[0]?.spawnAtMs||0); session.waveActive=true; session.preparing=false; session.convoy.entryState="active"; session.convoy.entry=null; session.convoy.animation={state:"idle",startedAt:session.elapsed}; session.convoy.invulnerable=false; session.convoy.nextEnergyPulseAt=session.elapsed+session.phase.convoy.energyPulseEveryMs; return true; }
export function startConvoySectorCountdown(session) { const f=session?.convoyFlow; if(!f||session.outcome||!["initialPreparation","checkpointPreparation"].includes(f.state))return false; f.countdownResumeState=f.state; f.state="sectorCountdown"; f.countdownStartedAt=session.elapsed; f.countdownElapsedMs=0; f.countdownDurationMs=CONVOY_SECTOR_COUNTDOWN_MS; session.preparing=false; session.queue=[]; session.waveActive=false; return true; }
export function startConvoyEntry(session, events = []) { const convoy=session?.convoy; const flow=session?.convoyFlow; if(!convoy||!flow||flow.sectorIndex!==0||convoy.entryState!=="offscreen")return false; const stops=session.phase.convoy.sectorStops||[.06,.28,.51,.74,.96]; flow.state="convoyEntry"; convoy.entryState="entering"; convoy.x=convoy.entryX; convoy.previousX=convoy.entryX; convoy.entry={fromX:convoy.entryX,toX:getConvoyXForProgress(stops[0]),progress:0,startedAt:session.elapsed,durationMs:session.phase.convoy.entryDurationMs||convoy.entryDurationMs||2200}; convoy.animation={state:"idle",startedAt:session.elapsed}; convoy.invulnerable=true; session.waveActive=false; session.queue=[]; session.preparing=false; events.push({type:"convoyEntryStarted",x:convoy.x,y:convoy.y}); return true; }
export function advanceConvoySectorCountdown(session,dt,events=[]) { const f=session?.convoyFlow; if(!f||f.state!=="sectorCountdown")return false; f.countdownElapsedMs=Math.min(f.countdownDurationMs,(f.countdownElapsedMs||0)+Math.max(0,dt)); if(f.countdownElapsedMs<f.countdownDurationMs)return false; f.state=f.countdownResumeState||"initialPreparation"; const started=f.sectorIndex===0&&session.convoy.entryState==="offscreen"?startConvoyEntry(session,events):startConvoySector(session); if(started&&session.convoyFlow.state!=="convoyEntry")events.push({type:"convoyCountdownGo",sector:f.sectorIndex+1}); return started; }
export function completeConvoyEntry(session, events = []) { const convoy=session?.convoy; const flow=session?.convoyFlow; if(!convoy||!flow||flow.state!=="convoyEntry"||!convoy.entry)return false; convoy.x=convoy.entry.toX; convoy.previousX=convoy.x; convoy.entry.progress=1; convoy.entryState="active"; events.push({type:"convoyEnteredField",x:convoy.x,y:convoy.y}); return startConvoySector(session); }
export function advanceConvoyEntry(session,dt,events=[]) { const convoy=session?.convoy; const flow=session?.convoyFlow; if(!convoy||!flow||flow.state!=="convoyEntry"||!convoy.entry)return false; convoy.previousX=convoy.x; convoy.entry.progress=Math.min(1,convoy.entry.progress+Math.max(0,dt)/Math.max(1,convoy.entry.durationMs)); const eased=easeOutCubic(convoy.entry.progress); convoy.x=convoy.entry.fromX+(convoy.entry.toX-convoy.entry.fromX)*eased; return convoy.entry.progress>=1?completeConvoyEntry(session,events):false; }
export function completeConvoySector(session,events=[]) { const f=session?.convoyFlow; if(!f||f.state!=="sectorActive")return false; if(session.convoy?.grappledByEnemyId)return false; f.state="sectorClearing"; f.lastTransitionAt=session.elapsed; session.waveActive=false; session.queue=[]; return startConvoyTransit(session,events); }
export function startConvoyTransit(session,events=[]) { const {convoy,convoyFlow:f}=session; if(!convoy||!f||f.state!=="sectorClearing")return false; const stops=session.phase.convoy.sectorStops||[.06,.28,.51,.74,.96]; const p=stops[Math.min(stops.length-1,f.sectorIndex+1)]; convoy.transit={fromX:convoy.x,toX:getConvoyXForProgress(p),progress:0,startedAt:session.elapsed,durationMs:session.phase.convoy.transitDurationMs||2400}; convoy.invulnerable=true; convoy.underAttack=false; convoy.attackerIds=[]; f.state="convoyTransit"; f.transitStartedAt=session.elapsed; f.lastTransitionAt=session.elapsed; events.push({type:"convoyTransitStarted",sector:f.sectorIndex+1,fromX:convoy.transit.fromX,toX:convoy.transit.toX}); return true; }
export function completeConvoyTransit(session, events = []) {
  const { convoy, convoyFlow: f } = session;
  if (!convoy || !f || f.state !== "convoyTransit") return false;
  convoy.x = convoy.transit.toX;
  convoy.previousX = convoy.x;
  convoy.progress = getConvoyProgress(convoy.x);
  convoy.transit.progress = 1;
  if (f.sectorIndex >= session.phase.sectors.length - 1) {
    convoy.x = convoy.destinationX;
    convoy.previousX = convoy.x;
    convoy.progress = 1;
    f.state = "victory";
    convoy.invulnerable = true;
    events.push({ type: "convoyEvacuated", x: convoy.x, progress: convoy.progress });
    return "victory";
  }
  f.reachedCheckpointCount = f.sectorIndex + 1;
  f.state = "checkpointDecision";
  f.checkpointDecisionPending = true;
  f.checkpointBriefingPending = true;
  f.checkpointOptionChosen = false;
  convoy.invulnerable = true;
  events.push({ type: "checkpointReached", checkpointIndex: f.reachedCheckpointCount - 1, x: convoy.x });
  return "checkpointDecision";
}
export function advanceConvoyTransit(session,dt,events=[]) { const {convoy,convoyFlow:f}=session; if(!convoy||!f||f.state!=="convoyTransit")return null; convoy.previousX=convoy.x; convoy.transit.progress=Math.min(1,convoy.transit.progress+Math.max(0,dt)/convoy.transit.durationMs); const e=easeInOutCubic(convoy.transit.progress); convoy.x=convoy.transit.fromX+(convoy.transit.toX-convoy.transit.fromX)*e; convoy.progress=getConvoyProgress(convoy.x); return convoy.transit.progress>=1?completeConvoyTransit(session,events):null; }
