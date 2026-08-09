export const frameNumber = (key) => (
  Number(/frame(\d+)\.png$/i.exec(key)?.[1] || 0)
);

export function modulesFor(modules, folder, state) {
  return Object.entries(modules)
    // Source sprite sheets can live beside their exported frames. They are
    // reference artwork, not animation frames: loading one as frame 0 draws
    // all eight poses at once.
    .filter(([key]) => (
      key.includes(`/${folder}/${state}/`)
      && /\/frame\d+\.png$/i.test(key)
    ))
    .sort(([left], [right]) => frameNumber(left) - frameNumber(right));
}

export function statesForFolder(modules, folder) {
  const states = new Set();
  const marker = `/${folder}/`;

  for (const key of Object.keys(modules)) {
    const start = key.indexOf(marker);
    if (start < 0) continue;

    const remainder = key.slice(start + marker.length);
    const state = remainder.split("/")[0];
    if (state) states.add(state);
  }

  return [...states];
}

export function createAssetAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("Asset loading aborted.", "AbortError");
  }

  const error = new Error("Asset loading aborted.");
  error.name = "AbortError";
  return error;
}
