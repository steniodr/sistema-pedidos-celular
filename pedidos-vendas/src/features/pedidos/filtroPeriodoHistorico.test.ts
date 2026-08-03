import { describe, expect, it } from "vitest";
import {
  intervaloFiltroPeriodo,
  rotuloFiltroPeriodo,
  type FiltroPeriodo,
} from "./filtroPeriodoHistorico";

describe("intervaloFiltroPeriodo", () => {
  it("'dia' é o próprio dia, início e fim iguais", () => {
    const filtro: FiltroPeriodo = { tipo: "dia", referencia: "2026-08-01" };
    expect(intervaloFiltroPeriodo(filtro)).toEqual({ inicio: "2026-08-01", fim: "2026-08-01" });
  });

  it("'semana' abrange domingo a sábado da semana da referência", () => {
    // 1º de janeiro de 2026 é uma quinta-feira.
    const filtro: FiltroPeriodo = { tipo: "semana", referencia: "2026-01-01" };
    expect(intervaloFiltroPeriodo(filtro)).toEqual({ inicio: "2025-12-28", fim: "2026-01-03" });
  });

  it("'mes' abrange do primeiro ao último dia do mês da referência", () => {
    const filtro: FiltroPeriodo = { tipo: "mes", referencia: "2026-02-15" };
    expect(intervaloFiltroPeriodo(filtro)).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });
});

describe("rotuloFiltroPeriodo", () => {
  it("formata 'dia' como DD/MM/AAAA", () => {
    expect(rotuloFiltroPeriodo({ tipo: "dia", referencia: "2026-08-01" })).toBe("01/08/2026");
  });

  it("formata 'semana' como intervalo", () => {
    expect(rotuloFiltroPeriodo({ tipo: "semana", referencia: "2026-01-01" })).toBe(
      "Semana de 28/12/2025 a 03/01/2026",
    );
  });

  it("formata 'mes' com o nome do mês em português, maiúscula inicial", () => {
    expect(rotuloFiltroPeriodo({ tipo: "mes", referencia: "2026-02-15" })).toBe("Fevereiro de 2026");
  });
});
