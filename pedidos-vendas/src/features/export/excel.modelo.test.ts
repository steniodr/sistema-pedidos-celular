import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gerarExcel, modeloDisponivel } from "./excel";
import { montarDadosExportacao } from "./dadosExportacao";
import type { Cliente, Pedido } from "../../domain/types";

/**
 * Testa o caminho real (preencherModelo) contra os dois arquivos verdadeiros do
 * molde, enviados pelo usuário em public/templates/modelo_pedido_30.xlsx (até 30
 * itens) e modelo_pedido_70.xlsx (31 a 70 itens). `fetch` não serve arquivos
 * locais fora de um servidor, então o mock abaixo lê o arquivo certo do disco
 * (pelo caminho pedido) e devolve uma Response equivalente — o mesmo que o
 * navegador faria ao servir o arquivo do precache do service worker.
 */

const CAMINHO_MODELO_30 = path.resolve(
  __dirname,
  "../../../public/templates/modelo_pedido_30.xlsx",
);
const CAMINHO_MODELO_70 = path.resolve(
  __dirname,
  "../../../public/templates/modelo_pedido_70.xlsx",
);

beforeEach(() => {
  const buffer30 = readFileSync(CAMINHO_MODELO_30);
  const buffer70 = readFileSync(CAMINHO_MODELO_70);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const buffer = url.includes("_70") ? buffer70 : buffer30;
      return new Response(buffer, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

/** Pedido de 2 itens (o padrão acima) sempre cai no molde de 30. */
async function abrirGerado() {
  const dados = montarDadosExportacao(pedido, cliente);
  const { blob } = await gerarExcel(dados);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return { workbook, planilha: workbook.getWorksheet("Pedido")!, dados };
}

function pedidoComItens(quantidade: number): Pedido {
  return {
    ...pedido,
    itens: Array.from({ length: quantidade }, (_, i) => ({
      item: i + 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: `Produto ${i + 1}`,
      valorUnit: 10,
    })),
  };
}

describe("gerarExcel — modelo real (aba Pedido, molde de 30 itens)", () => {
  it("modeloDisponivel() acha o arquivo enviado pelo usuário", async () => {
    expect(await modeloDisponivel()).toBe(true);
  });

  it("preenche o cabeçalho nas células mestres corretas, sem sobrescrever rótulos vizinhos", async () => {
    const { planilha } = await abrirGerado();
    expect(planilha.getCell("C2").value).toBe("ARARA AZUL");
    expect(planilha.getCell("A2").value).toBe("MARCA:"); // rótulo intacto
    expect(planilha.getCell("G2").value).toBe(42);
    expect(planilha.getCell("F2").value).toBe("Pedido n°:"); // rótulo intacto

    expect(planilha.getCell("D3").value).toBe("Tintas do Vale Ltda");
    expect(planilha.getCell("G3").value).toBe("4521");
    expect(planilha.getCell("D4").value).toBe("11.222.333/0001-81");
    expect(planilha.getCell("G4").value).toBe("(67) 99988-7766");
    expect(planilha.getCell("F7").value).toBe("Boleto 28/ 42");
    expect(planilha.getCell("D8").value).toBe("Depósito central");
  });

  it("preenche as linhas de item com o total como valor fixo, sem os detalhes/variante no nome", async () => {
    const { planilha } = await abrirGerado();
    // Só o nome do produto — "(exceto amarelo, laranja e vermelho)" não aparece.
    expect(planilha.getCell("D11").value).toBe("Esmalte sintético brilhante");
    expect(planilha.getCell("B11").value).toBe(10);
    expect(planilha.getCell("G11").value).toBe(95.64);

    // Valor fixo, não fórmula — ver comentário em `preencherModelo` sobre por
    // que fórmula compartilhada do molde não é preservada (corrompia o arquivo
    // ao serializar com mais de 2 itens).
    expect(planilha.getCell("H11").value).toBeCloseTo(956.4);

    expect(planilha.getCell("D12").value).toBe("Verniz marítimo");
  });

  it("com 3 ou mais itens, não trava na fórmula compartilhada de total (regressão)", async () => {
    // Bug real: em algumas linhas o ExcelJS lança ao traduzir a fórmula
    // compartilhada de "Total" (TypeError: Cannot read properties of undefined
    // (reading 'replace')) — só aparecia a partir do 3º item porque os testes
    // acima sempre usaram 2. `preencherModelo` deve continuar (com valor fixo
    // na célula problemática) em vez de derrubar a exportação inteira.
    const pedidoTresItens: Pedido = {
      ...pedido,
      itens: [
        ...pedido.itens,
        { item: 3, qtd: 1, embalagem: "Galão (3,6 L)", descricaoProduto: "Selador acrílico", valorUnit: 68.9 },
      ],
    };
    const dados = montarDadosExportacao(pedidoTresItens, cliente);
    const { blob, usouModelo, motivoFallback } = await gerarExcel(dados);

    expect(usouModelo).toBe(true);
    expect(motivoFallback).toBeUndefined();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;
    expect(planilha.getCell("D13").value).toBe("Selador acrílico");
    // Célula do total: valor correto, seja como fórmula ou como valor fixo
    // (dependendo se o ExcelJS conseguiu traduzir a fórmula compartilhada).
    const totalLinha13 = planilha.getCell("H13").value;
    const resultado =
      typeof totalLinha13 === "object" && totalLinha13 !== null
        ? (totalLinha13 as { result: number }).result
        : totalLinha13;
    expect(resultado).toBeCloseTo(68.9);
  });

  it("preenche o rodapé de 4 colunas, com o total já descontado", async () => {
    const { planilha, dados } = await abrirGerado();
    // Linha 43 é só o rótulo (nunca sobrescrito); o valor de verdade vai na
    // linha de baixo (44), mesma linha de Representante e Valor do pedido.
    expect(planilha.getCell("A43").value).toBe("FORMA DE SOLICITAÇÃO");
    expect(planilha.getCell("D43").value).toBe("DATA");
    expect(planilha.getCell("A44").value).toBe("WhatsApp");
    expect(planilha.getCell("D44").value).toBe("30/07/2026");
    expect(planilha.getCell("E44").value).toContain("João Vendedor");
    expect(planilha.getCell("E45").value).toBe("joao@exemplo.com");

    // A fórmula original (SUM dos itens, incluindo as próprias linhas de
    // Subtotal/Desconto) não aplica desconto de verdade — sobrescrita com o
    // total já descontado calculado pelo app.
    expect(planilha.getCell("G44").value).toBe(dados.totais.total);
    expect(dados.totais.total).toBeCloseTo(2012.45);
  });

  it("acha a linha Subtotal automaticamente (o usuário já mudou o tamanho da tabela de itens várias vezes)", async () => {
    const { planilha, dados } = await abrirGerado();
    // Bloco de itens do molde de 30 vai de 11 a 40; o molde traz Subtotal (41) e
    // Desconto (42) nativamente, antes do rodapé (43-45). Não é um número fixo no
    // código — é achado escaneando a coluna A por "Subtotal", então continua
    // funcionando se a tabela de itens mudar de tamanho de novo.
    expect(planilha.getCell("A41").value).toBe("Subtotal");
    expect(planilha.getCell("H41").value).toBeCloseTo(dados.totais.subtotal);
    expect(planilha.getCell("A42").value).toBe(dados.descontoRotulo);
    expect(planilha.getCell("H42").value).toBeCloseTo(-dados.totais.desconto);
  });

  it("mostra Subtotal e Desconto (R$ 0,00) mesmo sem desconto aplicado", async () => {
    const pedidoSemDesconto: Pedido = { ...pedido, descontoTipo: "valor", descontoValor: 0 };
    const dados = montarDadosExportacao(pedidoSemDesconto, cliente);
    const { blob } = await gerarExcel(dados);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;

    expect(planilha.getCell("A41").value).toBe("Subtotal");
    expect(planilha.getCell("A42").value).toBe("Desconto");
    expect(planilha.getCell("H42").value).toBe(0);
  });

  it("mostra o motivo do desconto como nota na célula do valor, sem usar uma 3ª linha", async () => {
    const pedidoComMotivo: Pedido = { ...pedido, descontoDescricao: "Autorizado pelo gerente" };
    const dados = montarDadosExportacao(pedidoComMotivo, cliente);
    const { blob } = await gerarExcel(dados);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;

    expect(planilha.getCell("A41").value).toBe("Subtotal");
    expect(planilha.getCell("A42").value).toBe(dados.descontoRotulo);
    expect(planilha.getCell("H42").note).toContain("Autorizado pelo gerente");
    // O rodapé continua logo em seguida — rótulos na linha 43, valores na 44,
    // nenhuma linha extra inserida.
    expect(planilha.getCell("A43").value).toBe("FORMA DE SOLICITAÇÃO");
    expect(planilha.getCell("A44").value).toBe("WhatsApp");
    expect(planilha.getCell("D44").value).toBe(dados.dataPedido);
  });
});

describe("gerarExcel — escolha entre os moldes de 30 e 70 itens", () => {
  it("com exatamente 30 itens, ainda usa o molde de 30 (limite inclusive)", async () => {
    const dados = montarDadosExportacao(pedidoComItens(30), cliente);
    const { usouModelo, motivoFallback } = await gerarExcel(dados);
    expect(usouModelo).toBe(true);
    expect(motivoFallback).toBeUndefined();

    // fetch mockado: se pediu o arquivo "_70", teria vindo do outro buffer —
    // confirmamos indiretamente checando a capacidade real (30 no molde de 30).
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("modelo_pedido_30.xlsx"), expect.anything());
  });

  it("com 31 itens, passa a usar o molde de 70", async () => {
    const dados = montarDadosExportacao(pedidoComItens(31), cliente);
    const { blob, usouModelo, motivoFallback } = await gerarExcel(dados);
    expect(usouModelo).toBe(true);
    expect(motivoFallback).toBeUndefined();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("modelo_pedido_70.xlsx"), expect.anything());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;
    // Subtotal do molde de 70 fica na linha 81 (itens de 11 a 80).
    expect(planilha.getCell("A81").value).toBe("Subtotal");
    expect(planilha.getCell("D41").value).toBe("Produto 31");
  });

  it("com mais itens do que a capacidade do maior molde (70), usa o gerador alternativo em vez de arriscar duplicar linha", async () => {
    // Duplicar linha esbarra numa limitação do ExcelJS: não realoca as mesclagens
    // já existentes abaixo do ponto de inserção (rodapé, Subtotal/Desconto e o
    // bloco de revisão do molde ficam "presos" no lugar antigo) — e isso nem
    // sempre lança exceção, às vezes só redireciona a escrita em silêncio. Por
    // isso gerarExcel evita esse caminho por completo quando excede a capacidade
    // detectada (hoje 70 produtos: linhas 11 a 80 no molde de 70), em vez de
    // tentar e torcer para que dê uma exceção limpa.
    const dados = montarDadosExportacao(pedidoComItens(75), cliente);

    const { blob, usouModelo, motivoFallback } = await gerarExcel(dados);
    expect(usouModelo).toBe(false);
    expect(motivoFallback).toBe("capacidade");
    expect(blob.size).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.worksheets[0];
    expect(planilha.name).toBe("Pedido"); // construirDoZero também nomeia a aba "Pedido"
    expect(planilha.getCell("D10").value).toBe("Produto 1");
  });

  it("modeloDisponivel() reflete o molde que seria usado para a quantidade de itens informada", async () => {
    expect(await modeloDisponivel(10)).toBe(true);
    expect(await modeloDisponivel(50)).toBe(true);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("modelo_pedido_70.xlsx"),
      expect.anything(),
    );
  });
});
