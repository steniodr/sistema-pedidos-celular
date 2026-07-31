import { describe, expect, it } from "vitest";
import { avaliarBase } from "./statusBase";
import type { ImportacaoInfo } from "../../domain/types";

const HOJE = new Date("2026-07-30T12:00:00Z");

function importacao(diasAtras: number): ImportacaoInfo {
  const quando = new Date(HOJE.getTime() - diasAtras * 24 * 60 * 60 * 1000);
  return { arquivo: "tabela.xlsx", quandoEm: quando.toISOString(), totalProdutos: 100 };
}

describe("avaliarBase", () => {
  it("sinaliza base inexistente", () => {
    expect(avaliarBase(undefined, HOJE).nivel).toBe("vazia");
  });

  it("fica verde até 30 dias", () => {
    expect(avaliarBase(importacao(0), HOJE).nivel).toBe("ok");
    expect(avaliarBase(importacao(30), HOJE).nivel).toBe("ok");
  });

  it("fica amarela entre 31 e 60 dias", () => {
    expect(avaliarBase(importacao(31), HOJE).nivel).toBe("atencao");
    expect(avaliarBase(importacao(60), HOJE).nivel).toBe("atencao");
  });

  it("fica vermelha acima de 60 dias", () => {
    expect(avaliarBase(importacao(61), HOJE).nivel).toBe("critico");
    expect(avaliarBase(importacao(200), HOJE).nivel).toBe("critico");
  });
});
