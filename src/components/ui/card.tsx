import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Superficie base sobre el fondo oscuro. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-surface-alt/60 px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-subtitle leading-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-body-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/** Estado vacío con una acción clara: nunca dejar una pantalla en blanco. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-surface-alt px-6 py-12 text-center">
      <p className="font-display text-subtitle">{title}</p>
      {body && <p className="max-w-sm text-body-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
