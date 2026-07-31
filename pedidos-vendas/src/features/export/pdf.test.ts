import { describe, expect, it } from "vitest";
import { gerarPdf } from "./pdf";
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
  localEntrega: "Depósito central",
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

  it("gera com motivo do desconto preenchido", async () => {
    const dados = montarDadosExportacao(
      { ...pedidoBase(doisItens), descontoDescricao: "Autorizado pelo gerente" },
      cliente,
    );
    const blob = await gerarPdf(dados);
    expect(blob.size).toBeGreaterThan(0);
  });
});
