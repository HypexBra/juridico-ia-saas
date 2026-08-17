import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_BASE =
  "w-full rounded-lg border border-white/10 bg-navy-2 px-3.5 py-2.5 text-sm text-ice placeholder:text-muted/70 outline-none transition-colors focus:border-gold/60 focus:ring-1 focus:ring-gold/30 disabled:opacity-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${FIELD_BASE} resize-y ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return (
    <label
      className={`mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted ${className}`}
      {...rest}
    />
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-red-400">{children}</p>;
}
