import { cn } from "@/lib/utils/cn";
import type { MatchStatus, TournamentStatus } from "@/lib/domain/types";

type Tone = "neutral" | "brand" | "warn" | "danger" | "signal";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-alt text-muted",
  brand: "bg-brand/15 text-brand",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  signal: "bg-signal/20 text-signal",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1",
        "text-meta font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Color semántico del estado de un partido (§7: el color comunica, no decora).
 * Confirmado va en el acento de marca, pendiente en ámbar, disputa en rojo.
 */
export const MATCH_STATUS_TONE: Record<MatchStatus, Tone> = {
  scheduled: "neutral",
  awaiting_confirmation: "warn",
  confirmed: "brand",
  disputed: "danger",
  walkover: "signal",
};

export const TOURNAMENT_STATUS_TONE: Record<TournamentStatus, Tone> = {
  draft: "neutral",
  registration: "brand",
  in_progress: "signal",
  finished: "neutral",
  cancelled: "danger",
};

/** Punto que late para los estados "en vivo". */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2", className)} aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
