"use client";

import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Thin vertical line that fills top-to-bottom as the user scrolls through the
 * "how it works" steps — a scrubbed progress indicator, not a pinned effect.
 * `scaleY` only (GPU-accelerated), origin-top so it reads as "drawing" down.
 */
export function ProgressLine({ className = "" }: { className?: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    if (!track || !fill || prefersReducedMotion()) return;

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        fill,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: track,
            start: "top 75%",
            end: "bottom 65%",
            scrub: 0.6,
          },
        },
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div ref={trackRef} aria-hidden className={`absolute w-px bg-silver/10 ${className}`}>
      <div ref={fillRef} className="h-full w-full origin-top bg-gradient-to-b from-silver to-silver-2" />
    </div>
  );
}
