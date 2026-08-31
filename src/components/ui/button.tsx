import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // El acento de marca es el punto focal de la pantalla: se usa una sola vez
  // por vista, para que la acción principal no compita con nada.
  primary:
    "bg-brand text-brand-ink hover:brightness-110 active:brightness-95 disabled:brightness-75",
  secondary:
    "bg-surface-alt text-ink hover:bg-surface-alt/70 border border-surface-alt",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
};

const SIZES: Record<Size, string> = {
  // Mínimo 44px de alto en táctil: la mayoría entra desde el celular (§12).
  sm: "h-9 px-3 text-body-sm",
  md: "h-11 px-4 text-body-sm",
  lg: "h-12 px-6 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)]",
        "font-medium tracking-tight whitespace-nowrap",
        "transition-[filter,background-color,transform] duration-150 ease-(--ease-standard)",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
