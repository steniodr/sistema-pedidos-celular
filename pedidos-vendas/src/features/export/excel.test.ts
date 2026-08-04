import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { gerarExcel } from "./excel";
import { montarDadosExportacao, nomeArquivo } from "./dadosExportacao";
import type { Cliente, Pedido } from "../../domain/types";

/**
 * Sem `fetch` para o modelo oficial (não há servidor no teste), `gerarExcel` cai no
 * gerador próprio. É esse caminho que está sendo verificado aqui: gera, lê de volta
 * e confere os valores nas células.
 */

const cliente: Cliente = {
  id: "c1",
  nome: "Tintas do Vale Ltda",
  cpfCnpj: "11222333000181",
  codigoCliente: "4521",
  telefone: "67999887766",
  endereco: "Rua das Palmeiras, 120",
  bairro: "Centro",
  cidadeEstado: "Campo Grande / MS",
  cep: "79002000",
  transportadora: "Rodoviário Sul",
  condicaoPagamento: "28/35/42 dias",
  obsGerais: "Depósito central",
  criadoEm: "2026-07-01T10:00:00.000Z",
  atualizadoEm: "2026-07-01T10:00:00.000Z",
};

const pedido: Pedido = {
  id: "p1",
  numero: 42,
  marca: "ARARA AZUL",
  clienteId: "c1",
  dataPedido: "2026-07-30",
  representanteNome: "João Vendedor",
  representanteTelefone: "(67) 98888-7777",
  representanteEmail: "joao@exemplo.com",
  formaSolicitacao: "WhatsApp",
  itens: [
    {
      item: 1,
      qtd: 10,
      embalagem: "Galão (3,6 L)",
      // Como o app grava de verdade: descricaoProduto combina nome+detalhes (usado
      // para reabrir o fluxo guiado na edição); o export deve mostrar só o nome.
      descricaoProduto: "Esmalte sintético brilhante (exceto amarelo, laranja e vermelho)",
      nomeProduto: "Esmalte sintético brilhante",
      detalhesProduto: "exceto amarelo, laranja e vermelho",
      cor: "Branco",
      padraoComplemento: "Fosco",
      descricao: "Entregar junto com o pedido anterior",
      valorUnit: 95.64,
    },
    {
      item: 2,
      qtd: 2,
      embalagem: "Lata (18 L)",
      descricaoProduto: "Verniz marítimo",
      valorUnit: 639.83,
    },
  ],
  descontoTipo: "percentual",
  descontoValor: 10,
  status: "rascunho",
  criadoEm: "2026-07-30T10:00:00.000Z",
  atualizadoEm: "2026-07-30T10:00:00.000Z",
};

async function abrirGerado() {
  const dados = montarDadosExportacao(pedido, cliente);
  const { blob } = await gerarExcel(dados);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return { workbook, planilha: workbook.worksheets[0], dados };
}

describe("gerarExcel (sem modelo oficial)", () => {
  it("produz um .xlsx válido e legível", async () => {
    const { planilha } = await abrirGerado();
    expect(planilha.name).toBe("Pedido");
  });

  it("escreve marca, número e dados do cliente no cabeçalho", async () => {
    const { planilha } = await abrirGerado();
    expect(planilha.getCell("B1").value).toBe("ARARA AZUL");
    expect(planilha.getCell("F1").value).toBe(42);
    expect(planilha.getCell("B2").value).toBe("Tintas do Vale Ltda");
    expect(planilha.getCell("F2").value).toBe("4521");
    expect(planilha.getCell("B3").value).toBe("11.222.333/0001-81");
    expect(planilha.getCell("F6").value).toBe("28/35/42 dias");
  });

  it("escreve uma linha por item, com total como fórmula, sem os detalhes/variante no nome", async () => {
    const { planilha } = await abrirGerado();
    // Cabeçalho da tabela na linha 9; itens a partir da 10.
    expect(planilha.getCell("A9").value).toBe("Item");
    // Só o nome do produto — "(exceto amarelo, laranja e vermelho)" não aparece.
    expect(planilha.getCell("D10").value).toBe("Esmalte sintético brilhante");
    expect(planilha.getCell("B10").value).toBe(10);
    expect(planilha.getCell("G10").value).toBe(95.64);

    const total = planilha.getCell("H10").value as { formula: string; result: number };
    expect(total.formula).toBe("B10*G10");
    expect(total.result).toBe(956.4);

    expect(planilha.getCell("D11").value).toBe("Verniz marítimo");
  });

  it("totaliza com o desconto aplicado, acima do rodapé", async () => {
    const { planilha, dados } = await abrirGerado();
    // 10 × 95,64 = 956,40  +  2 × 639,83 = 1.279,66
    expect(dados.totais.subtotal).toBe(2236.06);
    expect(dados.totais.desconto).toBe(223.61);
    expect(dados.totais.total).toBe(2012.45);

    // Último item na linha 11 (cabeçalho na 9, itens a partir da 10); Subtotal/Desconto
    // logo abaixo (linhas 13 e 14), sem motivo (pedido não tem descontoDescricao).
    expect(planilha.getCell("F13").value).toBe("Subtotal");
    expect(planilha.getCell("G13").value).toBe(2236.06);
    expect(planilha.getCell("F14").value).toBe("Desconto (10%)");
    expect(planilha.getCell("G14").value).toBe(-223.61);
  });

  it("escreve o rodapé de 4 colunas com forma de solicitação, data, representante e valor do pedido", async () => {
    const { planilha, dados } = await abrirGerado();
    // Rótulos na linha 16, valores na 17.
    expect(planilha.getCell("A16").value).toBe("FORMA DE SOLICITAÇÃO");
    expect(planilha.getCell("C16").value).toBe("DATA");
    expect(planilha.getCell("G16").value).toBe("VALOR DO PEDIDO");

    expect(planilha.getCell("A17").value).toBe("WhatsApp");
    expect(planilha.getCell("C17").value).toBe("30/07/2026");
    expect(planilha.getCell("D17").value).toContain("João Vendedor");
    expect(planilha.getCell("D17").value).toContain("joao@exemplo.com");
    expect(planilha.getCell("G17").value).toBe(dados.totais.total);
  });

  it("mostra o motivo do desconto quando preenchido", async () => {
    const dados = montarDadosExportacao(
      { ...pedido, descontoDescricao: "Autorizado pelo gerente" },
      cliente,
    );
    const { blob } = await gerarExcel(dados);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.worksheets[0];

    // Com a linha extra do motivo, o rodapé desce uma linha (rótulos na 17).
    expect(planilha.getCell("A15").value).toContain("Autorizado pelo gerente");
    expect(planilha.getCell("A17").value).toBe("FORMA DE SOLICITAÇÃO");
  });
});

describe("nomeArquivo", () => {
  it("gera nome sem acento nem caractere proibido", () => {
    const dados = montarDadosExportacao(pedido, cliente);
    expect(nomeArquivo(dados, "xlsx")).toBe("pedido-42-tintas-do-vale-ltda.xlsx");
  });

  it("funciona sem cliente", () => {
    const dados = montarDadosExportacao(pedido, undefined);
    expect(nomeArquivo(dados, "pdf")).toBe("pedido-42.pdf");
  });
});
