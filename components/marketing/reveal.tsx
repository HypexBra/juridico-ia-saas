"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  as?: "div" | "li";
}

/**
 * Client-only scroll reveal. No animation library: a single IntersectionObserver
 * flips one boolean per element, CSS transitions do the rest. Used sparingly
 * (feature articles, steps, pricing) — not on every DOM node.
 */
export function Reveal({ children, delayMs = 0, className = "", as = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement | HTMLLIElement | null>(null);
  const supportsObserver = typeof IntersectionObserver !== "undefined";
  const [visible, setVisible] = useState(!supportsObserver);

  useEffect(() => {
    const node = ref.current;
    if (!node || !supportsObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [supportsObserver]);

  const style = { transitionDelay: `${delayMs}ms` };
  const classes = `transition-all duration-700 ease-out will-change-transform ${
    visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
  } ${className}`;

  if (as === "li") {
    return (
      <li ref={ref as React.RefObject<HTMLLIElement>} style={style} className={classes}>
        {children}
      </li>
    );
  }

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} style={style} className={classes}>
      {children}
    </div>
  );
}
