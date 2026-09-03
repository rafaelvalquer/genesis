import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PHASES } from "../content.js";
import { useBattleController } from "./useBattleController.js";

describe("useBattleController", () => {
  it("mantém a sessão mutável fora do estado React e publica ações de domínio", () => {
    const { result, unmount } = renderHook(() => useBattleController({
      phase: PHASES[0], unlockedTroops: ["marine"], sandbox: true,
    }));
    const session = result.current.sessionRef.current;
    expect(result.current.snapshot.energy).toBe(session.energy);
    expect(result.current.frameLoopRef.current).toBeNull();
    expect(result.current.renderPlan.environments).toEqual(expect.any(Array));
    expect(result.current.getRenderScene()).toMatchObject({
      session,
      renderPlan: result.current.renderPlan,
    });

    act(() => result.current.actions.pause());
    expect(result.current.paused).toBe(true);
    act(() => result.current.actions.resume());
    expect(result.current.paused).toBe(false);
    act(() => result.current.actions.changeSpeed(2));
    expect(result.current.speed).toBe(2);

    act(() => result.current.actions.placeTroop("marine", 0, 1));
    expect(result.current.sessionRef.current.troops).toHaveLength(1);
    expect(result.current.snapshot.deploymentStats.marine.activeCount).toBe(1);

    act(() => result.current.actions.removeTroop(0, 1));
    expect(result.current.sessionRef.current.troops).toHaveLength(0);
    act(() => result.current.actions.startWave());
    expect(result.current.sessionRef.current.waveActive).toBe(true);

    // A ação permanece no controller mesmo quando a UI trata seus efeitos visuais.
    expect(typeof result.current.actions.activateSpecial).toBe("function");
    unmount();
  });
});
