import {
  createMagmaSurfaceFrame,
  renderMagmaSurfaceFrame,
} from "./magmaSurfaceGenerator.js";

const frames = new Map();

function getFrame(payload) {
  const key = `${payload.frameKey}:${payload.resolutionScale}`;
  let frame = frames.get(key);
  if (!frame) {
    frame = createMagmaSurfaceFrame(
      payload.region,
      payload.resolutionScale,
      (width, height) => new OffscreenCanvas(width, height),
    );
    frames.set(key, frame);
  }
  return frame;
}

function transferCanvas(canvas) {
  return canvas?.transferToImageBitmap?.() || null;
}

self.onmessage = ({ data }) => {
  if (data?.type !== "render") return;
  const { jobId, payload } = data;
  try {
    const frame = getFrame(payload);
    renderMagmaSurfaceFrame(frame, payload.render);
    const result = {
      type: "rendered",
      jobId,
      generatedAt: frame.generatedAt,
      flowFrame: frame.flowFrame,
      surface: transferCanvas(frame.surfaceCanvas),
      hot: transferCanvas(frame.hotCanvas),
      crust: transferCanvas(frame.crustCanvas),
      heat: payload.render.config.showHeatmap ? transferCanvas(frame.heatCanvas) : null,
    };
    const transfers = [result.surface, result.hot, result.crust, result.heat].filter(Boolean);
    self.postMessage(result, transfers);
  } catch (error) {
    self.postMessage({
      type: "rendered",
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
