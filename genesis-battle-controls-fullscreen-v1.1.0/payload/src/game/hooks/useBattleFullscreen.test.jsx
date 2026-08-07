import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleFullscreen } from "./useBattleFullscreen.js";

const originalDescriptors = {};

function defineDocumentProperty(name, value) {
  originalDescriptors[name] ||= Object.getOwnPropertyDescriptor(document, name);
  Object.defineProperty(document, name, {
    configurable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  defineDocumentProperty("fullscreenEnabled", true);
  defineDocumentProperty("fullscreenElement", null);
  defineDocumentProperty("exitFullscreen", vi.fn(async () => {
    document.fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
  }));
});

afterEach(() => {
  cleanup();
  for (const [name, descriptor] of Object.entries(originalDescriptors)) {
    if (descriptor) Object.defineProperty(document, name, descriptor);
    else delete document[name];
  }
  vi.restoreAllMocks();
});

describe("useBattleFullscreen", () => {
  it("entra e sai da tela cheia mantendo o estado sincronizado", async () => {
    const element = document.createElement("section");
    element.requestFullscreen = vi.fn(async () => {
      document.fullscreenElement = element;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const targetRef = { current: element };
    const { result } = renderHook(() => useBattleFullscreen(targetRef));

    expect(result.current.fullscreenSupported).toBe(true);

    await act(async () => {
      expect(await result.current.toggleFullscreen()).toEqual({ ok: true });
    });
    expect(element.requestFullscreen).toHaveBeenCalledOnce();
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      expect(await result.current.toggleFullscreen()).toEqual({ ok: true });
    });
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(result.current.isFullscreen).toBe(false);
  });

  it("retorna uma mensagem segura quando a API não está disponível", async () => {
    defineDocumentProperty("fullscreenEnabled", false);
    const targetRef = { current: document.createElement("section") };
    const { result } = renderHook(() => useBattleFullscreen(targetRef));

    let response;
    await act(async () => {
      response = await result.current.enterFullscreen();
    });

    expect(response.ok).toBe(false);
    expect(response.reason).toMatch(/não é suportada/i);
  });
});
