import type { Borders, Workbook, Worksheet } from "exceljs";
import type { DadosExportacao } from "./dadosExportacao";
import { MAPA_PADRAO, type MapaModelo } from "./mapaCelulas";

/**
 * Dois moldes oficiais, um por faixa de tamanho do pedido — o Excel real não usa
 * duplicação de linha (ver comentário grande abaixo), então cada faixa precisa do
 * próprio arquivo com a quantidade de linhas de item já pronta.
 */
const LIMITE_ITENS_MODELO_30 = 30;
const CAMINHO_MODELO_30 = "/templates/modelo_pedido_30.xlsx";
const CAMINHO_MODELO_70 = "/templates/modelo_pedido_70.xlsx";
const FORMATO_MOEDA = '"R$" #,##0.00';

/** Pedido com até 30 itens usa o molde de 30 linhas; acima disso, o de 70. */
function caminhoModeloPara(quantidadeItens: number): string {
  return quantidadeItens <= LIMITE_ITENS_MODELO_30 ? CAMINHO_MODELO_30 : CAMINHO_MODELO_70;
}

/** Pedido tem mais itens do que o molde oficial comporta — força o gerador alternativo. */
export class CapacidadeExcedidaError extends Error {}

export interface ResultadoExcel {
  blob: Blob;
  /** `false` quando caiu no gerador alternativo. */
  usouModelo: boolean;
  /**
   * Motivo da queda pro gerador alternativo, só quando `usouModelo` é `false`:
   * - "indisponivel": o molde não pôde ser buscado (sem internet e sem cache local).
   * - "capacidade": o pedido tem mais itens do que o molde comporta.
   * - "erro": o molde foi carregado normalmente, mas algo deu errado ao preenchê-lo
   *   (ex.: estrutura do arquivo mudou) — ver console para o erro completo.
   */
  motivoFallback?: "indisponivel" | "capacidade" | "erro";
}

/**
 * Gera o .xlsx do pedido.
 *
 * Caminho principal: carrega o modelo oficial (precacheado pelo service worker,
 * portanto disponível offline) e preenche as células definidas em mapaCelulas.ts,
 * preservando toda a formatação original. Existem dois arquivos de molde —
 * `modelo_pedido_30.xlsx` (até 30 itens) e `modelo_pedido_70.xlsx` (31 a 70 itens) —
 * porque o Excel real não duplica linha (ver comentário abaixo), então cada faixa de
 * tamanho precisa do próprio arquivo já com a quantidade de linhas de item pronta.
 * `caminhoModeloPara` escolhe qual dos dois usar a partir do número de itens do pedido.
 *
 * Enquanto o modelo oficial não estiver no projeto, cai no gerador próprio, que monta
 * uma planilha equivalente do zero — mesmo cabeçalho, mesmas colunas e mesmo rodapé.
 *
 * Dentro de cada arquivo, o bloco de itens não tem tamanho fixo no código —
 * `preencherModelo` localiza a linha "Subtotal" de verdade dentro do arquivo (ver
 * mapaCelulas.ts) e calcula a capacidade a partir daí, então o app se adapta sozinho
 * quando um dos moldes muda de tamanho. Se o pedido tiver mais produtos do que essa
 * capacidade (ex.: mais de 70 itens, além do que o maior molde comporta), cai no
 * gerador próprio em vez de tentar duplicar linha: o ExcelJS não realoca as
 * mesclagens já existentes abaixo do ponto de inserção (rodapé, Subtotal/Desconto e
 * o bloco de revisão do molde ficariam "presos" no lugar antigo), e isso nem sempre
 * lança exceção — às vezes só redireciona a escrita pra célula errada em silêncio.
 * Por isso `preencherModelo` verifica a capacidade e lança ANTES de escrever
 * qualquer coisa, para o fallback abaixo sempre partir de um estado limpo.
 */
export async function gerarExcel(
  dados: DadosExportacao,
  mapa: MapaModelo = MAPA_PADRAO,
): Promise<ResultadoExcel> {
  // ExcelJS é pesado e só é usado na exportação: carrega sob demanda.
  const { default: ExcelJS } = await import("exceljs");
  const modelo = await carregarModelo(caminhoModeloPara(dados.itens.length));

  let workbook: Workbook;
  let usouModelo = false;
  let motivoFallback: ResultadoExcel["motivoFallback"];
  if (modelo) {
    try {
      workbook = await preencherModelo(new ExcelJS.Workbook(), modelo, dados, mapa);
      usouModelo = true;
    } catch (e) {
      console.error("Falha ao preencher o modelo oficial; usando gerador alternativo.", e);
      workbook = construirDoZero(new ExcelJS.Workbook(), dados);
      motivoFallback = e instanceof CapacidadeExcedidaError ? "capacidade" : "erro";
    }
  } else {
    workbook = construirDoZero(new ExcelJS.Workbook(), dados);
    motivoFallback = "indisponivel";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, usouModelo, motivoFallback };
}

/**
 * `true` quando o modelo oficial que seria usado para `quantidadeItens` está
 * presente; a tela usa isso para avisar o vendedor. Sem argumento, checa o molde
 * de 30 (o caso mais comum) — usado no aquecimento de cache em `main.tsx`, antes
 * de saber o tamanho de nenhum pedido específico.
 */
export async function modeloDisponivel(quantidadeItens = 0): Promise<boolean> {
  return (await carregarModelo(caminhoModeloPara(quantidadeItens))) !== null;
}

/**
 * Aquece o cache dos DOIS moldes assim que o app abre (ver `main.tsx`), já que
 * ainda não se sabe o tamanho do pedido que o vendedor vai exportar depois.
 */
export async function aquecerCacheModelos(): Promise<void> {
  await Promise.all([carregarModelo(CAMINHO_MODELO_30), carregarModelo(CAMINHO_MODELO_70)]);
}

async function carregarModelo(caminho: string): Promise<ArrayBuffer | null> {
  try {
    // Sem cache do navegador: o arquivo é editado com frequência durante os
    // testes, e o cache HTTP padrão poderia continuar servindo uma versão antiga
    // mesmo depois de trocar o arquivo (além do ajuste equivalente no service
    // worker, em vite.config.ts).
    const resposta = await fetch(caminho, { cache: "no-store" });
    if (!resposta.ok) return null;
    const buffer = await resposta.arrayBuffer();
    // Um 404 servido como index.html chega aqui como HTML; .xlsx começa com "PK".
    const assinatura = new Uint8Array(buffer.slice(0, 2));
    if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) return null;
    return buffer;
  } catch {
    return null;
  }
}

async function preencherModelo(
  workbook: Workbook,
  modelo: ArrayBuffer,
  dados: DadosExportacao,
  mapa: MapaModelo,
): Promise<Workbook> {
  await workbook.xlsx.load(modelo);

  const planilha = mapa.aba ? workbook.getWorksheet(mapa.aba) : workbook.worksheets[0];
  if (!planilha) throw new Error("A aba do modelo de pedido não foi encontrada.");

  const { primeiraLinha, colunas } = mapa.itens;
  const linhaSubtotal = localizarLinhaSubtotal(planilha, mapa);
  const linhaDesconto = linhaSubtotal + 1;
  const capacidadeProdutos = linhaSubtotal - primeiraLinha;

  // Mais produtos do que a capacidade: não tenta duplicar linha (ver comentário em
  // gerarExcel) — melhor lançar cedo, antes de escrever qualquer coisa, e deixar o
  // chamador cair no gerador alternativo com o arquivo intacto.
  if (dados.itens.length > capacidadeProdutos) {
    throw new CapacidadeExcedidaError(
      `O pedido tem ${dados.itens.length} itens; o molde só comporta ${capacidadeProdutos}.`,
    );
  }

  for (const [celula, resolver] of Object.entries(mapa.cabecalho)) {
    planilha.getCell(celula).value = resolver(dados);
  }

  dados.itens.forEach((item, indice) => {
    const linha = primeiraLinha + indice;
    planilha.getCell(`${colunas.item}${linha}`).value = item.item;
    planilha.getCell(`${colunas.qtd}${linha}`).value = item.qtd;
    planilha.getCell(`${colunas.embalagem}${linha}`).value = item.embalagem;
    planilha.getCell(`${colunas.descricaoProduto}${linha}`).value = item.descricaoProduto;
    planilha.getCell(`${colunas.cor}${linha}`).value = item.cor;
    planilha.getCell(`${colunas.padraoComplemento}${linha}`).value = item.padraoComplemento;
    planilha.getCell(`${colunas.valorUnit}${linha}`).value = item.valorUnit;

    // Valor fixo, não fórmula. O molde real usa fórmula COMPARTILHADA na coluna
    // de total (uma só definição "espalhada" pelas linhas seguintes pelo próprio
    // Excel) — ler ou preservar essa fórmula por célula deixa o ExcelJS instável
    // ao serializar de volta (a célula "mestre" da fórmula compartilhada, ao ser
    // sobrescrita com valor fixo numa linha, orfanа as cópias dela nas linhas
    // vizinhas — erro real observado: "Shared Formula master must exist above
    // and or left of clone"). Gravar sempre valor fixo evita essa classe de bug
    // por completo; o total exportado continua correto, só deixa de ser uma
    // fórmula "viva" e editável dentro do Excel.
    planilha.getCell(`${colunas.total}${linha}`).value = item.total;
  });

  // Linhas de produto sobrando no modelo (entre o último item e o Subtotal) ficam
  // em branco — em TODAS as colunas, mesmo as que tinham fórmula no molde (ver
  // comentário acima sobre fórmula compartilhada: tentar preservar seletivamente
  // é o que corrompe o arquivo).
  for (let linha = primeiraLinha + dados.itens.length; linha < linhaSubtotal; linha++) {
    for (const coluna of Object.values(colunas)) {
      planilha.getCell(`${coluna}${linha}`).value = null;
    }
  }

  escreverTotalizadores(planilha, dados, mapa.totalizadores, linhaSubtotal, linhaDesconto);

  for (const campo of mapa.rodape) {
    const linha = linhaDesconto + campo.deltaLinha;
    planilha.getCell(`${campo.coluna}${linha}`).value = campo.resolver(dados);
  }

  return workbook;
}

/**
 * Acha a linha "Subtotal" nativa do molde, procurando na coluna A a partir da
 * primeira linha de item. É assim que o app se adapta sozinho quando o usuário
 * aumenta/diminui a tabela de itens no arquivo, sem precisar mexer no código.
 */
function localizarLinhaSubtotal(planilha: Worksheet, mapa: MapaModelo): number {
  const alvo = mapa.textoSubtotal.trim().toLowerCase();
  const limite = mapa.itens.primeiraLinha + 300; // limite de segurança contra loop infinito
  for (let linha = mapa.itens.primeiraLinha; linha < limite; linha++) {
    const valor = planilha.getCell(`${mapa.totalizadores.colunaLabelInicio}${linha}`).value;
    if (typeof valor === "string" && valor.trim().toLowerCase() === alvo) {
      return linha;
    }
  }
  // Não achou "Subtotal" no arquivo — usa a posição de referência como último recurso.
  return mapa.itens.ultimaLinhaFallback + 1;
}

/**
 * Subtotal e Desconto, sempre nas 2 últimas linhas do bloco de itens — logo antes
 * do rodapé com "VALOR DO PEDIDO" (ver comentário em mapaCelulas.ts). Aparecem
 * sempre, mesmo sem desconto (mostra R$ 0,00); o motivo do desconto, quando
 * preenchido, vira uma nota (comentário) na célula do valor, para não precisar de
 * uma 3ª linha.
 */
function escreverTotalizadores(
  planilha: Worksheet,
  dados: DadosExportacao,
  config: MapaModelo["totalizadores"],
  linhaSubtotal: number,
  linhaDesconto: number,
): void {
  const escreverLinha = (linha: number, rotulo: string, valor: number) => {
    const celulaRotulo = planilha.getCell(`${config.colunaLabelInicio}${linha}`);
    if (config.colunaLabelInicio !== config.colunaLabelFim) {
      mesclarSePreciso(planilha, `${config.colunaLabelInicio}${linha}:${config.colunaLabelFim}${linha}`);
    }
    celulaRotulo.value = rotulo;
    celulaRotulo.font = { bold: true };
    celulaRotulo.alignment = { horizontal: "right", vertical: "middle" };

    const celulaValor = planilha.getCell(`${config.colunaValorInicio}${linha}`);
    if (config.colunaValorInicio !== config.colunaValorFim) {
      mesclarSePreciso(planilha, `${config.colunaValorInicio}${linha}:${config.colunaValorFim}${linha}`);
    }
    celulaValor.value = valor;
    celulaValor.numFmt = FORMATO_MOEDA;
    celulaValor.font = { bold: true };
    celulaValor.alignment = { horizontal: "right", vertical: "middle" };
    return celulaValor;
  };

  escreverLinha(linhaSubtotal, "Subtotal", dados.totais.subtotal);
  const celulaDesconto = escreverLinha(linhaDesconto, dados.descontoRotulo, -dados.totais.desconto);

  if (dados.descontoDescricao) {
    celulaDesconto.note = `Motivo do desconto: ${dados.descontoDescricao}`;
  }
}

/**
 * Mescla o intervalo se ainda não estiver mesclado. O molde já traz Subtotal/
 * Desconto pré-mesclados de fábrica; chamar `mergeCells` de novo ali lançaria
 * "Cannot merge already merged cells" no ExcelJS.
 */
function mesclarSePreciso(planilha: Worksheet, intervalo: string): void {
  try {
    planilha.mergeCells(intervalo);
  } catch {
    // já mesclado no molde — só grava na célula mestre.
  }
}

/**
 * Layout modelado sobre o molde ARARA AZUL: cabeçalho MARCA/Pedido n°, grade de
 * dados do cliente, tabela de itens com cabeçalho cinza, e rodapé de 4 colunas
 * (Forma de solicitação / Data / Representante / Valor do pedido).
 *
 * Não replica as linhas "REVISÃO (DATA)" e "Versão ..." do rodapé do molde original
 * — são anotações internas do template administrativo, não dado do pedido.
 */

const CABECALHO_ITENS = [
  "Item",
  "Qtd",
  "Embalagem",
  "Descrição do produto",
  "Cor",
  "Padrão / Complemento",
  "Valor Unit",
  "Total",
];

const LARGURAS = [6, 7, 16, 32, 14, 20, 12, 14];
const CINZA_ROTULO = "FFD9D9D9";
const CINZA_CABECALHO = "FFBFBFBF";

function construirDoZero(workbook: Workbook, dados: DadosExportacao): Workbook {
  workbook.creator = "App de Pedidos";
  const planilha = workbook.addWorksheet("Pedido");

  LARGURAS.forEach((largura, i) => {
    planilha.getColumn(i + 1).width = largura;
  });

  const par = (
    linha: number,
    rotuloEsq: string,
    valorEsq: string | number,
    rotuloDir?: string,
    valorDir?: string | number,
  ) => {
    planilha.getRow(linha).height = 16;
    escreverRotulo(planilha, `A${linha}`, rotuloEsq);
    planilha.mergeCells(`B${linha}:D${linha}`);
    escreverValorComBorda(planilha, `B${linha}`, valorEsq);
    if (rotuloDir !== undefined) {
      escreverRotulo(planilha, `E${linha}`, rotuloDir);
      planilha.mergeCells(`F${linha}:H${linha}`);
      escreverValorComBorda(planilha, `F${linha}`, valorDir ?? "");
    } else {
      planilha.mergeCells(`E${linha}:H${linha}`);
      escreverValorComBorda(planilha, `E${linha}`, "");
    }
  };

  // Cabeçalho: MARCA / Pedido n°
  planilha.getRow(1).height = 22;
  escreverRotulo(planilha, "A1", "MARCA");
  planilha.mergeCells("B1:D1");
  escreverValorComBorda(planilha, "B1", dados.marca);
  planilha.getCell("B1").font = { bold: true, size: 14 };
  escreverRotulo(planilha, "E1", "Pedido n°");
  planilha.mergeCells("F1:H1");
  escreverValorComBorda(planilha, "F1", dados.numero);
  planilha.getCell("F1").font = { bold: true, size: 14 };

  // Grade de dados do cliente
  par(2, "Nome", dados.cliente.nome, "Código do cliente", dados.cliente.codigoCliente);
  par(3, "CPF / CNPJ", dados.cliente.cpfCnpj, "Telefone", dados.cliente.telefone);
  par(4, "Endereço", dados.cliente.endereco, "Bairro", dados.cliente.bairro);
  par(5, "Cidade / Estado", dados.cliente.cidadeEstado, "CEP", dados.cliente.cep);
  par(
    6,
    "Transportadora",
    dados.cliente.transportadora,
    "Condição de pagamento",
    dados.cliente.condicaoPagamento,
  );
  par(7, "Local da Entrega", dados.cliente.obsGerais);

  // Tabela de itens
  const linhaCabecalho = 9;
  planilha.getRow(linhaCabecalho).height = 26;
  CABECALHO_ITENS.forEach((titulo, i) => {
    const celula = planilha.getCell(linhaCabecalho, i + 1);
    celula.value = titulo;
    celula.font = { bold: true };
    celula.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CABECALHO } };
    celula.border = bordaFina();
  });

  const primeiraLinhaItem = linhaCabecalho + 1;
  dados.itens.forEach((item, indice) => {
    const linha = primeiraLinhaItem + indice;
    const valores: (string | number)[] = [
      item.item,
      item.qtd,
      item.embalagem,
      item.descricaoProduto,
      item.cor,
      item.padraoComplemento,
      item.valorUnit,
    ];
    valores.forEach((valor, coluna) => {
      const celula = planilha.getCell(linha, coluna + 1);
      celula.value = valor;
      celula.border = bordaFina();
      celula.alignment = { vertical: "middle" };
    });
    // Total como fórmula, para o cliente conferir a conta na própria planilha.
    const total = planilha.getCell(linha, 8);
    total.value = { formula: `B${linha}*G${linha}`, result: item.total };
    total.border = bordaFina();
    total.alignment = { vertical: "middle" };
    planilha.getCell(linha, 7).numFmt = FORMATO_MOEDA;
    total.numFmt = FORMATO_MOEDA;

    if (item.descricao) {
      planilha.getCell(linha, 4).note = item.descricao;
    }
  });

  const ultimaLinhaItem = primeiraLinhaItem + Math.max(dados.itens.length, 1) - 1;
  let linha = ultimaLinhaItem + 2;

  // Subtotal / desconto — discretos, acima do rodapé com o total em destaque.
  const totalizador = (rotulo: string, valor: number, negrito = false) => {
    escreverRotulo(planilha, `F${linha}`, rotulo);
    const celula = planilha.getCell(`G${linha}`);
    planilha.mergeCells(`G${linha}:H${linha}`);
    celula.value = valor;
    celula.numFmt = FORMATO_MOEDA;
    celula.font = { bold: negrito, size: negrito ? 12 : 10 };
    celula.alignment = { horizontal: "right" };
    linha += 1;
  };

  totalizador("Subtotal", dados.totais.subtotal);
  if (dados.totais.desconto > 0) {
    totalizador(dados.descontoRotulo, -dados.totais.desconto);
    if (dados.descontoDescricao) {
      planilha.mergeCells(`A${linha}:H${linha}`);
      const nota = planilha.getCell(`A${linha}`);
      nota.value = `Motivo do desconto: ${dados.descontoDescricao}`;
      nota.font = { italic: true, size: 9, color: { argb: "FF666666" } };
      linha += 1;
    }
  }

  linha += 1;

  // Rodapé: Forma de solicitação / Data / Representante / Valor do pedido
  const linhaRotuloRodape = linha;
  const linhaValorRodape = linha + 1;
  planilha.getRow(linhaValorRodape).height = 28;

  const celulaRodapeRotulo = (intervalo: string, texto: string) => {
    planilha.mergeCells(intervalo);
    const celula = planilha.getCell(intervalo.split(":")[0]);
    celula.value = texto;
    celula.font = { bold: true, size: 9 };
    celula.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_ROTULO } };
    aplicarBordaIntervalo(planilha, intervalo);
  };
  const celulaRodapeValor = (intervalo: string, texto: string, negrito = false) => {
    planilha.mergeCells(intervalo);
    const celula = planilha.getCell(intervalo.split(":")[0]);
    celula.value = texto;
    celula.font = { bold: negrito, size: negrito ? 13 : 10 };
    celula.alignment = { horizontal: negrito ? "right" : "left", vertical: "middle", wrapText: true };
    aplicarBordaIntervalo(planilha, intervalo);
  };

  celulaRodapeRotulo(`A${linhaRotuloRodape}:B${linhaRotuloRodape}`, "FORMA DE SOLICITAÇÃO");
  celulaRodapeRotulo(`C${linhaRotuloRodape}:C${linhaRotuloRodape}`, "DATA");
  celulaRodapeRotulo(`D${linhaRotuloRodape}:F${linhaRotuloRodape}`, "REPRESENTANTE (NOME E TELEFONE / E-MAIL)");
  celulaRodapeRotulo(`G${linhaRotuloRodape}:H${linhaRotuloRodape}`, "VALOR DO PEDIDO");

  celulaRodapeValor(`A${linhaValorRodape}:B${linhaValorRodape}`, dados.formaSolicitacao);
  celulaRodapeValor(`C${linhaValorRodape}:C${linhaValorRodape}`, dados.dataPedido);
  celulaRodapeValor(
    `D${linhaValorRodape}:F${linhaValorRodape}`,
    [
      [dados.representante.nome, dados.representante.telefone].filter(Boolean).join(" · "),
      dados.representante.email,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const celulaValorPedido = planilha.getCell(`G${linhaValorRodape}`);
  planilha.mergeCells(`G${linhaValorRodape}:H${linhaValorRodape}`);
  celulaValorPedido.value = dados.totais.total;
  celulaValorPedido.numFmt = FORMATO_MOEDA;
  celulaValorPedido.font = { bold: true, size: 13 };
  celulaValorPedido.alignment = { horizontal: "right", vertical: "middle" };
  aplicarBordaIntervalo(planilha, `G${linhaValorRodape}:H${linhaValorRodape}`);

  return workbook;
}

function escreverRotulo(planilha: Worksheet, celula: string, texto: string): void {
  const alvo = planilha.getCell(celula);
  alvo.value = texto;
  alvo.font = { bold: true };
  alvo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_ROTULO } };
  alvo.alignment = { vertical: "middle", wrapText: true };
  alvo.border = bordaFina();
}

function escreverValorComBorda(
  planilha: Worksheet,
  celula: string,
  valor: string | number,
): void {
  const alvo = planilha.getCell(celula);
  alvo.value = valor;
  alvo.alignment = { vertical: "middle", wrapText: true };
  alvo.border = bordaFina();
}

/** Aplica a mesma borda fina em cada célula do intervalo (ex.: "A1:C1"). */
function aplicarBordaIntervalo(planilha: Worksheet, intervalo: string): void {
  const [inicio, fim] = intervalo.split(":");
  const partirRef = (ref: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    return { coluna: colunaParaNumero(m[1]), linha: Number(m[2]) };
  };
  const a = partirRef(inicio);
  const b = partirRef(fim ?? inicio);
  for (let l = a.linha; l <= b.linha; l++) {
    for (let c = a.coluna; c <= b.coluna; c++) {
      planilha.getCell(l, c).border = bordaFina();
    }
  }
}

function colunaParaNumero(letras: string): number {
  let numero = 0;
  for (const c of letras) numero = numero * 26 + (c.charCodeAt(0) - 64);
  return numero;
}

function bordaFina(): Borders {
  const lado = { style: "thin" as const, color: { argb: "FF999999" } };
  return {
    top: lado,
    left: lado,
    bottom: lado,
    right: lado,
    diagonal: { style: undefined },
  } as Borders;
}
