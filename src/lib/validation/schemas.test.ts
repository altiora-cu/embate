import { describe, expect, it } from "vitest";

import {
  createTournamentSchema,
  fieldErrors,
  matchReportSchema,
  slugify,
} from "./schemas";

describe("slugify", () => {
  it("quita tildes y diacríticos del español", () => {
    expect(slugify("Liga Peñarol")).toBe("liga-penarol");
    expect(slugify("Camión Ñandú")).toBe("camion-nandu");
  });

  it("convierte espacios y símbolos en guiones simples", () => {
    expect(slugify("Copa   de   Verano!!")).toBe("copa-de-verano");
  });

  it("no deja guiones sueltos en los extremos", () => {
    expect(slugify("  ¡Torneo!  ")).toBe("torneo");
  });

  it("respeta el largo máximo del slug en base de datos", () => {
    expect(slugify("a".repeat(80)).length).toBeLessThanOrEqual(40);
  });

  it("produce un slug que pasa la validación del esquema", () => {
    expect(slugify("Los Domingos FC")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("createTournamentSchema — el cupo es del organizador", () => {
  const base = { name: "Copa", format: "cup", gameMode: "kick_off" } as const;

  it("acepta un torneo sin cupo declarado", () => {
    const result = createTournamentSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.size).toBeNull();
  });

  it("trata el campo vacío como 'sin límite' y no como error", () => {
    const result = createTournamentSchema.safeParse({ ...base, size: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.size).toBeNull();
  });

  it("acepta cualquier tope a partir de 2, sin techo", () => {
    for (const size of [2, 6, 17, 64, 250]) {
      const result = createTournamentSchema.safeParse({ ...base, size });
      expect(result.success, `tamaño ${size}`).toBe(true);
    }
  });

  it("acepta un relámpago de cualquier tamaño: el formato ya no fija el cupo", () => {
    expect(
      createTournamentSchema.safeParse({ ...base, format: "blitz", size: 24 }).success,
    ).toBe(true);
  });

  it("rechaza un tope de menos de 2 — no hay torneo de una persona", () => {
    expect(createTournamentSchema.safeParse({ ...base, size: 1 }).success).toBe(false);
  });

  it("deja el plazo de inscripción en null cuando no se especifica", () => {
    const result = createTournamentSchema.safeParse({ ...base, registrationClosesAt: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.registrationClosesAt).toBeNull();
  });

  it("conserva el plazo cuando el organizador pone uno", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      registrationClosesAt: "2026-08-15T20:00",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.registrationClosesAt).toBe("2026-08-15T20:00");
  });
});

describe("matchReportSchema", () => {
  it("acepta un marcador normal", () => {
    expect(matchReportSchema.safeParse({ homeScore: "3", awayScore: "1" }).success).toBe(
      true,
    );
  });

  it("rechaza marcadores negativos", () => {
    expect(matchReportSchema.safeParse({ homeScore: -1, awayScore: 0 }).success).toBe(
      false,
    );
  });

  it("rechaza marcadores absurdos", () => {
    expect(matchReportSchema.safeParse({ homeScore: 500, awayScore: 0 }).success).toBe(
      false,
    );
  });

  it("rechaza valores que no son números", () => {
    expect(matchReportSchema.safeParse({ homeScore: "x", awayScore: "1" }).success).toBe(
      false,
    );
  });
});

describe("fieldErrors", () => {
  it("devuelve claves de traducción por campo, no texto ya traducido", () => {
    const result = matchReportSchema.safeParse({ homeScore: -5, awayScore: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(errors.homeScore).toBe("validation.score");
  });
});
