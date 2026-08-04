import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { celulaLimitada, gerarPdf } from "./pdf";
import { montarDadosExportacao } from "./dadosExportacao";
import type { Cliente, ItemPedido, Pedido } from "../../domain/types";

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
  condicaoPagamento: "Boleto 28/ 42",
  obsGerais: "Depósito central",
  criadoEm: "2026-07-01T10:00:00.000Z",
  atualizadoEm: "2026-07-01T10:00:00.000Z",
};

function pedidoBase(itens: ItemPedido[]): Pedido {
  return {
    id: "p1",
    numero: 42,
    marca: "ARARA AZUL",
    clienteId: "c1",
    dataPedido: "2026-07-30",
    representanteNome: "João Vendedor",
    representanteTelefone: "(67) 98888-7777",
    representanteEmail: "joao@exemplo.com",
    formaSolicitacao: "WhatsApp",
    itens,
    descontoTipo: "percentual",
    descontoValor: 10,
    status: "rascunho",
    criadoEm: "2026-07-30T10:00:00.000Z",
    atualizadoEm: "2026-07-30T10:00:00.000Z",
  };
}

const doisItens: ItemPedido[] = [
  {
    item: 1,
    qtd: 10,
    embalagem: "Galão (3,6 L)",
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
];

describe("celulaLimitada", () => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  it("não quebra texto que já cabe na largura", () => {
    expect(celulaLimitada(doc, "Branco", 20)).toEqual(["Branco"]);
  });

  it("string vazia vira uma linha em branco, sem lançar exceção", () => {
    expect(celulaLimitada(doc, "", 20)).toEqual([""]);
  });

  it("quebra em até 2 linhas quando cabe em duas", () => {
    const linhas = celulaLimitada(doc, "Branco neve Arara Azul", 20);
    expect(linhas.length).toBeLessThanOrEqual(2);
    expect(linhas.join(" ")).not.toContain("...");
  });

  it("corta com '...' quando o texto não cabe nem em 2 linhas, sem estourar a largura", () => {
    const textoLongo =
      "Branco neve Arara Azul Valor promocional conferir cor exata com o cliente antes de aplicar";
    const linhas = celulaLimitada(doc, textoLongo, 20);
    expect(linhas).toHaveLength(2);
    expect(linhas[1].endsWith("...")).toBe(true);
    // A própria função garante isso, mas confirmamos que a linha cortada
    // realmente cabe na largura da coluna (o motivo de existir).
    expect(doc.getTextWidth(linhas[0])).toBeLessThanOrEqual(20);
    expect(doc.getTextWidth(linhas[1])).toBeLessThanOrEqual(20);
  });
});

describe("gerarPdf", () => {
  it("gera um PDF válido sem lançar exceção", async () => {
    const dados = montarDadosExportacao(pedidoBase(doisItens), cliente);
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/pdf");

    const cabecalho = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const texto = String.fromCharCode(...cabecalho);
    expect(texto).toBe("%PDF-");
  });

  it("gera sem cliente e sem itens (caso extremo)", async () => {
    const dados = montarDadosExportacao(pedidoBase([]), undefined);
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("gera com muitos itens, forçando quebra de página, sem lançar exceção", async () => {
    const muitosItens: ItemPedido[] = Array.from({ length: 40 }, (_, i) => ({
      item: i + 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: `Produto de teste número ${i + 1} com nome razoavelmente longo`,
      cor: "Branco",
      descricao: i % 3 === 0 ? "Observação de exemplo para ocupar mais espaço na linha" : undefined,
      valorUnit: 10 + i,
    }));
    const dados = montarDadosExportacao(pedidoBase(muitosItens), cliente);
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("gera com padrão/complemento preenchido, inclusive com texto longo", async () => {
    const itens: ItemPedido[] = [
      {
        ...doisItens[0],
        padraoComplemento: "Padrão fosco, exceto amarelo, laranja e vermelho — conferir com o cliente",
      },
      doisItens[1],
    ];
    const dados = montarDadosExportacao(pedidoBase(itens), cliente);
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("gera com motivo do desconto preenchido", async () => {
    const dados = montarDadosExportacao(
      { ...pedidoBase(doisItens), descontoDescricao: "Autorizado pelo gerente" },
      cliente,
    );
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
  });
});
