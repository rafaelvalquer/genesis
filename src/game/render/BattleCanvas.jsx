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
    onPointerMove={onPointerMove}
    onPointerLeave={onPointerLeave}
    onPointerCancel={onPointerLeave}
    onPointerDown={(event) => {
      if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerUp={(event) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    }}
    style={{ touchAction: "none" }}
    aria-label={label}
  />;
}
