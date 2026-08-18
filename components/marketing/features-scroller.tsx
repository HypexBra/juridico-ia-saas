"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";

interface ScrollerArticle {
  numeral: string;
  title: string;
  description: string;
  icon: ReactNode;
}

/**
 * Apple-style pinned scrollytelling for the "Art. 1º...7º" feature list.
 * Desktop (>=1024px) only, via `gsap.matchMedia`: the stage pins while the
 * wrapper scrolls, and articles cross-fade/slide in sequence on a scrubbed
 * timeline (1 scroll-tick = 1 timeline unit, no callbacks needed beyond the
 * active-index indicator).
 *
 * Fallback (mobile/tablet, no JS, or `prefers-reduced-motion`): the articles
 * stay in normal document flow — a perfectly readable static stacked list,
 * because the pin/crossfade transform is only ever applied inside the
 * matchMedia handler below.
 */
export function FeaturesScroller({ articles }: { articles: ScrollerArticle[] }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<Array<HTMLDivElement | null>>([]);
  const counterRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;
    if (!wrapper || !stage || prefersReducedMotion()) return;

    const { gsap } = getGsap();
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      const panels = panelsRef.current.filter((p): p is HTMLDivElement => Boolean(p));
      if (panels.length < 2) return;

      gsap.set(stage, { position: "relative", height: "78vh" });
      gsap.set(panels, { position: "absolute", inset: 0, autoAlpha: 0, y: 48 });
      gsap.set(panels[0], { autoAlpha: 1, y: 0 });

      const setCounter = (idx: number) => {
        if (counterRef.current) {
          counterRef.current.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(panels.length).padStart(2, "0")}`;
        }
      };
      setCounter(0);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          start: "top top",
          end: () => `+=${(panels.length - 1) * window.innerHeight}`,
          scrub: 0.8,
          pin: stage,
          // Root cause of the "stuck / panels stacking in the wrong place" bug:
          // ScrollTrigger's default pinning method sets `position: fixed` on
          // the pinned element. The page's root wrapper (`app/page.tsx`) has
          // `overflow-x: hidden`, and any ancestor with `overflow` other than
          // `visible` breaks `position: fixed` containment in some browsers —
          // it's a documented GSAP gotcha (see ScrollTrigger docs, "pinning
          // does not work" / overflow warning). The pinned stage was being
          // positioned relative to that overflow-clipped ancestor instead of
          // the viewport, so as soon as ScrollTrigger recalculated on scroll
          // it looked like the pin "wasn't releasing" and every panel
          // rendered stacked at the same (wrong) offset. Forcing
          // `pinType: "transform"` makes GSAP pin via `transform` on the
          // element instead of `position: fixed`, which is immune to
          // ancestor overflow and works correctly regardless of it.
          pinType: "transform",
          invalidateOnRefresh: true,
          onUpdate: (self) => setCounter(Math.round(self.progress * (panels.length - 1))),
        },
      });

      panels.forEach((panel, i) => {
        if (i === 0) return;
        tl.to(panels[i - 1], { autoAlpha: 0, y: -48, duration: 1, ease: "power2.in" }, i - 1).fromTo(
          panel,
          { autoAlpha: 0, y: 48 },
          { autoAlpha: 1, y: 0, duration: 1, ease: "power2.out" },
          i - 1,
        );
      });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        gsap.set(stage, { clearProps: "position,height" });
        gsap.set(panels, { clearProps: "position,inset,opacity,visibility,transform" });
      };
    });

    return () => mm.revert();
  }, [articles.length]);

  return (
    <div ref={wrapperRef} className="hidden lg:block">
      <div
        ref={stageRef}
        className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8"
      >
        {articles.map((article, i) => {
          const alignRight = i % 2 === 1;
          return (
            <div
              key={article.numeral}
              ref={(el) => {
                panelsRef.current[i] = el;
              }}
              className={`grid grid-cols-1 ${alignRight ? "justify-items-end" : "justify-items-start"}`}
            >
              {/* Oversized ghost numeral — the "clause number" as background
                  type, not a boxed grid column. It's what the golden thread
                  visually threads past. */}
              <span
                aria-hidden
                className={`relative z-0 select-none font-display text-[7rem] font-black leading-none text-gold/10 sm:text-[9rem] ${alignRight ? "pr-[6%]" : "pl-[2%]"}`}
              >
                {article.numeral}
              </span>
              <div
                className={`relative z-10 -mt-16 flex max-w-xl flex-col gap-4 sm:-mt-24 ${
                  alignRight ? "items-end pr-[6%] text-right" : "items-start pl-[2%]"
                }`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-sm border border-gold/25 bg-gold/8 text-gold">
                  {article.icon}
                </span>
                <h3 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
                  {article.title}
                </h3>
                <p className="text-lg leading-relaxed text-muted">{article.description}</p>
              </div>
            </div>
          );
        })}

        <span
          aria-hidden
          ref={counterRef}
          className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-display text-xs font-semibold tracking-[0.2em] text-gold/50"
        >
          01 / {String(articles.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
