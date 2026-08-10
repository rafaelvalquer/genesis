import { createSurfaceCanvas } from "./magmaSurfaceGenerator.js";

export function supportsMagmaSurfaceWorker(scope = globalThis) {
  return typeof scope?.Worker === "function"
    && typeof scope?.OffscreenCanvas === "function"
    && typeof scope.OffscreenCanvas.prototype?.transferToImageBitmap === "function";
}

export function createMagmaSurfaceWorkerClient(scope = globalThis) {
  if (!supportsMagmaSurfaceWorker(scope)) return null;
  const worker = new scope.Worker(
    new URL("./magmaSurfaceWorker.js", import.meta.url),
    { type: "module", name: "genesis-magma-surface" },
  );
  let nextJobId = 1;
  const pending = new Map();

  worker.onmessage = ({ data }) => {
    const request = pending.get(data?.jobId);
    if (!request) return;
    pending.delete(data.jobId);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data);
  };
  worker.onerror = (event) => {
    const error = new Error(event?.message || "Falha no worker de magma");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  return {
    render(payload) {
      const jobId = nextJobId;
      nextJobId += 1;
      return new Promise((resolve, reject) => {
        pending.set(jobId, { resolve, reject });
        worker.postMessage({ type: "render", jobId, payload });
      });
    },
    terminate() {
      worker.terminate();
      const error = new Error("Worker de magma encerrado");
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    },
  };
}

function drawBitmap(canvas, bitmap) {
  if (!canvas || !bitmap) return;
  const context = canvas.getContext("2d");
  context?.clearRect?.(0, 0, canvas.width, canvas.height);
  context?.drawImage?.(bitmap, 0, 0);
  bitmap.close?.();
}

export function applyMagmaSurfaceWorkerResult(frame, result, canvasFactory) {
  if (!frame || !result) return frame;
  if (result.heat && !frame.heatCanvas) {
    frame.heatCanvas = createSurfaceCanvas(frame.width, frame.height, canvasFactory);
  }
  drawBitmap(frame.surfaceCanvas, result.surface);
  drawBitmap(frame.hotCanvas, result.hot);
  drawBitmap(frame.crustCanvas, result.crust);
  drawBitmap(frame.heatCanvas, result.heat);
  frame.generatedAt = result.generatedAt;
  frame.flowFrame = result.flowFrame;
  return frame;
}
