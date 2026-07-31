import { describe, expect, it } from "vitest";
import {
  aplicarDesconto,
  lerNumeroBR,
  subtotal,
  totaisPedido,
  totalItem,
  valorDesconto,
} from "./calculos";
import type { ItemPedido } from "./types";

function item(qtd: number, valorUnit: number): ItemPedido {
  return { item: 1, qtd, valorUnit, embalagem: "", descricaoProduto: "Teste" };
}

describe("totalItem", () => {
  it("multiplica quantidade por valor unitário", () => {
    expect(totalItem(item(3, 95.64))).toBe(286.92);
  });

  it("arredonda a 2 casas em vez de propagar erro de ponto flutuante", () => {
    // 3 × 0.615 = 1.8450000000000002 em ponto flutuante
    expect(totalItem(item(3, 0.615))).toBe(1.85);
  });

  it("trata quantidade zero", () => {
    expect(totalItem(item(0, 100))).toBe(0);
  });
});

describe("subtotal", () => {
  it("soma os totais dos itens", () => {
    expect(subtotal([item(2, 10.55), item(1, 3.9)])).toBe(25);
  });

  it("é zero sem itens", () => {
    expect(subtotal([])).toBe(0);
  });
});

describe("desconto", () => {
  it("aplica percentual", () => {
    expect(valorDesconto(1000, "percentual", 12.5)).toBe(125);
    expect(aplicarDesconto(1000, "percentual", 12.5)).toBe(875);
  });

  it("aplica valor fixo", () => {
    expect(aplicarDesconto(1000, "valor", 150.75)).toBe(849.25);
  });

  it("nunca deixa o total negativo", () => {
    expect(aplicarDesconto(100, "valor", 500)).toBe(0);
    expect(aplicarDesconto(100, "percentual", 150)).toBe(0);
  });

  it("ignora desconto zerado ou negativo", () => {
    expect(valorDesconto(100, "percentual", 0)).toBe(0);
    expect(valorDesconto(100, "valor", -50)).toBe(0);
  });

  it("arredonda o percentual a 2 casas", () => {
    expect(valorDesconto(333.33, "percentual", 7)).toBe(23.33);
  });
});

describe("totaisPedido", () => {
  it("devolve subtotal, desconto e total coerentes", () => {
    const totais = totaisPedido({
      itens: [item(10, 95.64), item(2, 453.31)],
      descontoTipo: "percentual",
      descontoValor: 10,
    });
    expect(totais.subtotal).toBe(1863.02);
    expect(totais.desconto).toBe(186.3);
    expect(totais.total).toBe(1676.72);
  });
});

describe("lerNumeroBR", () => {
  it("lê formato brasileiro com milhar e decimal", () => {
    expect(lerNumeroBR("4.879,88")).toBe(4879.88);
    expect(lerNumeroBR("1.234.567,89")).toBe(1234567.89);
  });

  it("lê apenas com vírgula decimal", () => {
    expect(lerNumeroBR("95,64")).toBe(95.64);
  });

  it("lê formato americano", () => {
    expect(lerNumeroBR("95.64")).toBe(95.64);
    expect(lerNumeroBR("1,234.56")).toBe(1234.56);
  });

  it("trata ponto como milhar quando não há decimal", () => {
    expect(lerNumeroBR("4.879")).toBe(4879);
  });

  it("aceita número puro e prefixo R$", () => {
    expect(lerNumeroBR(12.5)).toBe(12.5);
    expect(lerNumeroBR("R$ 546,92")).toBe(546.92);
  });

  it("devolve null para entradas inválidas", () => {
    expect(lerNumeroBR("")).toBeNull();
    expect(lerNumeroBR("   ")).toBeNull();
    expect(lerNumeroBR("sob consulta")).toBeNull();
    expect(lerNumeroBR(null)).toBeNull();
    expect(lerNumeroBR(undefined)).toBeNull();
  });
});
