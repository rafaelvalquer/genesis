import { describe, expect, it, vi } from "vitest";
import {
  createRetryableLazyModule,
} from "./retryableLazyModule.js";

describe("createRetryableLazyModule", () => {
  it("reutiliza a mesma importação durante o preload e a renderização lazy", async () => {
    const module = {
      default: () => null,
    };

    const importer = vi.fn(
      async () => module,
    );

    const load = createRetryableLazyModule(
      importer,
    );

    const preloadPromise = load.preload();
    const lazyPromise = load();

    expect(lazyPromise).toBe(preloadPromise);
    await expect(preloadPromise)
      .resolves.toBe(module);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("permite uma nova tentativa depois de falha", async () => {
    const module = {
      default: () => null,
    };

    const importer = vi.fn()
      .mockRejectedValueOnce(
        new Error("chunk indisponível"),
      )
      .mockResolvedValueOnce(module);

    const load = createRetryableLazyModule(
      importer,
    );

    await expect(load())
      .rejects.toThrow("chunk indisponível");

    await expect(load())
      .resolves.toBe(module);

    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("permite limpar o cache explicitamente", async () => {
    const importer = vi.fn(
      async () => ({
        default: () => null,
      }),
    );

    const load = createRetryableLazyModule(
      importer,
    );

    await load();
    load.reset();
    await load();

    expect(importer).toHaveBeenCalledTimes(2);
  });
});
