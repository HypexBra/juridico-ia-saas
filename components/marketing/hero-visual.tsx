"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Wraps the hero product mock: entrance (scale + fade in on load) plus a
 * subtle scroll-linked parallax drift while the hero is in view. No pin, no
 * layout impact — only `transform`/`opacity`, cheap enough to keep on mobile.
 */
export function HeroVisual({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      node.style.opacity = "1";
      return;
    }

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { autoAlpha: 0, y: 40, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: "power3.out", delay: 0.35 },
      );

      gsap.to(node, {
        y: -24,
        ease: "none",
        scrollTrigger: {
          trigger: node,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }, node);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="opacity-0 will-change-transform">
      {children}
    </div>
  );
}
