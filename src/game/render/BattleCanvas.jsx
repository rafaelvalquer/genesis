import { useEffect } from "react";
import { VIEWPORT } from "../battleModel.js";
import { installNonPassiveContextMenuGuard } from "../hooks/battleCanvasEvents.js";
import { useBattleRenderLoop } from "../hooks/useBattleRenderLoop.js";

/** Canvas DOM boundary: pointer events and accessibility live here, never in a renderer. */
export default function BattleCanvas({
  canvasRef,
  ready,
  label,
  onClick,
  onContextMenu,
  onPointerMove,
  onPointerLeave,
  onFrame,
}) {
  useEffect(() => {
    if (!ready) return undefined;
    return installNonPassiveContextMenuGuard(canvasRef.current);
  }, [canvasRef, ready]);
  useBattleRenderLoop({ enabled: ready, onFrame });

  return <canvas
    ref={canvasRef}
    width={VIEWPORT.width}
    height={VIEWPORT.height}
    onClick={onClick}
    onContextMenu={onContextMenu}
    onMouseMove={onPointerMove}
    onMouseLeave={onPointerLeave}
    aria-label={label}
  />;
}
