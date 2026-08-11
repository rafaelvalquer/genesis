import { createMagmaFlowRuntime, prepareMagmaFlowRuntime } from "./magma/magmaFlowRuntime.js";
import { drawMagmaEruptions } from "./magma/magmaEruptionRenderer.js";
import { drawMagmaSmoke } from "./magma/magmaHeatRenderer.js";
import { drawMagmaParticles } from "./magma/magmaParticleRenderer.js";
import { drawMagmaGround } from "./magma/magmaGroundRenderer.js";

let fallbackRuntime = createMagmaFlowRuntime();

function getRuntime(graphicsRuntime) {
  if (!graphicsRuntime) return fallbackRuntime;
  if (!graphicsRuntime.magma) graphicsRuntime.magma = createMagmaFlowRuntime();
  return graphicsRuntime.magma;
}

export function drawMagmaTerrainBase(
  ctx,
  session,
  time = 0,
  settings = {},
  adaptive = {},
  graphicsRuntime,
) {
  if (!session?.phase?.magmaTerrain?.cells?.length) return;
  drawMagmaGround(ctx, session, time, { ...settings, thermalState: session.thermalCycle?.state });
}

export function drawMagmaTerrainEffects(
  ctx,
  session,
  time = 0,
  settings = {},
  adaptive = {},
  graphicsRuntime,
) {
  if (!session?.phase?.magmaTerrain?.cells?.length) return;
  const currentRuntime = getRuntime(graphicsRuntime);
  const runtime = drawMagmaAtmosphere(
    ctx,
    session,
    currentRuntime,
    time,
    settings,
    adaptive,
  );
  if (graphicsRuntime) graphicsRuntime.magma = runtime;
  else fallbackRuntime = runtime;
}

export function drawMagmaAtmosphere(
  ctx,
  session,
  suppliedRuntime,
  time = 0,
  settings = {},
  adaptive = {},
) {
  if (!session?.phase?.magmaTerrain?.cells?.length) return suppliedRuntime;
  const { runtime, options } = prepareMagmaFlowRuntime(
    suppliedRuntime,
    session,
    time,
    settings,
    adaptive,
  );
  drawMagmaSmoke(ctx, runtime, time, options);
  drawMagmaEruptions(ctx, runtime, options);
  drawMagmaParticles(ctx, runtime, time, options);
  return runtime;
}

export function clearMagmaTileCache() {
  fallbackRuntime = createMagmaFlowRuntime();
}
