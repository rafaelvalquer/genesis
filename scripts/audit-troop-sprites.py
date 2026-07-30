from __future__ import annotations

import json
import statistics
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "src" / "game" / "assets" / "troop"
REPORT_ROOT = ROOT / "reports"
JSON_OUTPUT = REPORT_ROOT / "troop-sprite-audit.json"
MARKDOWN_OUTPUT = REPORT_ROOT / "troop-sprite-standardization.md"
ALPHA_THRESHOLD = 24

CLASSIFICATION = {
    "artilheiraMorteiro": "precisa de refinamento visual",
    "bombardeiro": "precisa apenas de reexportação",
    "colossoImpacto": "precisa de refinamento visual",
    "demolidora": "precisa apenas de reexportação",
    "executorArco": "precisa de refinamento visual",
    "incinerador": "precisa apenas de reexportação",
    "interceptadorIcaro": "precisa apenas de reexportação",
    "krio": "precisa apenas de reexportação",
    "reator": "precisa apenas de reexportação",
}


def visible_metrics(image: Image.Image) -> dict[str, float | int]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()
    if not bbox:
        return {
            "left": 0,
            "top": 0,
            "right": 0,
            "bottom": 0,
            "width": 0,
            "height": 0,
            "height_ratio": 0,
            "area_ratio": 0,
            "centroid_x": 0,
            "centroid_y": 0,
            "support_x": 0,
        }

    left, top, right, bottom = bbox
    pixels = alpha.load()
    weight = weighted_x = weighted_y = 0
    support_xs: list[int] = []
    support_top = max(top, bottom - max(12, round((bottom - top) * 0.09)))
    for y in range(top, bottom):
        for x in range(left, right):
            value = pixels[x, y]
            if value < ALPHA_THRESHOLD:
                continue
            weight += value
            weighted_x += x * value
            weighted_y += y * value
            if y >= support_top:
                support_xs.append(x)

    visible_width = right - left
    visible_height = bottom - top
    support_x = (
        (min(support_xs) + max(support_xs)) / 2
        if support_xs
        else (left + right - 1) / 2
    )
    return {
        "left": left,
        "top": top,
        "right": right - 1,
        "bottom": bottom - 1,
        "width": visible_width,
        "height": visible_height,
        "height_ratio": visible_height / rgba.height,
        "area_ratio": (visible_width * visible_height) / (rgba.width * rgba.height),
        "centroid_x": weighted_x / weight / rgba.width,
        "centroid_y": weighted_y / weight / rgba.height,
        "support_x": support_x / rgba.width,
    }


def color_count(image: Image.Image) -> int | str:
    colors = image.convert("RGBA").getcolors(maxcolors=262_145)
    return len(colors) if colors is not None else ">262144"


def summarize_state(files: list[Path]) -> dict:
    frames = []
    for path in files:
        with Image.open(path) as image:
            metrics = visible_metrics(image)
            frames.append({
                "file": path.name,
                "size": list(image.size),
                "mode": image.mode,
                "colors": color_count(image),
                **metrics,
            })
    heights = [frame["height_ratio"] for frame in frames]
    bottoms = [frame["bottom"] / frame["size"][1] for frame in frames]
    centers = [frame["centroid_x"] for frame in frames]
    supports = [frame["support_x"] for frame in frames]
    return {
        "frame_count": len(frames),
        "height_ratio_min": min(heights),
        "height_ratio_median": statistics.median(heights),
        "height_ratio_max": max(heights),
        "baseline_spread": max(bottoms) - min(bottoms),
        "centroid_x_spread": max(centers) - min(centers),
        "support_x_spread": max(supports) - min(supports),
        "scale_spread": max(heights) - min(heights),
        "frames": frames,
    }


def default_classification(troop: str, modes: Counter, sizes: Counter, states: dict) -> str:
    if troop in CLASSIFICATION:
        return CLASSIFICATION[troop]
    if any(state["baseline_spread"] > 0.035 for state in states.values()):
        return "precisa de correção de alinhamento"
    if "P" in modes or min(height for _, height in sizes) < 384:
        return "precisa apenas de reexportação"
    if any(state["scale_spread"] > 0.18 for state in states.values()):
        return "precisa de revisão de animação"
    return "não precisa de alteração"


def audit() -> dict:
    troops = {}
    for troop_dir in sorted(path for path in ASSET_ROOT.iterdir() if path.is_dir()):
        states = {}
        sizes: Counter = Counter()
        modes: Counter = Counter()
        color_values: list[int] = []
        for state_dir in sorted(path for path in troop_dir.iterdir() if path.is_dir()):
            files = sorted(
                state_dir.glob("frame*.png"),
                key=lambda path: int(path.stem.removeprefix("frame")),
            )
            if not files:
                continue
            summary = summarize_state(files)
            states[state_dir.name] = summary
            for frame in summary["frames"]:
                sizes[tuple(frame["size"])] += 1
                modes[frame["mode"]] += 1
                if isinstance(frame["colors"], int):
                    color_values.append(frame["colors"])

        classification = default_classification(troop_dir.name, modes, sizes, states)
        troops[troop_dir.name] = {
            "classification": classification,
            "frame_count": sum(state["frame_count"] for state in states.values()),
            "sizes": {f"{width}x{height}": count for (width, height), count in sizes.items()},
            "modes": dict(modes),
            "colors_median": round(statistics.median(color_values)) if color_values else ">262144",
            "states": states,
        }
    return {"standard": {
        "format": "PNG RGBA, 8 bits por canal",
        "height_occupancy": "80%–90%",
        "minimum_source_density": "2,16× a altura máxima de exibição",
        "rules": [
            "contornos limpos e detalhes legíveis",
            "ponto de apoio e centro de massa consistentes",
            "sem fundo, texto ou sombra de chão",
            "sem deslocamento involuntário entre frames",
        ],
    }, "troops": troops}


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def write_markdown(data: dict) -> None:
    lines = [
        "# Auditoria e padronização dos sprites de tropas",
        "",
        "Relatório gerado por `scripts/audit-troop-sprites.py` a partir dos PNGs consumidos pelo jogo.",
        "",
        "## Padrão proposto",
        "",
        "- PNG RGBA, 8 bits por canal e sem paleta indexada.",
        "- Ocupação vertical desejada entre 80% e 90%, medida pela caixa visível do alfa.",
        "- Fonte com densidade mínima equivalente a 2,16× a altura máxima de exibição.",
        "- Ponto de apoio estável; variação de base recomendada de no máximo 1% da altura do canvas.",
        "- Centro de massa sem deslocamento involuntário; movimentos de ataque deliberados são avaliados visualmente.",
        "- Contornos limpos, sombras suaves, volumes legíveis e detalhes maiores que 3 px.",
        "- Sem cenário, texto, sombra de chão ou projétil completo incorporado.",
        "",
        "## Inventário e classificação",
        "",
        "| Tropa | Frames | Canvas / modo | Ocupação vertical | Base máx. | Classificação |",
        "|---|---:|---|---:|---:|---|",
    ]
    for troop, summary in data["troops"].items():
        height_values = [
            state["height_ratio_median"]
            for state in summary["states"].values()
        ]
        baseline = max(
            (state["baseline_spread"] for state in summary["states"].values()),
            default=0,
        )
        canvas = ", ".join(summary["sizes"])
        mode = ", ".join(summary["modes"])
        lines.append(
            f"| `{troop}` | {summary['frame_count']} | {canvas}; {mode} | "
            f"{pct(min(height_values))}–{pct(max(height_values))} | {pct(baseline)} | "
            f"{summary['classification']} |"
        )

    lines.extend([
        "",
        "## Resultado do lote priorizado",
        "",
        "- **Vórtice / Executor de Arco:** refinamento visual reexportado dos masters em 512×512 RGBA; cinco estados com oito frames.",
        "- **Colosso de Impacto:** refinamento visual reexportado dos masters em 512×512 RGBA; três estados com oito frames.",
        "- **Artilheira de Morteiro:** refinamento visual reexportado em 576×384 RGBA para preservar a silhueta horizontal.",
        "- **Reator, Interceptador Ícaro, Demolidora, Incinerador, Krio e Bombardeiro:** remasters reexportados em 384×384 RGBA, preservando estados, contagem e nomes.",
        "",
        "Os masters existentes em `art/spritesheets/` e `art/sprites/` foram mantidos como fonte de verdade. Os scripts de processamento agora reproduzem as novas dimensões e o formato RGBA.",
        "",
        "## Próximas prioridades",
        "",
        "1. Reexportar as tropas ainda indexadas (`cacadorLeviatas`, `lumiUrsa7`, `medicaNanites`) a partir de seus masters, sem alterar desenho.",
        "2. Refinar `droneSentinela`, cujo canvas 256×192 fica abaixo do padrão de densidade.",
        "3. Corrigir o único frame indexado de `colono` e uniformizar o modo com os demais frames.",
        "4. Revisar visualmente estados com grande variação de silhueta antes de interpretar variação de centro como erro; ataques e mortes podem deslocar a caixa visível de forma intencional.",
        "5. Manter pontos de disparo e impacto como metadados/configuração do jogo; a auditoria de pixels não consegue distingui-los com segurança de brilhos decorativos.",
        "",
        "## Critérios de aceite automatizados",
        "",
        "- Contagem de frames e nomes preservados.",
        "- Dimensão e modo de cor conferidos por arquivo.",
        "- Alfa presente, cantos transparentes e sprite não vazio.",
        "- Ocupação, base, centroide e escala medidos por estado.",
        "- Testes de assets e build executados após qualquer reexportação.",
        "",
    ])
    MARKDOWN_OUTPUT.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    result = audit()
    JSON_OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(result)
    print(f"Audit written to {MARKDOWN_OUTPUT}")
    print(f"Machine-readable data written to {JSON_OUTPUT}")
