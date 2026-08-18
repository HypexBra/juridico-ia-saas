interface LightBeamProps {
  /** Rotation of the light cone, in degrees. */
  angle?: number;
  /** Corner the beam appears to be cast from — like light through a tall window. */
  origin?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  className?: string;
}

const ORIGIN_POSITION: Record<NonNullable<LightBeamProps["origin"]>, string> = {
  "top-left": "-10% -30%",
  "top-right": "110% -30%",
  "bottom-left": "-10% 130%",
  "bottom-right": "110% 130%",
};

/**
 * Diagonal courtroom-window light: a static conic-gradient cast from a
 * corner, not a straight rectangular ray. Pure CSS, no JS, no animation —
 * decorative depth that never competes with `prefers-reduced-motion` or
 * costs a frame. Server Component (no client boundary needed).
 */
export function LightBeam({ angle = 20, origin = "top-right", className = "" }: LightBeamProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        background: `conic-gradient(from ${angle}deg at ${ORIGIN_POSITION[origin]}, transparent 0deg, rgba(232,201,106,.14) 6deg, transparent 17deg, transparent 206deg, rgba(201,168,76,.09) 217deg, transparent 228deg)`,
      }}
    />
  );
}
