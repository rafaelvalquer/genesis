import React from "react";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: "false",
};

export function PauseIcon() {
  return (
    <svg {...iconProps} className="battle-control-icon pause-icon">
      <rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg {...iconProps} className="battle-control-icon play-icon">
      <path d="M7 4.5v15L19 12 7 4.5Z" fill="currentColor" />
    </svg>
  );
}

export function EnterFullscreenIcon() {
  return (
    <svg {...iconProps} className="battle-control-icon fullscreen-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H4v5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M9 20H4v-5" />
    </svg>
  );
}

export function ExitFullscreenIcon() {
  return (
    <svg {...iconProps} className="battle-control-icon fullscreen-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M15 20v-5h5" />
      <path d="M9 20v-5H4" />
    </svg>
  );
}
