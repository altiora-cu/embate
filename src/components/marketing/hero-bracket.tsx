"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Visual del hero: un cuadro de 8 que se dibuja solo hasta converger en un
 * único nodo.
 *
 * No es decoración genérica — es el concepto del isotipo llevado a escala: dos
 * caminos que compiten hasta que uno gana. La animación de trazado es la misma
 * que usa el bracket real del producto (§8), así que la portada le enseña al
 * visitante cómo se va a ver su torneo.
 */
export function HeroBracket({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  // Cuadro de 8: 4 cruces → 2 semis → 1 final → campeón.
  const columns = [
    { x: 0, count: 4 },
    { x: 96, count: 2 },
    { x: 192, count: 1 },
  ];
  const height = 280;
  const slot = (count: number, index: number) =>
    (height / (count * 2)) * (index * 2 + 1);

  const connectors: { d: string; delay: number }[] = [];
  columns.forEach((column, columnIndex) => {
    const next = columns[columnIndex + 1];
    if (!next) return;
    for (let i = 0; i < next.count; i++) {
      const top = slot(column.count, i * 2);
      const bottom = slot(column.count, i * 2 + 1);
      const mid = slot(next.count, i);
      const x = column.x + 64;
      const nx = next.x;
      connectors.push({
        d: `M ${x} ${top} H ${x + 16} V ${mid} H ${nx}`,
        delay: columnIndex * 0.24 + i * 0.08,
      });
      connectors.push({
        d: `M ${x} ${bottom} H ${x + 16} V ${mid} H ${nx}`,
        delay: columnIndex * 0.24 + i * 0.08 + 0.04,
      });
    }
  });

  return (
    <svg
      viewBox="0 0 300 280"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ranuras de cada jugador: rectángulos apenas insinuados. */}
      {columns.map((column) =>
        Array.from({ length: column.count }, (_, i) => {
          const y = slot(column.count, i);
          return (
            <rect
              key={`${column.x}-${i}`}
              x={column.x}
              y={y - 11}
              width="64"
              height="22"
              rx="4"
              className="fill-surface stroke-surface-alt"
              strokeWidth="1"
            />
          );
        }),
      )}

      {/* Conexiones que se dibujan: 400ms por línea, escalonadas 80ms (§8). */}
      {connectors.map((connector, index) => (
        <motion.path
          key={index}
          d={connector.d}
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="stroke-muted/50"
          initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
          animate={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.4,
            delay: connector.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}

      {/* El campeón: el isotipo, en color de marca, cerrando el cuadro. */}
      <motion.g
        initial={reduceMotion ? undefined : { opacity: 0, scale: 0.7 }}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "272px 138px" }}
      >
        <g transform="translate(244 110) scale(0.56)">
          <path
            d="M 10 82 L 58 18 L 90 60"
            fill="none"
            className="stroke-brand"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </motion.g>
    </svg>
  );
}
