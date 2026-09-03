const renderers = new Map();

export function registerEnvironmentRenderer(name, renderer, { replace = false } = {}) {
  if (!name || typeof renderer !== "function") throw new TypeError("Environment renderer inválido");
  if (renderers.has(name) && !replace) throw new Error(`Environment renderer already registered: ${name}`);
  renderers.set(name, renderer);
  return renderer;
}

export function drawEnvironmentLayer(renderContext) {
  for (const name of renderContext.scene?.renderPlan?.environments || []) {
    renderers.get(name)?.(renderContext);
  }
}

export function getEnvironmentRenderer(name) {
  return renderers.get(name) || null;
}
