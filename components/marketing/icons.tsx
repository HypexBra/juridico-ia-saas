import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

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

export function IconLibrary(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4.5v15" />
      <path d="M8 4.5v15" />
      <path d="M4 4.5h4" />
      <path d="M4 19.5h4" />
      <path d="M12.5 5.2l3.9 15-3.9 1" />
      <path d="M17 4l3.5 14.5" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4" />
      <path d="M12.5 16V8" />
      <path d="M17 16v-7" />
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

export function IconDownload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5l4.5 4.5 4.5-4.5" />
      <path d="M4.5 17.5v2A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
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

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
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

export function IconGauge(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l3.5-4.5" />
      <circle cx="12" cy="15" r="1.2" />
    </svg>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5c-1.6-1.3-3.8-2-6.5-2v13c2.7 0 4.9.7 6.5 2 1.6-1.3 3.8-2 6.5-2v-13c-2.7 0-4.9.7-6.5 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function IconIdCard(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <circle cx="8" cy="11" r="1.8" />
      <path d="M5.5 16c.5-1.6 1.6-2.4 2.5-2.4s2 .8 2.5 2.4" />
      <path d="M14 9.5h4" />
      <path d="M14 13h4" />
    </svg>
  );
}
