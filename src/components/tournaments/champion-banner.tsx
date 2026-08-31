"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { Isotipo } from "@/components/ui/logo";

/**
 * Cierre del torneo (§8: celebración de 800ms al finalizar).
 *
 * Confeti en el acento de marca y el azul señal, deliberadamente **no**
 * multicolor genérico: el brief pide que la app no se sienta plantilla. Las
 * partículas se generan una sola vez y con posiciones deterministas por índice,
 * para que servidor y cliente coincidan y no haya desajuste de hidratación.
 */
const PARTICLE_COUNT = 22;

export function ChampionBanner({ gamertag }: { gamertag: string }) {
  const t = useTranslations("tournaments");
  const reduceMotion = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        // Distribución pseudoaleatoria pero estable: misma salida en cada render.
        const spread = ((i * 37) % 100) - 50;
        return {
          id: i,
          left: `${(i * 100) / PARTICLE_COUNT}%`,
          drift: spread,
          delay: (i % 7) * 0.05,
          size: 4 + (i % 3) * 2,
          color: i % 3 === 0 ? "var(--color-signal)" : "var(--color-brand)",
        };
      }),
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-brand/40 bg-brand/8 px-5 py-5">
      {!reduceMotion && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              className="absolute top-0 rounded-[1px]"
              style={{
                left: particle.left,
                width: particle.size,
                height: particle.size * 2,
                backgroundColor: particle.color,
              }}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{ y: 130, opacity: [0, 1, 1, 0], rotate: particle.drift * 4 }}
              transition={{
                duration: 0.8,
                delay: particle.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="relative flex flex-wrap items-center gap-x-4 gap-y-2"
        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Isotipo className="size-8 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-meta tracking-wide text-muted uppercase">
            {t("champion")}
          </p>
          <p className="truncate font-display text-section leading-tight font-bold text-brand">
            {gamertag}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
