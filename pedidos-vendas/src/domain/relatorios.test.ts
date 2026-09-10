import { describe, expect, it } from "vitest";
import {
  categoriasMaisVendidas,
  chavePeriodo,
  clientesMaisVendidos,
  emAlgumIntervalo,
  filtrarPedidos,
  granularidadePara,
  granularidadeParaSelecao,
  intervaloDaChave,
  intervaloPeriodo,
  marcasMaisVendidas,
  periodosDisponiveis,
  produtosMaisVendidos,
  resumoVendas,
  rotuloPeriodo,
  serieTemporalItens,
  serieTemporalPedidos,
  SEM_CATEGORIA,
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

describe("navegação de período", () => {
  const ref = new Date(2026, 8, 9); // 09/set/2026, uma quarta-feira

  it("chavePeriodo devolve YYYY-MM (mês) e o domingo da semana", () => {
    expect(chavePeriodo("mes", ref)).toBe("2026-09");
    expect(chavePeriodo("semana", ref)).toBe("2026-09-06");
  });

  it("intervaloDaChave abre o mês e a semana da chave", () => {
    expect(intervaloDaChave("mes", "2026-09")).toEqual({
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    expect(intervaloDaChave("semana", "2026-09-06")).toEqual({
      inicio: "2026-09-06",
      fim: "2026-09-12",
    });
  });

  it("rotuloPeriodo marca o período corrente e nomeia os demais", () => {
    expect(rotuloPeriodo("mes", "2026-09", ref)).toBe("Mês atual");
    expect(rotuloPeriodo("mes", "2026-07", ref)).toBe("Julho/26");
    expect(rotuloPeriodo("semana", "2026-09-06", ref)).toBe("Semana atual");
  });

  it("periodosDisponiveis lista do mais recente ao mais antigo e inclui sempre o atual", () => {
    const pedidos = [
      pedido({ dataPedido: "2026-07-10" }),
      pedido({ dataPedido: "2026-05-02" }),
    ];
    expect(periodosDisponiveis(pedidos, "mes", ref).map((o) => o.chave)).toEqual([
      "2026-09",
      "2026-07",
      "2026-05",
    ]);
  });

  it("emAlgumIntervalo aceita a união de períodos não contíguos", () => {
    const intervalos = [
      intervaloDaChave("mes", "2026-09"),
      intervaloDaChave("mes", "2026-07"),
    ];
    expect(emAlgumIntervalo("2026-09-15", intervalos)).toBe(true);
    expect(emAlgumIntervalo("2026-07-01", intervalos)).toBe(true);
    expect(emAlgumIntervalo("2026-08-15", intervalos)).toBe(false);
  });

  it("granularidadeParaSelecao: diária num período só, mensal em vários ou 'tudo'", () => {
    expect(granularidadeParaSelecao("mes", 1)).toBe("dia");
    expect(granularidadeParaSelecao("mes", 2)).toBe("mes");
    expect(granularidadeParaSelecao("tudo", 1)).toBe("mes");
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

  it("filtra por marcasIn (multi-seleção) e por união de intervalos", () => {
    expect(
      filtrarPedidos(pedidos, { marcasIn: ["Merko", "Arara Azul"] }).map((p) => p.id),
    ).toEqual(["a", "b", "c"]);
    expect(filtrarPedidos(pedidos, { marcasIn: ["Arara Azul"] }).map((p) => p.id)).toEqual(["c"]);
    expect(
      filtrarPedidos(pedidos, {
        intervalos: [
          { inicio: "2026-08-01", fim: "2026-08-31" },
          { inicio: "2026-07-01", fim: "2026-07-31" },
        ],
      }).map((p) => p.id),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("marcasMaisVendidas", () => {
  it("agrega valor líquido e conta pedidos por marca, ordenado por valor", () => {
    const pedidos = [
      pedido({ marca: "Merko", itens: [item({ valorUnit: 100 })] }),
      pedido({ marca: "Merko", itens: [item({ valorUnit: 50 })] }),
      pedido({ marca: "Arara Azul", itens: [item({ valorUnit: 500 })] }),
    ];
    expect(marcasMaisVendidas(pedidos)).toEqual([
      { marca: "Arara Azul", quantidadePedidos: 1, valorTotal: 500 },
      { marca: "Merko", quantidadePedidos: 2, valorTotal: 150 },
    ]);
  });

  it("pedido sem marca cai em 'Sem marca'", () => {
    const pedidos = [pedido({ marca: "", itens: [item({ valorUnit: 10 })] })];
    expect(marcasMaisVendidas(pedidos)[0].marca).toBe("Sem marca");
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

  it("ordena por menor valor quando pedido explicitamente", () => {
    const pedidos = [
      pedido({
        itens: [
          item({ nomeProduto: "Esmalte", qtd: 2, valorUnit: 50 }), // 100
          item({ nomeProduto: "Verniz", qtd: 1, valorUnit: 500 }), // 500
        ],
      }),
    ];
    expect(produtosMaisVendidos(pedidos, 10, "asc")).toEqual([
      { nome: "Esmalte", quantidade: 2, valorTotal: 100 },
      { nome: "Verniz", quantidade: 1, valorTotal: 500 },
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

describe("consistência card × gráfico (desconto de pedido)", () => {
  it("a soma por categoria bate com o Total vendido quando há desconto de pedido", () => {
    const pedidos = [
      pedido({
        descontoTipo: "percentual",
        descontoValor: 12,
        itens: [
          item({ nomeProduto: "Esmalte", qtd: 3, valorUnit: 95.64 }),
          item({ nomeProduto: "Verniz", qtd: 2, valorUnit: 453.31 }),
        ],
      }),
      pedido({
        descontoTipo: "valor",
        descontoValor: 37.5,
        itens: [item({ nomeProduto: "Arenito", qtd: 4, valorUnit: 88.9 })],
      }),
    ];
    const categoriaPorNome = new Map([
      ["Esmalte", "Esmaltes"],
      ["Verniz", "Vernizes"],
      ["Arenito", "Texturas"],
    ]);
    const categorias = categoriasMaisVendidas(
      produtosMaisVendidos(pedidos, Infinity),
      categoriaPorNome,
    );
    const somaCategorias =
      Math.round(categorias.reduce((s, c) => s + c.valorTotal, 0) * 100) / 100;
    expect(somaCategorias).toBe(resumoVendas(pedidos).totalVendido);
  });
});

describe("clientesMaisVendidos", () => {
  const nomePorClienteId = new Map([
    ["c1", "Tintas do Vale"],
    ["c2", "Casa da Tinta"],
  ]);

  it("agrega valor e conta pedidos por cliente, ordenado por valor", () => {
    const pedidos = [
      pedido({ clienteId: "c1", itens: [item({ qtd: 1, valorUnit: 100 })] }),
      pedido({ clienteId: "c1", itens: [item({ qtd: 1, valorUnit: 50 })] }),
      pedido({ clienteId: "c2", itens: [item({ qtd: 1, valorUnit: 500 })] }),
    ];
    expect(clientesMaisVendidos(pedidos, nomePorClienteId)).toEqual([
      { clienteId: "c2", nome: "Casa da Tinta", quantidadePedidos: 1, valorTotal: 500 },
      { clienteId: "c1", nome: "Tintas do Vale", quantidadePedidos: 2, valorTotal: 150 },
    ]);
  });

  it("usa 'Cliente removido' quando o id não está no mapa (cliente excluído)", () => {
    const pedidos = [pedido({ clienteId: "fantasma", itens: [item({ valorUnit: 10 })] })];
    expect(clientesMaisVendidos(pedidos, nomePorClienteId)[0].nome).toBe("Cliente removido");
  });

  it("ordena por menor valor quando pedido explicitamente", () => {
    const pedidos = [
      pedido({ clienteId: "c1", itens: [item({ valorUnit: 100 })] }),
      pedido({ clienteId: "c2", itens: [item({ valorUnit: 500 })] }),
    ];
    expect(clientesMaisVendidos(pedidos, nomePorClienteId, 10, "asc").map((c) => c.clienteId)).toEqual([
      "c1",
      "c2",
    ]);
  });
});

describe("categoriasMaisVendidas", () => {
  it("reagrupa produtos já somados por categoria, ordenado por valor", () => {
    const produtos = [
      { nome: "Esmalte brilhante", quantidade: 2, valorTotal: 200 },
      { nome: "Esmalte fosco", quantidade: 1, valorTotal: 100 },
      { nome: "Arenito", quantidade: 3, valorTotal: 900 },
    ];
    const categoriaPorNome = new Map([
      ["Esmalte brilhante", "Esmaltes"],
      ["Esmalte fosco", "Esmaltes"],
      ["Arenito", "Texturas"],
    ]);
    expect(categoriasMaisVendidas(produtos, categoriaPorNome)).toEqual([
      { categoria: "Texturas", quantidade: 3, valorTotal: 900 },
      { categoria: "Esmaltes", quantidade: 3, valorTotal: 300 },
    ]);
  });

  it("agrupa em 'Sem categoria' produtos que não casam com o catálogo atual (renomeado/removido)", () => {
    const produtos = [{ nome: "Produto descontinuado", quantidade: 1, valorTotal: 50 }];
    expect(categoriasMaisVendidas(produtos, new Map())).toEqual([
      { categoria: SEM_CATEGORIA, quantidade: 1, valorTotal: 50 },
    ]);
  });
});

describe("granularidadePara", () => {
  it("'tudo' usa granularidade mensal; semana/mês usam diária", () => {
    expect(granularidadePara("tudo")).toBe("mes");
    expect(granularidadePara("semana")).toBe("dia");
    expect(granularidadePara("mes")).toBe("dia");
  });
});

describe("serieTemporalPedidos", () => {
  it("soma o total de cada pedido por dia, em ordem cronológica", () => {
    const pedidos = [
      pedido({ dataPedido: "2026-08-02", itens: [item({ valorUnit: 50 })] }),
      pedido({ dataPedido: "2026-08-01", itens: [item({ valorUnit: 100 })] }),
      pedido({ dataPedido: "2026-08-01", itens: [item({ valorUnit: 20 })] }),
    ];
    expect(serieTemporalPedidos(pedidos, "dia")).toEqual([
      { chave: "2026-08-01", rotulo: "01/08", valorTotal: 120 },
      { chave: "2026-08-02", rotulo: "02/08", valorTotal: 50 },
    ]);
  });

  it("agrupa por mês com rótulo abreviado", () => {
    const pedidos = [
      pedido({ dataPedido: "2026-08-15", itens: [item({ valorUnit: 100 })] }),
      pedido({ dataPedido: "2026-09-01", itens: [item({ valorUnit: 200 })] }),
    ];
    expect(serieTemporalPedidos(pedidos, "mes")).toEqual([
      { chave: "2026-08", rotulo: "ago/26", valorTotal: 100 },
      { chave: "2026-09", rotulo: "set/26", valorTotal: 200 },
    ]);
  });
});

describe("serieTemporalItens", () => {
  it("soma só os itens cujo nome está no conjunto, ignorando os demais itens do mesmo pedido", () => {
    const pedidos = [
      pedido({
        dataPedido: "2026-08-01",
        itens: [
          item({ nomeProduto: "Arenito", valorUnit: 100 }),
          item({ nomeProduto: "Esmalte", valorUnit: 500 }), // fora do conjunto — ignorado
        ],
      }),
      pedido({
        dataPedido: "2026-08-01",
        itens: [item({ nomeProduto: "Arenito glitz", valorUnit: 50 })],
      }),
    ];
    const nomes = new Set(["Arenito", "Arenito glitz"]);
    expect(serieTemporalItens(pedidos, nomes, "dia")).toEqual([
      { chave: "2026-08-01", rotulo: "01/08", valorTotal: 150 },
    ]);
  });
});
