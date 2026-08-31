/**
 * Utilidades de color para la marca blanca.
 *
 * El organizador elige su acento libremente, así que el color del texto que va
 * ENCIMA de ese acento no puede estar fijo en el CSS: sobre lima corresponde
 * texto oscuro, sobre azul marino corresponde texto claro. Elegir mal deja
 * botones ilegibles.
 */

const DARK_INK = "#0B0D12";
const LIGHT_INK = "#F5F3EE";

/** Convierte `#RRGGBB` a componentes 0–255. Devuelve `null` si no es válido. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Luminancia relativa según WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Color de texto legible sobre un fondo dado.
 * Elige entre el oscuro y el claro de la paleta el que dé más contraste.
 */
export function contrastInk(background: string): string {
  return contrastRatio(background, DARK_INK) >= contrastRatio(background, LIGHT_INK)
    ? DARK_INK
    : LIGHT_INK;
}

/** Acento válido, con vuelta al de Embate si el guardado quedó corrupto. */
export function safeAccent(hex: string | null | undefined): string {
  return hex && parseHex(hex) ? hex : "#C6FF3D";
}
