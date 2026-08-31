import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Escala tipográfica y paleta del proyecto (§7), declaradas para tailwind-merge.
 *
 * Sin esto, tailwind-merge no puede saber si `text-body` es un tamaño o un color
 * —sus heurísticas solo reconocen los nombres por defecto de Tailwind— y mete
 * ambas cosas en el mismo grupo. El resultado es que en `cn("text-brand-ink",
 * "text-body")` se descarta el color y el texto hereda el del body: así es como
 * el botón principal terminó con letra blanco hueso sobre acento lima.
 *
 * Al declarar los dos grupos por separado, tamaño y color dejan de pisarse.
 */
const FONT_SIZES = ["meta", "body-sm", "body", "subtitle", "section", "hero"];

const COLORS = [
  "base",
  "surface",
  "surface-alt",
  "ink",
  "muted",
  "accent",
  "signal",
  "warn",
  "danger",
  "brand",
  "brand-ink",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
      "text-color": [{ text: COLORS }],
      "bg-color": [{ bg: COLORS }],
      "border-color": [{ border: COLORS }],
    },
  },
});

/** Combina clases condicionales resolviendo conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
