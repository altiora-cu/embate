import { cn } from "@/lib/utils/cn";

/**
 * Isotipo "Nodo de Convergencia" (§2), revisión v2.
 *
 * Concepto intacto: dos caminos de distinta longitud que suben y convergen en un
 * punto — el momento en que uno gana. Lo que cambió es la ejecución.
 *
 * La v1 tenía los dos trazos casi colineales (un ángulo demasiado abierto), así
 * que por debajo de 40px dejaba de leerse como convergencia y parecía una raya
 * diagonal con un punto suelto. Además el dibujo estaba descentrado dentro del
 * viewBox, lo que lo hacía flotar en los headers.
 *
 * Esta versión cierra el ángulo hasta formar un chevron ascendente, centra el
 * trazo ópticamente en el cuadro y sube el grosor relativo. La asimetría entre
 * las dos patas (la izquierda es ~20% más larga) es la que sostiene el concepto:
 * no es una flecha simétrica, son dos recorridos distintos que terminan igual.
 *
 * El vértice ES el nodo. Se descartó el agujero de espacio negativo de la v1:
 * a 24px desaparecía y a cualquier tamaño dejaba el punto de unión frágil.
 */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-8", className)}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 10 82 L 58 18 L 90 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Lockup horizontal: isotipo + wordmark, para headers y navegación. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Isotipo className="size-7 text-brand" />
      {showWordmark && (
        <span className="font-display text-subtitle leading-none font-bold tracking-[0.08em] text-ink">
          EMBATE
        </span>
      )}
    </span>
  );
}
