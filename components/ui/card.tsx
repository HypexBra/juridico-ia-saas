import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={`rounded-xl border border-white/10 bg-navy-2/60 p-5 shadow-lg shadow-black/20 ${className}`}
      {...rest}
    />
  );
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  const { className = "", ...rest } = props;
  return <h3 className={`font-display text-lg font-semibold text-ice ${className}`} {...rest} />;
}
