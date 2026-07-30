import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MaintenancePanel from "./MaintenancePanel.jsx";

afterEach(cleanup);

describe("manutenção da campanha", () => {
  it("executa o reset e confirma o resultado", () => {
    const onReset = vi.fn(() => true);
    render(<MaintenancePanel onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "APAGAR PROGRESSO LOCAL" }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("PROGRESSO LOCAL RESTAURADO");
  });

  it("não informa sucesso quando a confirmação é cancelada", () => {
    render(<MaintenancePanel onReset={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "APAGAR PROGRESSO LOCAL" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
