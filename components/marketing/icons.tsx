import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Bespoke Geometric Monogram / Editorial Legal Brand Seal */
export function IconLogoMark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.4} />
      <path d="M7 7.5h10" strokeWidth={1.4} />
      <path d="M12 7.5v9a2.5 2.5 0 0 1-2.5 2.5" strokeWidth={1.5} />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v18" />
      <path d="M7 21h10" />
      <path d="M5 7l-3 6a3.2 3.2 0 0 0 6 0Z" />
      <path d="M19 7l-3 6a3.2 3.2 0 0 0 6 0Z" />
      <path d="M5 7h14" />
      <path d="M12 3l3 4H9Z" />
    </svg>
  );
}

export function IconDossier(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h6l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

export function IconFileText(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

export function IconFileAudit(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" strokeWidth={1.8} />
    </svg>
  );
}

export function IconAdversarial(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 4h5.5v5.5" />
      <path d="M20 4 12 12" />
      <path d="M9.5 20H4v-5.5" />
      <path d="M4 20l8-8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconWorkflow(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3a2 2 0 0 0 2 2h1" />
      <path d="M18 9v3a2 2 0 0 1-2 2h-1" />
      <path d="M12 14v1" />
    </svg>
  );
}

export function IconProactive(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <circle cx="12" cy="16" r="0.8" fill="currentColor" />
      <path d="M12 3v1" />
      <path d="M12 20v1" />
      <path d="M3 12h1" />
      <path d="M20 12h1" />
    </svg>
  );
}

export function IconMemory(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
      <path d="M9 4v16" />
      <path d="M4 9h5" />
      <path d="M4 14h5" />
      <circle cx="14" cy="10" r="1.5" />
      <circle cx="14" cy="15" r="1.5" />
      <path d="M14 11.5v2" />
    </svg>
  );
}

export function IconSearchFilter(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
      <path d="M11 8v6" />
    </svg>
  );
}

export function IconLockSecure(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconClipboard(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="4" width="12" height="17" rx="1.5" />
      <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h3" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15.5 20c.4-2.5 1.8-4 3.6-4.5" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v5.2c0 4.6-3 7.9-7 9.3-4-1.4-7-4.7-7-9.3V6Z" />
      <path d="M9 12l2 2 4-4.2" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function IconDash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 3 1 4.5 2 6H4c1-1.5 2-3 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconPortal(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="14" rx="1.5" />
      <path d="M3.5 8.5h17" />
      <circle cx="12" cy="13.3" r="2.3" />
    </svg>
  );
}

export function IconBanknote(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6.5" width="18" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9v0" />
      <path d="M17.5 15v0" />
    </svg>
  );
}

export function IconSignature(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17c2.5 1 5-1 6.5-3.5S12 8 10 8s-2 3 0 5 5 2 7-1c1-1.5 1-3 3-3" />
      <path d="M4 20.5h16" />
    </svg>
  );
}

export function IconWhatsapp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 18.5 4 20l1.4-3.6a8 8 0 1 1 3.1 2.4Z" />
      <path d="M9 9.2c0 2.9 2 4.9 4.9 4.9" />
      <path d="M9 9.2c0-.6.5-1.2 1-1.2s.7.4.9.9" />
      <path d="M13.9 14.1c.6 0 1.2-.5 1.2-1s-.4-.7-.9-.9" />
    </svg>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 16l5-5 4 3 7-7" />
      <path d="M15.5 6.5H20V11" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </svg>
  );
}
