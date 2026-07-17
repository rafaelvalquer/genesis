import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DECISIONS } from "./content.js";
import { DecisionModal } from "./GameCanvas.jsx";

describe("modal de decisões entre ondas", () => {
  it("mostra o nível, exatamente duas opções e encaminha a escolha", () => {
    const onChoose = vi.fn();
    const options = [DECISIONS.emergency_energy, DECISIONS.emergency_shield];
    render(<DecisionModal level={1} options={options} onChoose={onChoose} />);

    expect(screen.getByText("Decisão · Nível 1")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Carga emergencial/i }));
    expect(onChoose).toHaveBeenCalledWith(DECISIONS.emergency_energy);
  });
});
