import { describe, expect, it, vi } from "vitest";
import {
  installNonPassiveContextMenuGuard,
} from "./battleCanvasEvents.js";

describe("eventos nativos do canvas de batalha", () => {
  it("registra contextmenu explicitamente como não passivo", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    const target = {
      addEventListener,
      removeEventListener,
    };

    const cleanup = installNonPassiveContextMenuGuard(
      target,
    );

    expect(addEventListener)
      .toHaveBeenCalledTimes(1);

    const [
      eventName,
      listener,
      options,
    ] = addEventListener.mock.calls[0];

    expect(eventName).toBe("contextmenu");
    expect(options).toEqual({
      passive: false,
    });

    const preventDefault = vi.fn();
    listener({ preventDefault });

    expect(preventDefault)
      .toHaveBeenCalledTimes(1);

    cleanup();

    expect(removeEventListener)
      .toHaveBeenCalledWith(
        "contextmenu",
        listener,
        options,
      );
  });
});
