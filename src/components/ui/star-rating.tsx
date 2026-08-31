import { toStars } from "@/lib/domain/rating";
import { cn } from "@/lib/utils/cn";

/**
 * Calificación de 5 estrellas (§4.1).
 * Se muestra el número junto a las estrellas: "4.2" comunica más que cuatro
 * iconos, sobre todo cuando la diferencia entre 4.2 y 4.8 decide un reto.
 */
export function StarRating({
  rating,
  size = "md",
  showValue = true,
  className,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}) {
  const { full, half, empty } = toStars(rating);
  const starSize = { sm: "size-3.5", md: "size-4", lg: "size-6" }[size];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${rating.toFixed(1)} de 5`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: full }, (_, i) => (
          <Star key={`f${i}`} className={cn(starSize, "text-brand")} fill="full" />
        ))}
        {half && <Star className={cn(starSize, "text-brand")} fill="half" />}
        {Array.from({ length: empty }, (_, i) => (
          <Star key={`e${i}`} className={cn(starSize, "text-surface-alt")} fill="full" />
        ))}
      </span>
      {showValue && (
        <span
          className={cn(
            "tnum font-display font-bold text-ink",
            size === "lg" ? "text-section" : "text-body-sm",
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}

/*
 * Id fijo, no generado: todas las medias estrellas se ven igual, así que
 * compartir el degradado es correcto y evita el desajuste de hidratación que
 * produciría un id aleatorio distinto en servidor y en cliente.
 */
const HALF_STAR_GRADIENT = "embate-half-star";

function Star({ className, fill }: { className?: string; fill: "full" | "half" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {fill === "half" && (
        <defs>
          <linearGradient id={HALF_STAR_GRADIENT}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="var(--color-surface-alt)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z"
        fill={fill === "half" ? `url(#${HALF_STAR_GRADIENT})` : "currentColor"}
      />
    </svg>
  );
}

/** Barra de un componente de la calificación, para explicar de dónde sale la nota. */
export function RatingComponentBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-meta text-muted">{label}</span>
        <span className="tnum text-meta font-medium text-ink">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface-alt">
        <div
          className="h-full rounded-[var(--radius-pill)] bg-brand transition-[width] duration-500 ease-(--ease-out-quint)"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
