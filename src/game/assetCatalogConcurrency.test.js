import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./assetCatalog.js";

describe("concorrência do carregador de assets", () => {
  it("limita o trabalho simultâneo ao valor configurado", async () => {
    let active = 0;
    let maximumActive = 0;
    const tasks = Array.from({ length: 12 }, (_, index) => async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2 + index % 3));
      active -= 1;
    });

    await runWithConcurrency(tasks, { concurrency: 4 });
    expect(maximumActive).toBe(4);
  });
});
