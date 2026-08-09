import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PHASES } from "../game/content.js";
import { getEnemyUnlockAt } from "../game/enemyInfo.js";
import EnemyIntel, { deriveEnemyIntel } from "./EnemyIntel.jsx";

describe("amea\u00e7as priorit\u00e1rias", () => {
  it("inclui o chefe de bossEncounter, consolida duplicatas e o prioriza", () => {
    const intel = deriveEnemyIntel({
      waves: [
        { enemies: [{ type: "medu", count: 20 }] },
        {
          enemies: [{ type: "leviathanNereida", count: 2 }],
          bossEncounter: { type: "leviathanNereida" },
        },
      ],
    });

    expect(intel[0]).toMatchObject({
      id: "leviathanNereida",
      count: 3,
      firstWave: 2,
      priorityTag: "CHEFE",
    });
  });

  it("oculta a identidade do chefe antes do desbloqueio e a revela depois", () => {
    const phase = PHASES[39];
    const { rerender } = render(<EnemyIntel phase={phase} unlockedPhaseIndex={38} />);

    expect(screen.getByText("ASSINATURA HOSTIL DESCONHECIDA")).toBeInTheDocument();
    expect(screen.getByText("CHEFE")).toBeInTheDocument();
    expect(screen.queryByLabelText("1 hostis projetados")).not.toBeInTheDocument();

    rerender(<EnemyIntel phase={phase} unlockedPhaseIndex={39} />);
    expect(screen.queryByText("ASSINATURA HOSTIL DESCONHECIDA")).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 hostis projetados")).toBeInTheDocument();
  });

  it("desbloqueia o Leviat\u00e3 no primeiro bossEncounter da campanha", () => {
    expect(getEnemyUnlockAt("leviathanNereida")).toBe(39);
  });
});
