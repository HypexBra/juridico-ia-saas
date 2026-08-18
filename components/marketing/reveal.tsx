"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

interface RevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  as?: "div" | "li";
  /** Vertical travel distance in px before settling. Default 28. */
  distance?: number;
}

/**
 * Scroll reveal powered by GSAP ScrollTrigger (power3.out, ~900ms). Replaces
 * the previous IntersectionObserver + CSS-transition implementation with the
 * same public API, so every call site keeps working unchanged.
 *
 * Respects `prefers-reduced-motion`: the element is made visible immediately
 * with no animation. Each instance tears itself down on unmount via
 * `gsap.context().revert()` so no ScrollTrigger keeps listening off-screen.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
  as = "div",
  distance = 28,
}: RevealProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const liRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const node = as === "li" ? liRef.current : divRef.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      node.style.opacity = "1";
      node.style.transform = "none";
      return;
    }

    const { gsap } = getGsap();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { autoAlpha: 0, y: distance },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          delay: delayMs / 1000,
          scrollTrigger: {
            trigger: node,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        },
      );
    });

    return () => ctx.revert();
  }, [as, delayMs, distance]);

  const classes = `opacity-0 will-change-transform ${className}`;

  if (as === "li") {
    return (
      <li ref={liRef} className={classes}>
        {children}
      </li>
    );
  }

  return (
    <div ref={divRef} className={classes}>
      {children}
    </div>
  );
}
