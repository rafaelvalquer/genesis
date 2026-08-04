import { describe, expect, it, vi } from "vitest";
import { runWithConcurrency } from "./assetCatalog.js";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("concorrência do carregador de assets", () => {
  it("limita o trabalho simultâneo ao valor configurado", async () => {
    let active = 0;
    let maximumActive = 0;
    const tasks = Array.from({ length: 12 }, (_, index) => async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await delay(2 + index % 3);
      active -= 1;
      return index;
    });

    await expect(runWithConcurrency(tasks, { concurrency: 4 }))
      .resolves.toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(maximumActive).toBe(4);
  });

  it("registra o primeiro erro, não distribui novas tarefas e espera as iniciadas", async () => {
    const started = [];
    const finished = [];
    let lateWork = false;
    const tasks = [
      async () => {
        started.push(0);
        await delay(4);
        finished.push(0);
        throw new Error("falha controlada");
      },
      async () => {
        started.push(1);
        await delay(12);
        finished.push(1);
      },
      async () => {
        started.push(2);
        lateWork = true;
      },
      async () => {
        started.push(3);
        lateWork = true;
      },
    ];

    await expect(runWithConcurrency(tasks, { concurrency: 2 }))
      .rejects.toThrow("falha controlada");
    expect(started).toEqual([0, 1]);
    expect(finished).toEqual([0, 1]);
    expect(lateWork).toBe(false);
  });

  it("interrompe a distribuição por AbortSignal e aguarda o trabalho iniciado", async () => {
    const controller = new AbortController();
    const started = [];
    const completed = [];
    const tasks = Array.from({ length: 6 }, (_, index) => async () => {
      started.push(index);
      await delay(5);
      completed.push(index);
    });

    const execution = runWithConcurrency(tasks, {
      concurrency: 2,
      signal: controller.signal,
    });
    await delay(1);
    controller.abort();

    await expect(execution).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toHaveLength(2);
    expect(completed).toHaveLength(2);
  });

  it("notifica o progresso exatamente uma vez para cada tarefa concluída", async () => {
    const onTaskComplete = vi.fn();
    await runWithConcurrency([
      async () => "A",
      async () => "B",
      async () => "C",
    ], { concurrency: 2, onTaskComplete });

    expect(onTaskComplete).toHaveBeenCalledTimes(3);
    expect(onTaskComplete.mock.calls.map(([index]) => index).sort())
      .toEqual([0, 1, 2]);
  });

  it("não mantém trabalho tardio depois da rejeição", async () => {
    let mutations = 0;
    const execution = runWithConcurrency([
      async () => { throw new Error("parar"); },
      async () => { await delay(8); mutations += 1; },
      async () => { mutations += 100; },
    ], { concurrency: 2 });

    await expect(execution).rejects.toThrow("parar");
    const valueAtRejection = mutations;
    await delay(15);
    expect(mutations).toBe(valueAtRejection);
    expect(mutations).toBe(1);
  });
});
