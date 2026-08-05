import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("gsap", () => ({
  default: {
    timeline: vi.fn(() => ({
      call() {
        return this;
      },
      to() {
        return this;
      },
      kill() {},
    })),
  },
}));

import {
  getCampaignDepartureCameraDistance,
  getCampaignTransitionOrigin,
} from "./campaignDepartureTransition.js";

describe("transição de saída da campanha", () => {
  it("mantém o zoom dentro de uma faixa segura", () => {
    expect(
      getCampaignDepartureCameraDistance(2),
    ).toBe(1.68);

    expect(
      getCampaignDepartureCameraDistance(4.5),
    ).toBeCloseTo(2.16);

    expect(
      getCampaignDepartureCameraDistance(8),
    ).toBe(2.24);
  });

  it("converte o marcador selecionado em origem percentual", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    Object.defineProperty(
      window,
      "innerWidth",
      {
        configurable: true,
        value: 1000,
      },
    );

    Object.defineProperty(
      window,
      "innerHeight",
      {
        configurable: true,
        value: 800,
      },
    );

    const root = {
      querySelector: () => ({
        getBoundingClientRect: () => ({
          left: 400,
          top: 300,
          width: 100,
          height: 100,
        }),
      }),
    };

    expect(
      getCampaignTransitionOrigin(root),
    ).toEqual({
      originX: "45.00%",
      originY: "43.75%",
    });

    Object.defineProperty(
      window,
      "innerWidth",
      {
        configurable: true,
        value: originalWidth,
      },
    );

    Object.defineProperty(
      window,
      "innerHeight",
      {
        configurable: true,
        value: originalHeight,
      },
    );
  });
});
