import { describe, expect, it } from "vitest";
import {
  analisarLinhas,
  converter,
  detectarColunasMatriz,
  detectarMapeamentoLista,
} from "./importarPlanilha";

describe("detectarMapeamentoLista", () => {
  it("casa os nomes canônicos", () => {
    expect(detectarMapeamentoLista(["descricao_produto", "embalagem", "valor_unit"])).toEqual({
      descricaoProduto: 0,
      embalagem: 1,
      valorUnit: 2,
    });
  });

  it("casa variações com acento, espaço e maiúscula", () => {
    expect(
      detectarMapeamentoLista(["Descrição do Produto", "Tamanho", "Preço Unitário"]),
    ).toEqual({
      descricaoProduto: 0,
      embalagem: 1,
      valorUnit: 2,
    });
  });

  it("devolve null para coluna ausente", () => {
    const mapa = detectarMapeamentoLista(["Produto", "Valor"]);
    expect(mapa.descricaoProduto).toBe(0);
    expect(mapa.valorUnit).toBe(1);
    expect(mapa.embalagem).toBeNull();
  });
});

describe("detectarColunasMatriz", () => {
  it("identifica categoria, produto, detalhes e sobra as embalagens", () => {
    const colunas = detectarColunasMatriz([
      "Categoria",
      "Produto",
      "Detalhes",
      "Galão\r\n3,6 L",
      "Lata\r\n18 L",
    ]);
    expect(colunas.categoria).toBe(0);
    expect(colunas.produto).toBe(1);
    expect(colunas.detalhes).toBe(2);
    expect(colunas.embalagens).toEqual([
      { indice: 3, embalagem: "Galão 3,6 L" },
      { indice: 4, embalagem: "Lata 18 L" },
    ]);
  });

  it("permite fixar manualmente uma coluna e recalcular as demais", () => {
    const colunas = detectarColunasMatriz(["Categoria", "Produto", "Detalhes", "Galão"], {
      detalhes: null,
    });
    expect(colunas.detalhes).toBeNull();
    expect(colunas.embalagens.map((e) => e.indice)).toEqual([2, 3]);
  });
});

describe("analisarLinhas — detecção de formato", () => {
  it("reconhece a matriz oficial (categoria, produto, detalhes + várias embalagens)", () => {
    const planilha = analisarLinhas([
      ["Categoria", "Produto", "Detalhes", "Galão\r\n3,6 L", "Lata\r\n18 L", "Tambor\r\n180 L"],
      ["Esmaltes", "Esmalte sintético brilhante", "exceto amarelo", 95.64, 453.31, 3994.44],
    ]);
    expect(planilha.formato).toBe("matriz");
    expect(planilha.colunasMatriz.produto).toBe(1);
    expect(planilha.colunasMatriz.embalagens).toHaveLength(3);
  });

  it("reconhece uma lista simples de 3 colunas", () => {
    const planilha = analisarLinhas([
      ["Produto", "Embalagem", "Valor"],
      ["Esmalte sintético", "Galão 3,6 L", "95,64"],
    ]);
    expect(planilha.formato).toBe("lista");
  });

  it("acha o cabeçalho depois de linhas de título", () => {
    const planilha = analisarLinhas([
      ["TABELA DE PREÇOS", "", ""],
      ["", "", ""],
      ["Produto", "Embalagem", "Valor"],
      ["Esmalte sintético", "Galão 3,6 L", "95,64"],
    ]);
    expect(planilha.linhaCabecalho).toBe(2);
    expect(planilha.mapeamentoLista.descricaoProduto).toBe(0);
  });

  it("marca -1 quando não encontra colunas reconhecíveis", () => {
    const planilha = analisarLinhas([
      ["coluna a", "coluna b"],
      ["x", "y"],
    ]);
    expect(planilha.linhaCabecalho).toBe(-1);
  });
});

describe("converter — formato lista", () => {
  const planilha = analisarLinhas([
    ["Produto", "Embalagem", "Valor unitário"],
    ["Esmalte sintético brilhante", "Galão 3,6 L", "95,64"],
    ["Esmalte sintético brilhante", "Lata 18 L", "453,31"],
    ["", "Galão", "10,00"],
    ["Resina multiúso cores", "Galão", "sob consulta"],
    ["Verniz marítimo", "Tambor 180 L", "5.794,88"],
    ["Item zerado", "Galão", "0"],
    ["", "", ""],
  ]);

  it("converte as linhas válidas", () => {
    const { produtos } = converter(planilha, planilha.mapeamentoLista);
    expect(produtos).toEqual([
      { nome: "Esmalte sintético brilhante", embalagem: "Galão 3,6 L", valorUnit: 95.64 },
      { nome: "Esmalte sintético brilhante", embalagem: "Lata 18 L", valorUnit: 453.31 },
      { nome: "Verniz marítimo", embalagem: "Tambor 180 L", valorUnit: 5794.88 },
    ]);
  });

  it("reporta as linhas ignoradas com o número que o usuário vê no Excel", () => {
    const { ignorados } = converter(planilha, planilha.mapeamentoLista);
    expect(ignorados.map((i) => i.linha)).toEqual([4, 5, 7]);
    expect(ignorados[0].motivo).toMatch(/descrição/i);
    expect(ignorados[1].motivo).toMatch(/inválido/i);
    expect(ignorados[2].motivo).toMatch(/zerado/i);
  });

  it("aceita a planilha sem coluna de embalagem", () => {
    const semEmbalagem = analisarLinhas([
      ["Produto", "Valor"],
      ["Thinner 8116", "84,50"],
    ]);
    const { produtos } = converter(semEmbalagem, semEmbalagem.mapeamentoLista);
    expect(produtos).toEqual([{ nome: "Thinner 8116", embalagem: "", valorUnit: 84.5 }]);
  });

  it("não converte nada sem as colunas obrigatórias", () => {
    const { produtos } = converter(planilha, {
      descricaoProduto: null,
      embalagem: null,
      valorUnit: null,
    });
    expect(produtos).toEqual([]);
  });

  it("usa o método unificado sem passar mapeamento explícito", () => {
    const { produtos } = converter(planilha);
    expect(produtos.length).toBe(3);
  });
});

describe("converter — formato matriz (molde oficial da tabela de preços)", () => {
  // Recorte real de "Tabela_Preco_Estruturada.xlsx": Categoria, Produto, Detalhes,
  // seguidos de colunas de embalagem com o cabeçalho quebrado em duas linhas.
  const cabecalho = [
    "Categoria",
    "Produto",
    "Detalhes",
    "Galão\r\n3,6 L",
    "1/4\r\n900 ml",
    "Lata\r\n18 L",
    "Tambor\r\n180 L",
  ];
  const planilha = analisarLinhas([
    cabecalho,
    [
      "Esmaltes, Vernizes e Resinas Multiúso base Solvente",
      "Esmalte sintético brilhante",
      "exceto amarelo, laranja e vermelho",
      95.64,
      31.25,
      453.31,
      3994.44,
    ],
    [
      "Esmaltes, Vernizes e Resinas Multiúso base Solvente",
      "Esmalte sintético metálico",
      "",
      127.1,
      40.16,
      "",
      5521.92,
    ],
    ["Solventes", "Aguarrás", "", "", 18.1, 327.77, ""],
    ["", "Produto sem preço nenhum", "", "", "", "", ""],
    ["Categoria X", "", "sem nome de produto", 10, "", "", ""],
  ]);

  it("detecta a matriz com as 4 colunas de embalagem", () => {
    expect(planilha.formato).toBe("matriz");
    expect(planilha.colunasMatriz.embalagens.map((e) => e.embalagem)).toEqual([
      "Galão 3,6 L",
      "1/4 900 ml",
      "Lata 18 L",
      "Tambor 180 L",
    ]);
  });

  it("explode cada linha em uma entrada por embalagem preenchida, com nome e detalhes separados", () => {
    const { produtos } = converter(planilha);
    const detalhesVariante = "exceto amarelo, laranja e vermelho";
    expect(produtos).toEqual([
      {
        nome: "Esmalte sintético brilhante",
        detalhes: detalhesVariante,
        embalagem: "Galão 3,6 L",
        valorUnit: 95.64,
      },
      {
        nome: "Esmalte sintético brilhante",
        detalhes: detalhesVariante,
        embalagem: "1/4 900 ml",
        valorUnit: 31.25,
      },
      {
        nome: "Esmalte sintético brilhante",
        detalhes: detalhesVariante,
        embalagem: "Lata 18 L",
        valorUnit: 453.31,
      },
      {
        nome: "Esmalte sintético brilhante",
        detalhes: detalhesVariante,
        embalagem: "Tambor 180 L",
        valorUnit: 3994.44,
      },
      { nome: "Esmalte sintético metálico", embalagem: "Galão 3,6 L", valorUnit: 127.1 },
      { nome: "Esmalte sintético metálico", embalagem: "1/4 900 ml", valorUnit: 40.16 },
      { nome: "Esmalte sintético metálico", embalagem: "Tambor 180 L", valorUnit: 5521.92 },
      { nome: "Aguarrás", embalagem: "1/4 900 ml", valorUnit: 18.1 },
      { nome: "Aguarrás", embalagem: "Lata 18 L", valorUnit: 327.77 },
    ]);
  });

  it("ignora célula vazia como ausência da combinação, sem gerar aviso", () => {
    const { ignorados } = converter(planilha);
    // Não deve haver aviso sobre as células vazias de "Esmalte sintético metálico" (Lata 18 L).
    expect(ignorados.some((i) => i.motivo.includes("Lata 18 L") && i.linha === 3)).toBe(false);
  });

  it("avisa quando a linha não tem nenhum preço preenchido", () => {
    const { ignorados } = converter(planilha);
    expect(ignorados).toContainEqual({ linha: 5, motivo: "Nenhum preço informado nesta linha" });
  });

  it("avisa quando a linha não tem nome de produto", () => {
    const { ignorados } = converter(planilha);
    expect(ignorados).toContainEqual({ linha: 6, motivo: "Sem nome de produto" });
  });
});
