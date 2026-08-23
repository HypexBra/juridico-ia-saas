import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={`rounded-xl border border-ink/10 bg-navy-2/60 p-5 shadow-sm shadow-ink/[0.06] ${className}`}
      {...rest}
    />
  );
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  const { className = "", ...rest } = props;
  return <h3 className={`font-display text-lg font-semibold text-ice ${className}`} {...rest} />;
}
