import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils/cn";

const CONTROL = cn(
  "w-full rounded-[var(--radius-control)] border border-surface-alt bg-base",
  // El placeholder va en `muted` sin opacidad: rebajarlo más lo deja por debajo
  // del mínimo de contraste AA, y es texto que el usuario necesita poder leer.
  "px-3 py-2.5 text-body text-ink placeholder:text-muted",
  "transition-colors duration-150 ease-(--ease-standard)",
  "hover:border-muted/50 focus:border-brand focus:outline-none",
  "disabled:opacity-60",
);

/**
 * Envoltorio de campo: etiqueta, ayuda y error.
 * El error se anuncia con `role="alert"` para que un lector de pantalla lo lea
 * cuando aparece, sin que el usuario tenga que ir a buscarlo.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-meta text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, "appearance-none pr-8", className)} {...props} />;
}

/**
 * Selector de opción con descripción: mejor que un `<select>` cuando la elección
 * necesita explicarse (formato de torneo, modo de juego).
 */
export function RadioCard({
  name,
  value,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  value: string;
  title: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer flex-col gap-1 rounded-[var(--radius-control)]",
        "border border-surface-alt bg-base p-3.5",
        "transition-colors duration-150 ease-(--ease-standard) hover:border-muted/50",
        "has-checked:border-brand has-checked:bg-brand/5",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      <span className="text-body-sm font-medium text-ink group-has-checked:text-brand">
        {title}
      </span>
      {description && <span className="text-meta text-muted">{description}</span>}
    </label>
  );
}
