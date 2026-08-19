"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 68;
const MAX_PULL = 100;

/**
 * Pull-to-refresh visual (gesto de toque nativo) para o app interno. Só
 * ativa quando o gesto começa com a página já no topo do scroll — não
 * interfere em listas com scroll interno. Ao passar do threshold, dispara
 * `router.refresh()` (revalida os Server Components da rota atual) e mostra
 * um indicador giratório até a resposta assentar.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshing || window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      startYRef.current = touch.clientY;
      setDragging(true);
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startYRef.current;
      if (delta > 0 && window.scrollY === 0) {
        setPull(Math.min(delta * 0.5, MAX_PULL));
      }
    }

    function onTouchEnd() {
      if (startYRef.current === null) return;
      setDragging(false);
      startYRef.current = null;
      setPull((current) => {
        if (current > THRESHOLD) {
          setRefreshing(true);
          router.refresh();
          window.setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 650);
          return THRESHOLD;
        }
        return 0;
      });
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing, router]);

  const indicatorOpacity = Math.min(pull / THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden"
        style={{ height: pull, transition: dragging ? "none" : "height 250ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div
          className={`mt-3 flex h-7 w-7 items-center justify-center rounded-full border border-silver/40 bg-navy-2 text-silver-2 ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{
            opacity: indicatorOpacity,
            transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </div>
      </div>
      <div
        style={{
          transform: `translate3d(0, ${pull}px, 0)`,
          transition: dragging ? "none" : "transform 250ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
