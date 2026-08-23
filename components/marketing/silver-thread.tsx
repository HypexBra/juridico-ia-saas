"use client";

import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

type Knot = [xFraction: number, yFraction: number];

// Tinta sobre papel (spec redesign v3): a linha é um fio condutor quase
// imperceptível em tinta (#141412 @ 16%), sem gradiente e sem glow — o
// gesto visual vem do desenho progressivo no scroll e dos nós-lacre, não
// de profundidade artificial.
const THREAD_STROKE = "rgba(20,20,18,0.16)";
const NODE_FILL = "#8b2e1f";
const LABEL_FILL = "rgba(20,20,18,0.45)";

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

// Mobile: collapses to a near-straight vertical line hugging the right edge,
// inside the section's own horizontal padding gutter (`px-5`/`px-8`) —
// hugging the left edge used to cross under the numeral/icon column that
// sits flush left in every mobile section, cutting through the words. The
// right edge is never used by text (mobile sections are single-column,
// left-aligned), so the thread reads as a margin rule instead of a redline
// through the copy. Mobile renders ONLY the bare ink line: no knots, no
// labels (responsive spec — less visual complexity on small screens).
const MOBILE_KNOTS: Knot[] = [
  [0.94, 0],
  [0.97, 0.5],
  [0.94, 1],
];

/**
 * Case milestones pinned to VERTICAL fractions of the page height. The x
 * position of each node is NOT a fixed fraction: it always follows the real
 * curve (see `placeNodes`), so every node sits exactly on the thread even
 * though the curve sways horizontally. Labels are desktop-only (>= lg),
 * matching the breakpoint guard used for the organic curve itself.
 */
const CASE_NODES = [
  { yFraction: 0.06, label: "CASO" },
  { yFraction: 0.22, label: "DOCUMENTO" },
  { yFraction: 0.4, label: "ANÁLISE" },
  { yFraction: 0.56, label: "ESTRATÉGIA" },
  { yFraction: 0.74, label: "TAREFA" },
  { yFraction: 0.92, label: "AÇÃO" },
] as const;

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
 * Arc length `s` where the drawn path crosses `targetY`.
 *
 * Both knot tables have strictly increasing y-fractions and the Catmull-Rom
 * construction keeps y monotonic between consecutive knots (each segment's
 * control-point ys stay between its endpoints' ys), so y along the arc is
 * monotonic non-decreasing — bisection over arc length converges on THE one
 * crossing instead of guessing that arc-length fractions map linearly to
 * height fractions (they don't: horizontal sway makes arc length uneven).
 */
function findLengthAtY(path: SVGPathElement, targetY: number, totalLength: number): number {
  let lo = 0;
  let hi = totalLength;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (path.getPointAtLength(mid).y < targetY) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * O "Fio do Caso": uma única linha SVG contínua em tinta sobre papel,
 * atravessando toda a altura da landing (hero -> cta-final) e costurando as
 * seções num documento só. Desenha-se progressivamente no scroll (scrub de
 * `stroke-dashoffset`). Sobre o fio, seis nós-lacre (CASO -> AÇÃO) surgem
 * quando o scroll os alcança — desktop apenas; no mobile sobra só a linha
 * em tinta na margem direita. Sem gradiente, sem blur, sem glow: a assinatura
 * é tipográfica e posicional, não luminosa.
 *
 * Geometry note: the path's control points, total length AND node positions
 * depend on the *measured* pixel size of the page and must be rebuilt per
 * breakpoint (mobile gets a cheaper, near-straight line). That's why this
 * uses GSAP ScrollTrigger rather than a pure CSS `animation-timeline:
 * scroll()`: CSS scroll-driven animations can't recompute an organic curve's
 * control points on resize, only interpolate fixed keyframes.
 */
export function SilverThread() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const nodesRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const nodesRoot = nodesRef.current;
    if (!container || !svg || !path || !nodesRoot) return;

    const nodeEls = Array.from(nodesRoot.querySelectorAll<SVGGElement>("[data-case-node]"));

    const reduced = prefersReducedMotion();

    // Rebuilds the curve AND re-seats every milestone node exactly on the
    // new curve (x comes from the path itself, never from a fixed fraction).
    const draw = (): number => {
      const width = container.clientWidth;
      const height = container.scrollHeight;
      if (!width || !height) return 0;
      const isMobile = width < 1024;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const d = buildPathD(isMobile ? MOBILE_KNOTS : DESKTOP_KNOTS, width, height);
      path.setAttribute("d", d);
      const total = path.getTotalLength();
      for (let i = 0; i < nodeEls.length && i < CASE_NODES.length; i++) {
        const s = findLengthAtY(path, CASE_NODES[i].yFraction * height, total);
        const pt = path.getPointAtLength(s);
        nodeEls[i].setAttribute("transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
      }
      return total;
    };

    let length = draw();

    if (reduced) {
      // Static, fully-drawn thread with all milestones visible — no
      // scroll-linked motion, still connects the sections visually.
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = "0";
      for (const el of nodeEls) {
        el.style.opacity = "1";
        el.style.visibility = "visible";
      }
      return;
    }

    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const { gsap, ScrollTrigger } = getGsap();

    const tween = gsap.to(path, {
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

    // Each milestone fades in when its vertical fraction of the page hits
    // the viewport center — i.e., roughly when the drawing stroke reaches
    // it (the stroke is scrubbed across the same full-page span). Plain
    // toggles (not scrubbed): a node is a stamp, not a dial. Reverse on
    // leave-back so scrolling up re-hides it consistently with the thread
    // un-drawing. Groups start at opacity 0 in the markup (no flash before
    // hydration); on mobile they're display:none via `hidden lg:block`,
    // so these tweens are inert there.
    const nodeTweens = nodeEls.map((el, i) =>
      gsap.to(el, {
        autoAlpha: 1,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: container,
          start: `${CASE_NODES[i].yFraction * 100}% center`,
          scrub: false,
          toggleActions: "play none none reverse",
        },
      }),
    );

    let resizeTimer: ReturnType<typeof setTimeout>;
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Mobile browsers fire `resize` when the URL bar/chrome collapses or
      // expands during scroll — a height-only change, not an actual layout
      // change. Rebuilding the thread's path and force-calling
      // `ScrollTrigger.refresh()` on every one of those (mid-scroll, often
      // right on top of the pinned stage) recalculates every trigger's
      // start/end out from under the user's current scroll position. That
      // produced both reported bugs: content that had already revealed
      // re-hiding (mobile "não aparece") and the pinned stage visibly
      // jumping backward mid-scroll (desktop "voltando").
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
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      for (const nt of nodeTweens) {
        nt.scrollTrigger?.kill();
        nt.kill();
      }
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
      <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="none">
        <path
          ref={pathRef}
          fill="none"
          stroke={THREAD_STROKE}
          strokeWidth={1}
          strokeLinecap="round"
        />
        {/* Milestones live on the curve; hidden below lg (bare ink line on
            mobile). Each group is translated onto the path in JS. */}
        <g ref={nodesRef} className="hidden lg:block">
          {CASE_NODES.map(({ label }) => (
            <g key={label} data-case-node opacity={0}>
              <circle r={3} fill={NODE_FILL} />
              <text
                x={14}
                y={0}
                dominantBaseline="central"
                fill={LABEL_FILL}
                fontSize={10}
                letterSpacing="0.15em"
                className="font-mono-ed"
              >
                {label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
