import { useTroopPreviewFrames } from "./useTroopPreviewFrames.js";

export default function AnimatedTroopPreview({ troop, reduceMotion, className = "" }) {
  const { src, animated, visual } = useTroopPreviewFrames(troop, reduceMotion);
  if (!troop || !src) return null;
  return <img
    className={`loadout-animated-troop ${animated ? "is-animated" : ""} ${className}`}
    src={src}
    alt={`Projeção holográfica de ${troop.label}`}
    draggable="false"
    style={{
      "--sprite-scale": visual.scale,
      "--sprite-x": `${visual.offsetX}px`,
      "--sprite-y": `${visual.offsetY}px`,
      "--sprite-flip": visual.flipX ? -1 : 1,
    }}
  />;
}
