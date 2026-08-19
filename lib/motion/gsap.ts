"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

let registered = false;

/**
 * Registers GSAP's ScrollTrigger + SplitText once per page load and returns
 * the shared instances. Both plugins ship free in the core GSAP bundle
 * (GreenSock/Webflow, 2025) — no club membership or license key required.
 *
 * Must only be called from inside a Client Component effect (never at
 * module top-level of a Server Component) so it never touches `window`
 * during SSR.
 */
export function getGsap() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    // Mobile browsers fire `resize` when the URL bar/chrome collapses or
    // expands mid-scroll (height-only change, no actual layout width
    // change). ScrollTrigger's own internal resize listener would otherwise
    // auto-refresh every trigger on that event — recalculating the pinned
    // "Art. 1º...7º" stage's `end` (which depends on `window.innerHeight`)
    // and every `Reveal` toggle threshold WHILE the user is actively
    // scrolling through it. That's the documented cause of ScrollTrigger
    // content "not showing" or requiring extra scroll on mobile (GSAP
    // ScrollTrigger docs, `ignoreMobileResize` config option) — disabling it
    // is the official fix.
    ScrollTrigger.config({ ignoreMobileResize: true });
    registered = true;
  }
  return { gsap, ScrollTrigger, SplitText };
}

/** Reads `prefers-reduced-motion` at call time. SSR-safe (defaults to false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
