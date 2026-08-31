import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import TacticalReportTabs from "./TacticalReportTabs.jsx";

function TabsFixture() {
  const [tab, setTab] = useState("overview");
  return <TacticalReportTabs activeTab={tab} onChange={setTab} />;
}

describe("TacticalReportTabs", () => {
  it("expõe tabs semânticas e permite avançar pelo teclado", () => {
    render(<TabsFixture />);
    const overview = screen.getByRole("tab", { name: /visão geral/i });
    expect(overview).toHaveAttribute("aria-selected", "true");
    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /tropas/i })).toHaveAttribute("aria-selected", "true");
  });
});
