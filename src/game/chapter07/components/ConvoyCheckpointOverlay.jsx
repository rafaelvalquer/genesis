import ConvoyPreparationPanel from "./ConvoyPreparationPanel.jsx";

// Compatibility wrapper for callers that still use the old component name.
export default function ConvoyCheckpointOverlay({ convoy, supply, onStart }) {
  return <ConvoyPreparationPanel convoy={convoy} supply={Number.parseInt(supply, 10) || 0} supplyMax={Number.parseInt(String(supply).split("/")[1], 10) || convoy?.reserveMax || 0} onStart={onStart} />;
}
