"use client";

import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

type Knot = [xFraction: number, yFraction: number];

// Desktop: an organic sway crossing left/right roughly six times down the
// page, loosely tracking where each section's asymmetric content sits (hero
// visual on the right, features numerals on the left, how-it-works zigzag,
// pricing, cta quote) — an art-directed approximation, not pixel-coupled to
// each section's DOM (that would require per-section refs for a purely
// decorative element, not worth the coupling).
const DESKTOP_KNOTS: Knot[] = [
  [0.66, 0],
  [0.22, 0.11],
  [0.5, 0.24],
  [0.15, 0.38],
  [0.44, 0.52],
  [0.18, 0.67],
  [0.56, 0.8],
  [0.28, 0.92],
  [0.32, 1],
];

// Mobile: collapses to a near-straight vertical line hugging the left edge —
// "simpler on small screens", per spec, so it never fights with narrow text
// columns or causes horizontal scroll.
const MOBILE_KNOTS: Knot[] = [
  [0.08, 0],
  [0.11, 0.5],
  [0.07, 1],
];

/** Catmull-Rom -> cubic Bezier conversion for a smooth curve through knots. */
function buildPathD(knots: Knot[], width: number, height: number): string {
  const pts = knots.map(([fx, fy]): [number, number] => [fx * width, fy * height]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * The "silver thread": one continuous organic SVG path running the full
 * height of the marketing page (hero -> cta-final), physically stitching
 * every section together instead of leaving them as disconnected stacked
 * blocks. It draws itself progressively as the user scrolls (a
 * `stroke-dashoffset` scrub) — the thread's narrative job is to guide the
 * eye downward and imply "one continuous document/case file", not to
 * decorate.
 *
 * Geometry note: the path's control points and total length depend on the
 * *measured* pixel size of the page and must be rebuilt per breakpoint
 * (mobile gets a cheaper, near-straight line). That's why this uses GSAP
 * ScrollTrigger rather than a pure CSS `animation-timeline: scroll()`: CSS
 * scroll-driven animations can't recompute an organic curve's control
 * points on resize, only interpolate fixed keyframes — fine for the nav
 * progress bar and cta glow (already CSS-only in this codebase), not for a
 * geometry that must be regenerated responsively.
 */
export function SilverThread() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const glow = glowRef.current;
    if (!container || !svg || !path || !glow) return;

    const reduced = prefersReducedMotion();

    const draw = (): number => {
      const width = container.clientWidth;
      const height = container.scrollHeight;
      if (!width || !height) return 0;
      const isMobile = width < 1024;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const d = buildPathD(isMobile ? MOBILE_KNOTS : DESKTOP_KNOTS, width, height);
      path.setAttribute("d", d);
      glow.setAttribute("d", d);
      return path.getTotalLength();
    };

    let length = draw();

    if (reduced) {
      // Static, fully-drawn thread — no scroll-linked motion, still connects
      // the sections visually.
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = "0";
      glow.style.strokeDasharray = `${length}`;
      glow.style.strokeDashoffset = "0";
      return;
    }

    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    glow.style.strokeDasharray = `${length}`;
    glow.style.strokeDashoffset = `${length}`;

    const { gsap, ScrollTrigger } = getGsap();

    const tween = gsap.to([path, glow], {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
        invalidateOnRefresh: true,
      },
    });

    let resizeTimer: ReturnType<typeof setTimeout>;
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Mobile browsers fire `resize` when the URL bar/chrome collapses or
      // expands during scroll — a height-only change, not an actual layout
      // change. Rebuilding the thread's path and force-calling
      // `ScrollTrigger.refresh()` on every one of those (mid-scroll, often
      // right on top of the pinned "Art. 1º...7º" section) recalculates
      // every trigger's start/end — including the pin's own `end`, which
      // depends on `window.innerHeight` — out from under the user's current
      // scroll position. That produced both reported bugs: content that had
      // already revealed re-hiding (mobile "não aparece") and the pinned
      // stage visibly jumping backward mid-scroll (desktop "voltando").
      // `ScrollTrigger.config({ ignoreMobileResize: true })` only guards
      // ScrollTrigger's own internal listener, not this app-level one, so
      // it must be guarded here too: only redraw/refresh when the width
      // actually changed (real resize, orientation change, zoom) — never
      // on a height-only mobile chrome resize.
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        length = draw();
        path.style.strokeDasharray = `${length}`;
        glow.style.strokeDasharray = `${length}`;
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Ambient depth blobs replacing the old flat per-section bg-navy/
          bg-navy-2 rectangles — soft, borderless, so sections read as one
          continuous scene instead of stacked colored blocks. */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 20% 0%, rgba(199,210,232,.07), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-[42%] h-[55vh]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 82% 50%, rgba(15,32,64,.85), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-[78%] h-[50vh]"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 12% 50%, rgba(199,210,232,.05), transparent 70%)",
        }}
      />

      <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="thread-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7d2e8" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#e3ebf7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#c7d2e8" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          ref={glowRef}
          fill="none"
          stroke="#e3ebf7"
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.1}
          style={{ filter: "blur(7px)" }}
        />
        <path
          ref={pathRef}
          fill="none"
          stroke="url(#thread-gradient)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
