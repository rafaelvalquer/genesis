import { describe, expect, it } from "vitest";
import {
  applyMagmaSurfaceWorkerResult,
  createMagmaSurfaceWorkerClient,
  supportsMagmaSurfaceWorker,
} from "../magmaSurfaceWorkerClient.js";

function workerScope() {
  class FakeOffscreenCanvas {}
  FakeOffscreenCanvas.prototype.transferToImageBitmap = () => {};
  const scope = { instance: null, OffscreenCanvas: FakeOffscreenCanvas };
  scope.Worker = class FakeWorker {
    constructor() {
      scope.instance = this;
    }

    postMessage(message) {
      this.message = message;
    }

    terminate() {
      this.terminated = true;
    }
  };
  return scope;
}

describe("worker da superfície de magma", () => {
  it("usa worker somente com OffscreenCanvas transferivel", () => {
    expect(supportsMagmaSurfaceWorker({})).toBe(false);
    expect(supportsMagmaSurfaceWorker(workerScope())).toBe(true);
  });

  it("correlaciona respostas assincronas sem bloquear o chamador", async () => {
    const scope = workerScope();
    const client = createMagmaSurfaceWorkerClient(scope);
    const request = client.render({ frameKey: "region-1" });
    expect(scope.instance.message).toMatchObject({ type: "render", jobId: 1 });
    scope.instance.onmessage({ data: { type: "rendered", jobId: 1, generatedAt: 2 } });
    await expect(request).resolves.toMatchObject({ generatedAt: 2 });
    client.terminate();
    expect(scope.instance.terminated).toBe(true);
  });

  it("copia bitmaps e cria heatmap apenas sob demanda", () => {
    const draws = [];
    const canvasFactory = (width, height) => ({
      width,
      height,
      getContext: () => ({
        clearRect: () => {},
        drawImage: (bitmap) => draws.push(bitmap.id),
      }),
    });
    const frame = {
      width: 20,
      height: 10,
      surfaceCanvas: canvasFactory(20, 10),
      hotCanvas: canvasFactory(20, 10),
      crustCanvas: canvasFactory(20, 10),
      heatCanvas: null,
    };
    const bitmap = (id) => ({ id, close() { this.closed = true; } });
    const result = {
      generatedAt: 3,
      flowFrame: { offsetX: 4 },
      surface: bitmap("surface"),
      hot: bitmap("hot"),
      crust: bitmap("crust"),
      heat: bitmap("heat"),
    };

    applyMagmaSurfaceWorkerResult(frame, result, canvasFactory);

    expect(draws).toEqual(["surface", "hot", "crust", "heat"]);
    expect(frame.heatCanvas).not.toBeNull();
    expect(frame.generatedAt).toBe(3);
    expect(result.surface.closed).toBe(true);
  });
});
