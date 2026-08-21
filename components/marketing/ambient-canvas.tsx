"use client";

import { useEffect, useState } from "react";

export function AmbientCanvas() {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Dynamic Cursor Spotlight */}
      <div
        className="absolute -inset-px opacity-35 transition-opacity duration-300 motion-reduce:hidden"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212, 175, 55, 0.05), transparent 80%)`,
        }}
      />

      {/* Top Atmospheric Champagne Glow */}
      <div
        className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(212, 175, 55, 0.25) 0%, rgba(229, 192, 123, 0.1) 50%, transparent 80%)",
        }}
      />
    </div>
  );
}
