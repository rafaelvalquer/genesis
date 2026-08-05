import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appPath = path.join(
  process.cwd(),
  "src",
  "App.jsx",
);

function source() {
  return fs.readFileSync(appPath, "utf8");
}

describe("contrato da primeira confirmação de loadout", () => {
  it("usa um carregador reutilizável para o módulo da batalha", () => {
    const app = source();

    expect(app).toContain(
      "createRetryableLazyModule",
    );
    expect(app).toContain(
      "const GameCanvas = lazy(loadGameCanvasModule);",
    );
    expect(app).toContain(
      "loadGameCanvasModule.preload()",
    );
  });

  it("mantém LoadoutPicker e GameCanvas dentro de Suspense locais ao PlayPage", () => {
    const app = source();

    const playPageStart = app.indexOf(
      "export function PlayPage",
    );
    const settingsStart = app.indexOf(
      "export function SettingsPage",
    );

    expect(playPageStart)
      .toBeGreaterThanOrEqual(0);
    expect(settingsStart)
      .toBeGreaterThan(playPageStart);

    const playPage = app.slice(
      playPageStart,
      settingsStart,
    );

    expect(playPage).toMatch(
      /if\s*\(!started\)[\s\S]*?<Suspense[\s\S]*?<LoadoutPicker/,
    );

    expect(playPage).toMatch(
      /<Suspense[\s\S]*?<GameCanvas[\s\S]*?<\/Suspense>/,
    );
  });

  it("não depende do Suspense global para trocar loadout por batalha", () => {
    const app = source();

    const playPageStart = app.indexOf(
      "export function PlayPage",
    );
    const settingsStart = app.indexOf(
      "export function SettingsPage",
    );

    const playPage = app.slice(
      playPageStart,
      settingsStart,
    );

    const localSuspenseCount = (
      playPage.match(/<Suspense\b/g)
      || []
    ).length;

    expect(localSuspenseCount)
      .toBeGreaterThanOrEqual(2);
  });
});
