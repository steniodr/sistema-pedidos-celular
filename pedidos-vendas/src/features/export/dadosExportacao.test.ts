import { describe, expect, it } from "vitest";
import { montarDadosExportacao, nomeArquivo } from "./dadosExportacao";
import type { Cliente, Pedido } from "../../domain/types";

const cliente: Cliente = {
  id: "c1",
  nome: "Tintas do Vale Ltda",
  cpfCnpj: "11222333000181",
  criadoEm: "2026-07-01T10:00:00.000Z",
  atualizadoEm: "2026-07-01T10:00:00.000Z",
};

function pedidoComItem(item: Pedido["itens"][number]): Pedido {
  return {
    id: "p1",
    numero: 42,
    marca: "ARARA AZUL",
    clienteId: "c1",
    dataPedido: "2026-07-30",
    itens: [item],
    descontoTipo: "percentual",
    descontoValor: 0,
    status: "rascunho",
    criadoEm: "2026-07-30T10:00:00.000Z",
    atualizadoEm: "2026-07-30T10:00:00.000Z",
  };
}

describe("montarDadosExportacao — descrição do produto exportada", () => {
  it("usa só o nome do produto, sem os detalhes/variante, quando nomeProduto está gravado", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: "Esmalte sintético brilhante (exceto amarelo, laranja e vermelho)",
      nomeProduto: "Esmalte sintético brilhante",
      detalhesProduto: "exceto amarelo, laranja e vermelho",
      valorUnit: 95.64,
    });

    const dados = montarDadosExportacao(pedido, cliente);

    expect(dados.itens[0].descricaoProduto).toBe("Esmalte sintético brilhante");
    expect(dados.itens[0].descricaoProduto).not.toContain("exceto amarelo");
  });

  it("cai no texto combinado só quando o item é antigo e não tem nomeProduto gravado", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: "Esmalte sintético brilhante",
      valorUnit: 95.64,
    });

    const dados = montarDadosExportacao(pedido, cliente);
    expect(dados.itens[0].descricaoProduto).toBe("Esmalte sintético brilhante");
  });
});

describe("montarDadosExportacao — condição de pagamento", () => {
  it("usa a do cliente quando o pedido não tem uma própria", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(pedido, { ...cliente, condicaoPagamento: "Pix" });
    expect(dados.cliente.condicaoPagamento).toBe("Pix");
  });

  it("prioriza a condição de pagamento editada no pedido sobre a do cadastro do cliente", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(
      { ...pedido, condicaoPagamento: "Boleto 30" },
      { ...cliente, condicaoPagamento: "Pix" },
    );
    expect(dados.cliente.condicaoPagamento).toBe("Boleto 30");
  });
});

describe("nomeArquivo", () => {
  it("continua funcionando normalmente", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(pedido, cliente);
    expect(nomeArquivo(dados, "xlsx")).toBe("pedido-42-tintas-do-vale-ltda.xlsx");
  });
});
