"use client";

import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

interface TextRevealProps {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  children: string;
  /** "load" plays immediately on mount (above-the-fold), "scroll" waits for ScrollTrigger. */
  trigger?: "load" | "scroll";
  delayMs?: number;
}

/**
 * Splits a heading into words with GSAP SplitText and reveals them with a
 * staggered translateY + opacity tween (Apple/keynote-style headline entrance).
 * SplitText ships free in the core GSAP bundle (GreenSock/Webflow, 2025).
 *
 * If JS never runs or `prefers-reduced-motion` is set, the heading stays as
 * plain, fully visible text — SplitText is only invoked when an animation
 * will actually play.
 */
export function TextReveal({
  as: Tag = "span",
  className = "",
  children,
  trigger = "load",
  delayMs = 0,
}: TextRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;

    const { gsap, SplitText } = getGsap();
    let split: InstanceType<typeof SplitText> | null = null;

    const ctx = gsap.context(() => {
      split = new SplitText(node, {
        type: "words",
        wordsClass: "text-reveal__unit",
      });

      gsap.fromTo(
        split.words,
        { autoAlpha: 0, y: "110%" },
        {
          autoAlpha: 1,
          y: "0%",
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.045,
          delay: delayMs / 1000,
          scrollTrigger:
            trigger === "scroll"
              ? { trigger: node, start: "top 85%", toggleActions: "play none none reverse" }
              : undefined,
        },
      );
    }, node);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, [children, trigger, delayMs]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
