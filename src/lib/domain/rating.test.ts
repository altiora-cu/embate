import { describe, expect, it } from "vitest";

import { calculateRating, MAX_RATING, MIN_RATING, toStars } from "./rating";
import type { RatingInput } from "./types";

function input(partial: Partial<RatingInput> = {}): RatingInput {
  return {
    wins: 0,
    draws: 0,
    losses: 0,
    matchesOnTime: 0,
    noShows: 0,
    disputesLost: 0,
    disputesTotal: 0,
    ...partial,
  };
}

describe("calculateRating — escala", () => {
  it("nunca baja de 1.0 ni sube de 5.0", () => {
    const worst = calculateRating(
      input({ losses: 200, noShows: 200, disputesLost: 50, disputesTotal: 50 }),
    );
    const best = calculateRating(
      input({ wins: 200, matchesOnTime: 200, disputesLost: 0, disputesTotal: 0 }),
    );
    expect(worst.rating).toBeGreaterThanOrEqual(MIN_RATING);
    expect(best.rating).toBeLessThanOrEqual(MAX_RATING);
  });

  it("parte de un valor neutro cuando no hay historial", () => {
    const result = calculateRating(input());
    expect(result.rating).toBeGreaterThan(2.5);
    expect(result.rating).toBeLessThan(3.5);
    expect(result.sampleSize).toBe(0);
  });
});

describe("calculateRating — no es solo el % de victorias (§4.1)", () => {
  it("penaliza al ganador que deja plantados a sus rivales", () => {
    const puntual = calculateRating(
      input({ wins: 20, losses: 0, matchesOnTime: 20, noShows: 0 }),
    );
    const impuntual = calculateRating(
      input({ wins: 20, losses: 0, matchesOnTime: 10, noShows: 10 }),
    );
    expect(impuntual.rating).toBeLessThan(puntual.rating);
  });

  it("penaliza al ganador que pierde disputas por mala fe", () => {
    const limpio = calculateRating(
      input({ wins: 20, losses: 0, matchesOnTime: 20, disputesTotal: 0 }),
    );
    const tramposo = calculateRating(
      input({ wins: 20, losses: 0, matchesOnTime: 20, disputesTotal: 8, disputesLost: 8 }),
    );
    expect(tramposo.rating).toBeLessThan(limpio.rating);
  });

  it("premia al jugador que pierde partidos pero siempre se presenta y juega limpio", () => {
    const confiablePeroFlojo = calculateRating(
      input({ wins: 4, losses: 16, matchesOnTime: 20, noShows: 0, disputesTotal: 0 }),
    );
    const fuertePeroInformal = calculateRating(
      input({
        wins: 16,
        losses: 4,
        matchesOnTime: 4,
        noShows: 16,
        disputesTotal: 6,
        disputesLost: 6,
      }),
    );
    expect(confiablePeroFlojo.rating).toBeGreaterThan(fuertePeroInformal.rating);
  });

  it("cuenta el empate como medio triunfo", () => {
    const conEmpates = calculateRating(input({ wins: 0, draws: 20, matchesOnTime: 20 }));
    const conDerrotas = calculateRating(input({ wins: 0, losses: 20, matchesOnTime: 20 }));
    const conVictorias = calculateRating(input({ wins: 20, matchesOnTime: 20 }));
    expect(conEmpates.rating).toBeGreaterThan(conDerrotas.rating);
    expect(conEmpates.rating).toBeLessThan(conVictorias.rating);
  });
});

describe("calculateRating — muestra pequeña", () => {
  it("no da 5.0 por ganar un solo partido", () => {
    const result = calculateRating(input({ wins: 1, matchesOnTime: 1 }));
    expect(result.rating).toBeLessThan(4);
  });

  it("no da 1.0 por perder un solo partido", () => {
    const result = calculateRating(input({ losses: 1, matchesOnTime: 1 }));
    expect(result.rating).toBeGreaterThan(2);
  });

  it("marca la calificación como provisional con pocos partidos", () => {
    expect(calculateRating(input({ wins: 2, matchesOnTime: 2 })).provisional).toBe(true);
    expect(calculateRating(input({ wins: 10, matchesOnTime: 10 })).provisional).toBe(false);
  });

  it("se acerca al máximo a medida que crece el historial impecable", () => {
    const pocos = calculateRating(input({ wins: 5, matchesOnTime: 5 }));
    const muchos = calculateRating(input({ wins: 50, matchesOnTime: 50 }));
    expect(muchos.rating).toBeGreaterThan(pocos.rating);
  });
});

describe("calculateRating — desglose explicable", () => {
  it("devuelve los componentes crudos para poder mostrarlos en el perfil", () => {
    const result = calculateRating(
      input({ wins: 3, losses: 1, matchesOnTime: 3, noShows: 1, disputesTotal: 2, disputesLost: 1 }),
    );
    expect(result.winRate).toBeCloseTo(0.75);
    expect(result.punctuality).toBeCloseTo(0.75);
    expect(result.integrity).toBeCloseTo(0.5);
    expect(result.sampleSize).toBe(4);
  });

  it("considera integridad perfecta cuando el jugador nunca tuvo disputas", () => {
    expect(calculateRating(input({ wins: 10, matchesOnTime: 10 })).integrity).toBe(1);
  });
});

describe("toStars", () => {
  it("convierte 4.0 en 4 llenas y ninguna media", () => {
    expect(toStars(4)).toEqual({ full: 4, half: false, empty: 1 });
  });

  it("convierte 3.5 en 3 llenas y una media", () => {
    expect(toStars(3.5)).toEqual({ full: 3, half: true, empty: 1 });
  });

  it("siempre suma 5 estrellas", () => {
    for (const value of [0, 1, 1.4, 2.5, 3.7, 4.9, 5]) {
      const { full, half, empty } = toStars(value);
      expect(full + (half ? 1 : 0) + empty, `rating ${value}`).toBe(5);
    }
  });
});
