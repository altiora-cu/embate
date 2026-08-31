import { describe, expect, it } from "vitest";

import en from "./en.json";
import es from "./es.json";

type Json = { [key: string]: string | Json };

/** Aplana el objeto de traducciones a rutas tipo `match.reportTitle`. */
function flatten(obj: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Marcadores de interpolación de un mensaje: `{name}`, `{count, plural, ...}`. */
function placeholders(message: string): Set<string> {
  return new Set(
    [...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]),
  );
}

const flatEs = flatten(es as unknown as Json);
const flatEn = flatten(en as unknown as Json);

/*
 * Regla del proyecto (§12): ninguna cadena vive en un componente. Si estos tests
 * fallan es porque un idioma quedó atrás — que es exactamente el momento en que
 * la app empieza a mostrar claves crudas al usuario.
 */
describe("paridad de traducciones ES/EN", () => {
  it("no le falta ninguna clave al inglés", () => {
    const missing = [...flatEs.keys()].filter((key) => !flatEn.has(key));
    expect(missing).toEqual([]);
  });

  it("no le sobra ninguna clave al inglés", () => {
    const extra = [...flatEn.keys()].filter((key) => !flatEs.has(key));
    expect(extra).toEqual([]);
  });

  it("usa los mismos marcadores de interpolación en ambos idiomas", () => {
    const mismatched: string[] = [];
    for (const [key, esValue] of flatEs) {
      const enValue = flatEn.get(key);
      if (enValue === undefined) continue;
      const a = [...placeholders(esValue)].sort();
      const b = [...placeholders(enValue)].sort();
      if (a.join(",") !== b.join(",")) {
        mismatched.push(`${key}: es[${a}] vs en[${b}]`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("no deja ningún mensaje vacío", () => {
    const empty = [...flatEs, ...flatEn]
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});

describe("disclaimer legal obligatorio (§2, §9)", () => {
  it("existe en los dos idiomas y nombra a Electronic Arts", () => {
    expect(flatEs.get("brand.disclaimer")).toContain("Electronic Arts");
    expect(flatEn.get("brand.disclaimer")).toContain("Electronic Arts");
  });

  it("deja claro que no hay afiliación", () => {
    expect(flatEs.get("brand.disclaimer")).toMatch(/no está afiliado/i);
    expect(flatEn.get("brand.disclaimer")).toMatch(/not affiliated/i);
  });
});

describe("cumplimiento legal — lenguaje de apuestas prohibido (§9)", () => {
  // El producto no puede usar lenguaje de gambling en ninguna copy, aunque el
  // organizador ofrezca premio en efectivo por su cuenta.
  const banned = [
    /\bapuesta/i,
    /\bapostar/i,
    /\bwager/i,
    /\bbetting\b/i,
    /\bgambling\b/i,
  ];

  it("no aparece en ningún mensaje", () => {
    const offenders: string[] = [];
    for (const [key, value] of [...flatEs, ...flatEn]) {
      for (const pattern of banned) {
        if (pattern.test(value)) offenders.push(`${key}: "${value}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
