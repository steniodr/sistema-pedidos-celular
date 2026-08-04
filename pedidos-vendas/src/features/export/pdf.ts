import type { jsPDF } from "jspdf";
import { formatarMoeda } from "../../domain/calculos";
import type { DadosExportacao } from "./dadosExportacao";

/**
 * Versão legível do pedido para enviar ao cliente por WhatsApp/e-mail
 * (especificação 8.2). Layout próprio, sem imitar a planilha.
 */

const MARGEM = 14;
const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const LIMITE_RODAPE = ALTURA_A4 - 20;

// Cores da marca (ver Tela Inicial), usadas no bloco de dados do cliente, no
// bloco de totais e na listra zebrada da tabela de itens.
const AZUL_MARCA: [number, number, number] = [28, 115, 183]; // #1c73b7
const FUNDO_ROTULO: [number, number, number] = [227, 237, 246];
const FUNDO_ZEBRA: [number, number, number] = [240, 246, 251];
const BORDA_GRADE: [number, number, number] = [201, 214, 226];

interface Coluna {
  titulo: string;
  x: number;
  largura: number;
  alinhamento?: "left" | "right";
}

/**
 * Quebra o texto pra caber em `largura` (mm), no máximo `maxLinhas` linhas — se
 * ainda sobrar depois disso, corta e acrescenta "..." (sem estourar a largura),
 * pra nunca vazar por cima da coluna vizinha.
 */
export function celulaLimitada(doc: jsPDF, texto: string, largura: number, maxLinhas = 2): string[] {
  if (!texto) return [""];
  const linhas = doc.splitTextToSize(texto, largura) as string[];
  if (linhas.length <= maxLinhas) return linhas;

  let ultima = linhas[maxLinhas - 1];
  while (ultima.length > 0 && doc.getTextWidth(`${ultima}...`) > largura) {
    ultima = ultima.slice(0, -1);
  }
  return [...linhas.slice(0, maxLinhas - 1), `${ultima.trimEnd()}...`];
}

const COLUNAS: Coluna[] = [
  { titulo: "#", x: MARGEM, largura: 7 },
  { titulo: "Qtd", x: MARGEM + 7, largura: 10, alinhamento: "right" },
  { titulo: "Embalagem", x: MARGEM + 19, largura: 20 },
  { titulo: "Produto", x: MARGEM + 41, largura: 44 },
  { titulo: "Cor", x: MARGEM + 87, largura: 16 },
  { titulo: "Padrão/Compl.", x: MARGEM + 105, largura: 20 },
  { titulo: "Vl. Unit", x: MARGEM + 127, largura: 20, alinhamento: "right" },
  { titulo: "Total", x: MARGEM + 149, largura: 22, alinhamento: "right" },
];

export async function gerarPdf(dados: DadosExportacao): Promise<Blob> {
  // jsPDF só é usado na exportação: carrega sob demanda.
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  let y = MARGEM;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(dados.marca || "Pedido", MARGEM, y);
  doc.text(`Pedido nº ${dados.numero}`, LARGURA_A4 - MARGEM, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Data: ${dados.dataPedido}`, LARGURA_A4 - MARGEM, y, { align: "right" });
  doc.setTextColor(0);
  y += 7;

  y = blocoCliente(doc, y, [
    ["Nome", dados.cliente.nome],
    ["Código", dados.cliente.codigoCliente],
    ["CPF / CNPJ", dados.cliente.cpfCnpj],
    ["Telefone", dados.cliente.telefone],
    ["Endereço", [dados.cliente.endereco, dados.cliente.bairro].filter(Boolean).join(", ")],
    ["Cidade / UF", [dados.cliente.cidadeEstado, dados.cliente.cep].filter(Boolean).join(" · ")],
    ["Transportadora", dados.cliente.transportadora],
    ["Pagamento", dados.cliente.condicaoPagamento],
    ["Local da entrega", dados.cliente.obsGerais],
  ]);

  y += 6;
  y = cabecalhoTabela(doc, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const larguraObservacao = LARGURA_A4 - MARGEM - COLUNAS[3].x - 2;

  dados.itens.forEach((item, indice) => {
    const valoresColunas = [
      String(item.item),
      String(item.qtd),
      item.embalagem,
      item.descricaoProduto,
      item.cor,
      item.padraoComplemento,
      formatarMoeda(item.valorUnit),
      formatarMoeda(item.total),
    ];
    // Cada coluna quebra dentro da própria largura (no máximo 2 linhas, com
    // "..." se ainda sobrar) — nenhum campo vaza por cima do vizinho.
    const celulas = COLUNAS.map((coluna, i) => celulaLimitada(doc, valoresColunas[i], coluna.largura));
    const linhasPorColuna = Math.max(1, ...celulas.map((c) => c.length));

    const observacao = item.descricao
      ? (doc.splitTextToSize(item.descricao, larguraObservacao) as string[])
      : [];
    const alturaConteudo =
      linhasPorColuna * 4 + (observacao.length ? 1.5 + observacao.length * 3.5 : 0);
    const alturaLinha = alturaConteudo + 6;

    if (y + alturaLinha > LIMITE_RODAPE) {
      doc.addPage();
      y = MARGEM;
      y = cabecalhoTabela(doc, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    // Divisão branco / azul bem claro entre as linhas de item, alternada.
    if (indice % 2 === 1) {
      doc.setFillColor(...FUNDO_ZEBRA);
      doc.rect(MARGEM, y - 3, LARGURA_A4 - 2 * MARGEM, alturaConteudo + 3, "F");
    }

    COLUNAS.forEach((coluna, i) => {
      const x = coluna.alinhamento === "right" ? coluna.x + coluna.largura : coluna.x;
      doc.text(celulas[i], x, y, {
        align: coluna.alinhamento ?? "left",
      });
    });

    y += linhasPorColuna * 4;

    if (observacao.length) {
      y += 1.5;
      doc.setTextColor(110);
      doc.setFontSize(8);
      doc.text(observacao, COLUNAS[3].x, y);
      y += observacao.length * 3.5;
      doc.setFontSize(9);
      doc.setTextColor(0);
    }

    y += 3;
    doc.setDrawColor(...BORDA_GRADE);
    doc.line(MARGEM, y, LARGURA_A4 - MARGEM, y);
    y += 3.5;
  });

  // Totais
  y += 2;
  if (y + 40 > LIMITE_RODAPE) {
    doc.addPage();
    y = MARGEM;
  }
  y = blocoTotais(doc, y, dados);

  // Rodapé
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const rodape = [
    dados.formaSolicitacao ? `Forma de solicitação: ${dados.formaSolicitacao}` : "",
    dados.representante.nome
      ? `Representante: ${[dados.representante.nome, dados.representante.telefone]
          .filter(Boolean)
          .join(" · ")}`
      : "",
    dados.representante.email,
  ].filter(Boolean);
  doc.text(rodape, MARGEM, y);
  doc.setTextColor(0);

  return doc.output("blob");
}

function cabecalhoTabela(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  COLUNAS.forEach((coluna) => {
    const x = coluna.alinhamento === "right" ? coluna.x + coluna.largura : coluna.x;
    doc.text(coluna.titulo, x, y, { align: coluna.alinhamento ?? "left" });
  });
  doc.setDrawColor(120);
  doc.line(MARGEM, y + 1.5, LARGURA_A4 - MARGEM, y + 1.5);
  return y + 6;
}

/**
 * Subtotal / Desconto / Valor do pedido, no mesmo estilo de grade do bloco
 * "Dados do cliente" (cabeçalho azul, rótulo com fundo claro, bordas).
 */
function blocoTotais(doc: jsPDF, y: number, dados: DadosExportacao): number {
  const larguraTotal = LARGURA_A4 - 2 * MARGEM;

  doc.setFillColor(...AZUL_MARCA);
  doc.rect(MARGEM, y, larguraTotal, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMO DO PEDIDO", MARGEM + 3, y + 5);
  y += 7;
  doc.setTextColor(0, 0, 0);

  const rotuloWidth = 60;
  const valorWidth = larguraTotal - rotuloWidth;

  const linha = (rotulo: string, valor: string, destaque = false) => {
    const altura = destaque ? 9 : 7;
    doc.setFillColor(...FUNDO_ROTULO);
    doc.rect(MARGEM, y, rotuloWidth, altura, "F");
    doc.setDrawColor(...BORDA_GRADE);
    doc.rect(MARGEM, y, rotuloWidth, altura);
    doc.rect(MARGEM + rotuloWidth, y, valorWidth, altura);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(destaque ? 11 : 9.5);
    doc.text(rotulo, MARGEM + 2, y + altura / 2 + 1.3);
    doc.setFont("helvetica", destaque ? "bold" : "normal");
    doc.text(valor, LARGURA_A4 - MARGEM - 2, y + altura / 2 + 1.3, { align: "right" });
    y += altura;
  };

  linha("Subtotal", formatarMoeda(dados.totais.subtotal));

  if (dados.totais.desconto > 0) {
    linha(dados.descontoRotulo, `- ${formatarMoeda(dados.totais.desconto)}`);

    if (dados.descontoDescricao) {
      const motivo = doc.splitTextToSize(
        `Motivo: ${dados.descontoDescricao}`,
        larguraTotal - 4,
      ) as string[];
      const alturaMotivo = motivo.length * 3.6 + 2.5;
      doc.setDrawColor(...BORDA_GRADE);
      doc.rect(MARGEM, y, larguraTotal, alturaMotivo);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(motivo, MARGEM + 2, y + 3.4);
      doc.setTextColor(0);
      y += alturaMotivo;
    }
  }

  linha("VALOR DO PEDIDO", formatarMoeda(dados.totais.total), true);

  return y;
}

/**
 * Grade com bordas para os dados do cliente, nas cores da marca (cabeçalho azul,
 * rótulos com fundo claro). jsPDF não tem tabela nativa — cada célula é desenhada
 * na mão (retângulo + texto), igual à tabela de itens abaixo.
 */
function blocoCliente(doc: jsPDF, y: number, campos: [string, string][]): number {
  const larguraTotal = LARGURA_A4 - 2 * MARGEM;

  doc.setFillColor(...AZUL_MARCA);
  doc.rect(MARGEM, y, larguraTotal, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO CLIENTE", MARGEM + 3, y + 5);
  y += 7;
  doc.setTextColor(0, 0, 0);

  const preenchidos = campos.filter(([, valor]) => valor.trim().length > 0);
  const linhas: [string, string][][] = [];
  for (let i = 0; i < preenchidos.length; i += 2) {
    linhas.push(preenchidos.slice(i, i + 2));
  }

  const colWidth = larguraTotal / 2;
  const rotuloWidth = 26;
  const valorWidth = colWidth - rotuloWidth;

  doc.setFontSize(8.5);

  linhas.forEach((linha) => {
    const linhasPorCelula = linha.map(
      ([, valor]) => doc.splitTextToSize(valor, valorWidth - 4) as string[],
    );
    const maxLinhas = Math.max(1, ...linhasPorCelula.map((l) => l.length));
    const alturaLinha = 3 + maxLinhas * 3.4;

    linha.forEach(([rotulo], col) => {
      const x = MARGEM + col * colWidth;

      doc.setFillColor(...FUNDO_ROTULO);
      doc.rect(x, y, rotuloWidth, alturaLinha, "F");
      doc.setDrawColor(...BORDA_GRADE);
      doc.rect(x, y, rotuloWidth, alturaLinha);
      doc.rect(x + rotuloWidth, y, valorWidth, alturaLinha);

      doc.setFont("helvetica", "bold");
      doc.text(rotulo, x + 2, y + 4.2);
      doc.setFont("helvetica", "normal");
      doc.text(linhasPorCelula[col], x + rotuloWidth + 2, y + 4.2);
    });

    y += alturaLinha;
  });

  return y;
}
