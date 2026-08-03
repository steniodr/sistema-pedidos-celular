import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gerarExcel, modeloDisponivel } from "./excel";
import { montarDadosExportacao } from "./dadosExportacao";
import type { Cliente, Pedido } from "../../domain/types";

/**
 * Testa o caminho real (preencherModelo) contra o arquivo verdadeiro do molde,
 * enviado pelo usuário em public/templates/modelo_pedido.xlsx. `fetch` não serve
 * arquivos locais fora de um servidor, então o mock abaixo lê o arquivo do disco
 * e devolve uma Response equivalente — o mesmo que o navegador faria ao servir o
 * arquivo do precache do service worker.
 */

const CAMINHO_MODELO = path.resolve(
  __dirname,
  "../../../public/templates/modelo_pedido.xlsx",
);

beforeEach(() => {
  const buffer = readFileSync(CAMINHO_MODELO);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(buffer, { status: 200 })),
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

async function abrirGerado() {
  const dados = montarDadosExportacao(pedido, cliente);
  const blob = await gerarExcel(dados);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return { workbook, planilha: workbook.getWorksheet("Pedido")!, dados };
}

describe("gerarExcel — modelo real (aba Pedido)", () => {
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

  it("preenche as linhas de item preservando a fórmula de total, sem os detalhes/variante no nome", async () => {
    const { planilha } = await abrirGerado();
    // Só o nome do produto — "(exceto amarelo, laranja e vermelho)" não aparece.
    expect(planilha.getCell("D11").value).toBe("Esmalte sintético brilhante");
    expect(planilha.getCell("B11").value).toBe(10);
    expect(planilha.getCell("G11").value).toBe(95.64);

    const total = planilha.getCell("H11").value as { formula: string; result: number };
    expect(total.formula).toBe("G11*B11");
    expect(total.result).toBeCloseTo(956.4);

    expect(planilha.getCell("D12").value).toBe("Verniz marítimo");
  });

  it("preenche o rodapé de 4 colunas, com o total já descontado", async () => {
    const { planilha, dados } = await abrirGerado();
    expect(planilha.getCell("A63").value).toBe("WhatsApp");
    expect(planilha.getCell("D63").value).toBe("30/07/2026");
    expect(planilha.getCell("E64").value).toContain("João Vendedor");
    expect(planilha.getCell("E65").value).toBe("joao@exemplo.com");

    // A fórmula original (SUM dos itens, incluindo as próprias linhas de
    // Subtotal/Desconto) não aplica desconto de verdade — sobrescrita com o
    // total já descontado calculado pelo app.
    expect(planilha.getCell("G64").value).toBe(dados.totais.total);
    expect(dados.totais.total).toBeCloseTo(2012.45);
  });

  it("acha a linha Subtotal automaticamente (o usuário já mudou o tamanho da tabela de itens 3x)", async () => {
    const { planilha, dados } = await abrirGerado();
    // Bloco de itens hoje vai de 11 a 60; o molde traz Subtotal (61) e Desconto
    // (62) nativamente, antes do rodapé (63-65). Não é um número fixo no código —
    // é achado escaneando a coluna A por "Subtotal", então continua funcionando
    // se a tabela de itens mudar de tamanho de novo.
    expect(planilha.getCell("A61").value).toBe("Subtotal");
    expect(planilha.getCell("H61").value).toBeCloseTo(dados.totais.subtotal);
    expect(planilha.getCell("A62").value).toBe(dados.descontoRotulo);
    expect(planilha.getCell("H62").value).toBeCloseTo(-dados.totais.desconto);
  });

  it("mostra Subtotal e Desconto (R$ 0,00) mesmo sem desconto aplicado", async () => {
    const pedidoSemDesconto: Pedido = { ...pedido, descontoTipo: "valor", descontoValor: 0 };
    const dados = montarDadosExportacao(pedidoSemDesconto, cliente);
    const blob = await gerarExcel(dados);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;

    expect(planilha.getCell("A61").value).toBe("Subtotal");
    expect(planilha.getCell("A62").value).toBe("Desconto");
    expect(planilha.getCell("H62").value).toBe(0);
  });

  it("mostra o motivo do desconto como nota na célula do valor, sem usar uma 3ª linha", async () => {
    const pedidoComMotivo: Pedido = { ...pedido, descontoDescricao: "Autorizado pelo gerente" };
    const dados = montarDadosExportacao(pedidoComMotivo, cliente);
    const blob = await gerarExcel(dados);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.getWorksheet("Pedido")!;

    expect(planilha.getCell("A61").value).toBe("Subtotal");
    expect(planilha.getCell("A62").value).toBe(dados.descontoRotulo);
    expect(planilha.getCell("H62").note).toContain("Autorizado pelo gerente");
    // O rodapé continua logo em seguida, na linha 63 — nenhuma linha extra inserida
    // (a célula A63 já vem sobrescrita com o valor da forma de solicitação, mesmo
    // padrão de "placeholder sobrescrito" usado nos outros campos do rodapé).
    expect(planilha.getCell("A63").value).toBe("WhatsApp");
    expect(planilha.getCell("D63").value).toBe(dados.dataPedido);
  });

  it("com mais produtos do que a capacidade do molde, usa o gerador alternativo em vez de arriscar duplicar linha no molde real", async () => {
    // Duplicar linha esbarra numa limitação do ExcelJS: não realoca as mesclagens
    // já existentes abaixo do ponto de inserção (rodapé, Subtotal/Desconto e o
    // bloco de revisão do molde ficam "presos" no lugar antigo) — e isso nem
    // sempre lança exceção, às vezes só redireciona a escrita em silêncio. Por
    // isso gerarExcel evita esse caminho por completo quando excede a capacidade
    // detectada (hoje 50 produtos: linhas 11 a 60), em vez de tentar e torcer
    // para que dê uma exceção limpa.
    const muitosItens = Array.from({ length: 55 }, (_, i) => ({
      item: i + 1,
      qtd: 1,
      embalagem: "Galão (3,6 L)",
      descricaoProduto: `Produto ${i + 1}`,
      valorUnit: 10,
    }));
    const pedidoGrande: Pedido = { ...pedido, itens: muitosItens };
    const dados = montarDadosExportacao(pedidoGrande, cliente);

    const blob = await gerarExcel(dados);
    expect(blob.size).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const planilha = workbook.worksheets[0];
    expect(planilha.name).toBe("Pedido"); // construirDoZero também nomeia a aba "Pedido"
    expect(planilha.getCell("D10").value).toBe("Produto 1");
  });
});
