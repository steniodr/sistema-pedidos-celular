import { describe, expect, it } from "vitest";
import {
  filtrarPedidos,
  intervaloPeriodo,
  produtosMaisVendidos,
  resumoVendas,
} from "./relatorios";
import type { ItemPedido, Pedido } from "./types";

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: "p1",
    numero: 1,
    marca: "Merko",
    clienteId: "c1",
    dataPedido: "2026-08-01",
    itens: [],
    descontoTipo: "percentual",
    descontoValor: 0,
    status: "enviado",
    criadoEm: "2026-08-01T10:00:00.000Z",
    atualizadoEm: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<ItemPedido> = {}): ItemPedido {
  return {
    item: 1,
    qtd: 1,
    embalagem: "Galão",
    descricaoProduto: "Produto",
    valorUnit: 10,
    ...overrides,
  };
}

describe("intervaloPeriodo", () => {
  it("'tudo' não limita datas", () => {
    expect(intervaloPeriodo("tudo")).toEqual({ inicio: null, fim: null });
  });

  it("'semana' abrange domingo a sábado da semana de referência", () => {
    // 1º de janeiro de 2026 é uma quinta-feira.
    expect(intervaloPeriodo("semana", new Date(2026, 0, 1))).toEqual({
      inicio: "2025-12-28",
      fim: "2026-01-03",
    });
  });

  it("'mes' abrange do primeiro ao último dia do mês de referência", () => {
    expect(intervaloPeriodo("mes", new Date(2026, 1, 15))).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });
});

describe("filtrarPedidos", () => {
  const pedidos = [
    pedido({ id: "a", status: "enviado", dataPedido: "2026-08-01", clienteId: "c1", marca: "Merko" }),
    pedido({ id: "b", status: "rascunho", dataPedido: "2026-08-02", clienteId: "c1", marca: "Merko" }),
    pedido({ id: "c", status: "enviado", dataPedido: "2026-07-15", clienteId: "c2", marca: "Arara Azul" }),
  ];

  it("filtra por status", () => {
    expect(filtrarPedidos(pedidos, { status: "enviado" }).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filtra por intervalo de datas", () => {
    expect(
      filtrarPedidos(pedidos, { inicio: "2026-08-01", fim: "2026-08-31" }).map((p) => p.id),
    ).toEqual(["a", "b"]);
  });

  it("filtra por cliente e marca", () => {
    expect(filtrarPedidos(pedidos, { clienteId: "c1" }).map((p) => p.id)).toEqual(["a", "b"]);
    expect(filtrarPedidos(pedidos, { marca: "Arara Azul" }).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("resumoVendas", () => {
  it("soma o total, conta pedidos e calcula o ticket médio", () => {
    const pedidos = [
      pedido({ itens: [item({ qtd: 2, valorUnit: 50 })] }), // 100
      pedido({ itens: [item({ qtd: 1, valorUnit: 300 })] }), // 300
    ];
    expect(resumoVendas(pedidos)).toEqual({
      totalVendido: 400,
      numeroPedidos: 2,
      ticketMedio: 200,
    });
  });

  it("ticket médio é zero sem pedidos", () => {
    expect(resumoVendas([])).toEqual({ totalVendido: 0, numeroPedidos: 0, ticketMedio: 0 });
  });
});

describe("produtosMaisVendidos", () => {
  it("agrega quantidade e valor por nome de produto, ordenado por valor", () => {
    const pedidos = [
      pedido({
        itens: [
          item({ nomeProduto: "Esmalte", qtd: 2, valorUnit: 50 }), // 100
          item({ nomeProduto: "Verniz", qtd: 1, valorUnit: 500 }), // 500
        ],
      }),
      pedido({
        itens: [item({ nomeProduto: "Esmalte", qtd: 3, valorUnit: 50 })], // 150
      }),
    ];
    expect(produtosMaisVendidos(pedidos)).toEqual([
      { nome: "Verniz", quantidade: 1, valorTotal: 500 },
      { nome: "Esmalte", quantidade: 5, valorTotal: 250 },
    ]);
  });

  it("usa descricaoProduto quando não há nomeProduto separado", () => {
    const pedidos = [pedido({ itens: [item({ descricaoProduto: "Item avulso" })] })];
    expect(produtosMaisVendidos(pedidos)).toEqual([
      { nome: "Item avulso", quantidade: 1, valorTotal: 10 },
    ]);
  });

  it("respeita o limite", () => {
    const pedidos = [
      pedido({
        itens: [
          item({ nomeProduto: "A" }),
          item({ nomeProduto: "B" }),
          item({ nomeProduto: "C" }),
        ],
      }),
    ];
    expect(produtosMaisVendidos(pedidos, 2)).toHaveLength(2);
  });
});
