import { describe, expect, it } from "vitest";

import { contrastInk, contrastRatio, parseHex, safeAccent } from "./color";

describe("parseHex", () => {
  it("acepta con y sin almohadilla", () => {
    expect(parseHex("#C6FF3D")).toEqual({ r: 198, g: 255, b: 61 });
    expect(parseHex("c6ff3d")).toEqual({ r: 198, g: 255, b: 61 });
  });

  it("rechaza valores que no son colores de 6 dígitos", () => {
    expect(parseHex("#FFF")).toBeNull();
    expect(parseHex("rojo")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("da 21 entre blanco puro y negro puro", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });

  it("da 1 entre un color y sí mismo", () => {
    expect(contrastRatio("#2E5CFF", "#2E5CFF")).toBeCloseTo(1, 5);
  });

  it("es simétrico", () => {
    expect(contrastRatio("#C6FF3D", "#0B0D12")).toBeCloseTo(
      contrastRatio("#0B0D12", "#C6FF3D"),
      5,
    );
  });
});

describe("contrastInk — legibilidad del acento del organizador", () => {
  it("pone texto oscuro sobre el lima de Embate", () => {
    expect(contrastInk("#C6FF3D")).toBe("#0B0D12");
  });

  it("pone texto claro sobre un azul saturado", () => {
    expect(contrastInk("#2E5CFF")).toBe("#F5F3EE");
  });

  it("siempre elige la opción con mejor contraste", () => {
    for (const accent of ["#C6FF3D", "#2E5CFF", "#FF4D4D", "#FFB020", "#111111", "#EEEEEE"]) {
      const ink = contrastInk(accent);
      const other = ink === "#0B0D12" ? "#F5F3EE" : "#0B0D12";
      expect(
        contrastRatio(accent, ink),
        `acento ${accent}`,
      ).toBeGreaterThanOrEqual(contrastRatio(accent, other));
    }
  });

  it("alcanza el mínimo AA para texto grande en los presets ofrecidos", () => {
    const presets = ["#C6FF3D", "#2E5CFF", "#FF4D4D", "#FFB020", "#A78BFA", "#22D3EE"];
    for (const accent of presets) {
      expect(contrastRatio(accent, contrastInk(accent)), accent).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("safeAccent", () => {
  it("mantiene un color válido", () => {
    expect(safeAccent("#2E5CFF")).toBe("#2E5CFF");
  });

  it("vuelve al acento de Embate cuando el dato es inválido o falta", () => {
    expect(safeAccent(null)).toBe("#C6FF3D");
    expect(safeAccent("")).toBe("#C6FF3D");
    expect(safeAccent("javascript:alert(1)")).toBe("#C6FF3D");
  });
});
