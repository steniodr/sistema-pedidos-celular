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

  it("soma a variação de tamanho/tipo ao nome, quando o item tiver uma", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Caixa (20 kg)",
      descricaoProduto: "Arenito glitz",
      nomeProduto: "Arenito glitz",
      detalhesProduto: "base clara/escura e cores",
      variacaoProduto: "médio",
      valorUnit: 126.58,
    });

    const dados = montarDadosExportacao(pedido, cliente);

    expect(dados.itens[0].descricaoProduto).toBe("Arenito glitz médio");
  });

  it("não soma nada quando o item não tem variação (a maioria dos produtos)", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: "Esmalte sintético brilhante",
      nomeProduto: "Esmalte sintético brilhante",
      valorUnit: 95.64,
    });

    const dados = montarDadosExportacao(pedido, cliente);

    expect(dados.itens[0].descricaoProduto).toBe("Esmalte sintético brilhante");
  });

  it("usa o nome customizado (nomeExportado) no lugar do nome do produto, quando houver", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: "Esmalte sintético brilhante",
      nomeProduto: "Esmalte sintético brilhante",
      nomeExportado: "Esmalte Premium Linha Ouro",
      valorUnit: 95.64,
    });

    const dados = montarDadosExportacao(pedido, cliente);

    expect(dados.itens[0].descricaoProduto).toBe("Esmalte Premium Linha Ouro");
  });

  it("soma a variação ao nome customizado, quando o item tiver as duas coisas", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Caixa (20 kg)",
      descricaoProduto: "Arenito glitz",
      nomeProduto: "Arenito glitz",
      nomeExportado: "Arenito Efeito Cintilante",
      variacaoProduto: "médio",
      valorUnit: 126.58,
    });

    const dados = montarDadosExportacao(pedido, cliente);

    expect(dados.itens[0].descricaoProduto).toBe("Arenito Efeito Cintilante médio");
  });

  it("ignora nomeExportado em branco (só espaços) e cai no nome do produto normalmente", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: "Esmalte sintético brilhante",
      nomeProduto: "Esmalte sintético brilhante",
      nomeExportado: "   ",
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

describe("montarDadosExportacao — transportadora e local de entrega", () => {
  it("usa a transportadora e o local de entrega do cliente quando o pedido não tem os próprios", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(pedido, {
      ...cliente,
      transportadora: "Rodoviário Sul",
      obsGerais: "Entregar pela manhã",
    });
    expect(dados.cliente.transportadora).toBe("Rodoviário Sul");
    expect(dados.cliente.obsGerais).toBe("Entregar pela manhã");
  });

  it("prioriza a transportadora e o local de entrega editados no pedido sobre os do cadastro do cliente", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(
      { ...pedido, transportadora: "FOB - Transportadora", localEntrega: "Depósito central" },
      { ...cliente, transportadora: "Rodoviário Sul", obsGerais: "Entregar pela manhã" },
    );
    expect(dados.cliente.transportadora).toBe("FOB - Transportadora");
    expect(dados.cliente.obsGerais).toBe("Depósito central");
  });
});

describe("montarDadosExportacao — orçamento (sem número de pedido de verdade)", () => {
  it("usa o código do orçamento no lugar do número quando somenteOrcamento", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(
      { ...pedido, somenteOrcamento: true, codigoOrcamento: "ORC01" },
      cliente,
    );
    expect(dados.numero).toBe("ORC01");
  });

  it("usa o número normal quando não é orçamento, mesmo com um código antigo gravado", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(
      { ...pedido, somenteOrcamento: false, codigoOrcamento: "ORC01" },
      cliente,
    );
    expect(dados.numero).toBe(42);
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

  it("usa o prefixo 'orcamento' quando o número exportado é o código ORC", () => {
    const pedido = pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    });
    const dados = montarDadosExportacao(
      { ...pedido, somenteOrcamento: true, codigoOrcamento: "ORC01" },
      cliente,
    );
    expect(nomeArquivo(dados, "xlsx")).toBe("orcamento-ORC01-tintas-do-vale-ltda.xlsx");
  });
});

describe("telefone do representante na exportação", () => {
  function pedidoCom(telefone: string): Pedido {
    return pedidoComItem({
      item: 1,
      qtd: 1,
      embalagem: "Galão",
      descricaoProduto: "Produto",
      valorUnit: 10,
    }) as Pedido & { representanteTelefone?: string };
  }

  it("sai mascarado a partir dos dígitos guardados", () => {
    const base = pedidoCom("");
    const dados = montarDadosExportacao(
      { ...base, representanteTelefone: "11978319643" },
      cliente,
    );
    expect(dados.representante.telefone).toBe("(11) 97831-9643");
  });

  it("conserta o valor meio formatado que ficou gravado em cadastros antigos", () => {
    const base = pedidoCom("");
    const dados = montarDadosExportacao(
      { ...base, representanteTelefone: "(11) 9783-19643" },
      cliente,
    );
    expect(dados.representante.telefone).toBe("(11) 97831-9643");
  });

  it("telefone vazio continua vazio", () => {
    const base = pedidoCom("");
    const dados = montarDadosExportacao({ ...base, representanteTelefone: "" }, cliente);
    expect(dados.representante.telefone).toBe("");
  });
});
