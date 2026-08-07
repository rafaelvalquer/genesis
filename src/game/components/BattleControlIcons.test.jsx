import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
} from "./BattleControlIcons.jsx";

afterEach(cleanup);

describe("ícones dos controles de batalha", () => {
  it("desenha a pausa com duas barras reais", () => {
    const { container } = render(<PauseIcon />);
    expect(container.querySelectorAll("rect")).toHaveLength(2);
    expect(container.textContent).not.toContain("Ⅱ");
  });

  it("desenha os controles de continuar e tela cheia sem texto decorativo", () => {
    const { rerender, container } = render(<PlayIcon />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(screen.queryByText("▶")).not.toBeInTheDocument();

    rerender(<EnterFullscreenIcon />);
    expect(container.querySelectorAll("path")).toHaveLength(4);

    rerender(<ExitFullscreenIcon />);
    expect(container.querySelectorAll("path")).toHaveLength(4);
  });
});
