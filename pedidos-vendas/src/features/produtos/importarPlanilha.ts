import { lerNumeroBR } from "../../domain/calculos";
import {
  cabecalhoNormalizado,
  encontrarIndice,
  linhaVazia,
  textoDaCelula,
  type LinhaIgnorada,
} from "../../domain/planilha";
import type { EntradaProduto } from "../../data/repository";

/**
 * Leitura do arquivo de atualização da base de produtos (especificação 7).
 *
 * O molde oficial ("Tabela_Preco_Estruturada.xlsx") é uma MATRIZ: cada linha é um
 * produto (Categoria, Produto, Detalhes) e cada coluna seguinte é uma embalagem
 * (ex.: "Galão 3,6 L", "Lata 18 L"), com o preço na célula — célula vazia significa
 * que aquela combinação não existe. O importador explode cada linha em uma entrada
 * por embalagem preenchida.
 *
 * Também aceita o formato simples de lista (uma linha por produto+embalagem, com
 * colunas fixas de descrição/embalagem/valor), caso um arquivo diferente apareça —
 * o detector escolhe automaticamente qual dos dois formatos o arquivo é.
 */

export type CampoLista = "descricaoProduto" | "embalagem" | "valorUnit";
export type MapeamentoLista = Record<CampoLista, number | null>;

export interface ColunaEmbalagem {
  indice: number;
  /** Cabeçalho da coluna já normalizado para exibição (sem quebra de linha). */
  embalagem: string;
}

export interface ColunasMatriz {
  categoria: number | null;
  produto: number | null;
  detalhes: number | null;
  embalagens: ColunaEmbalagem[];
}

export type FormatoPlanilha = "matriz" | "lista";

export type { LinhaIgnorada };

export interface ResultadoConversao {
  produtos: EntradaProduto[];
  ignorados: LinhaIgnorada[];
}

export interface PlanilhaLida {
  /** Todas as linhas do arquivo, já como texto/número cru. */
  linhas: unknown[][];
  /** Índice da linha identificada como cabeçalho (-1 se nenhuma). */
  linhaCabecalho: number;
  cabecalho: string[];
  formato: FormatoPlanilha;
  mapeamentoLista: MapeamentoLista;
  colunasMatriz: ColunasMatriz;
}

const ALIASES_CATEGORIA = ["categoria", "linha", "grupo", "familia", "segmento"];
const ALIASES_PRODUTO = [
  "produto",
  "descricaoproduto",
  "descricaodoproduto",
  "descricao",
  "nomedoproduto",
  "nome",
  "item",
];
const ALIASES_DETALHES = [
  "detalhes",
  "detalhe",
  "observacao",
  "observacoes",
  "complemento",
  "variacao",
  "especificacao",
  "cor",
];
const ALIASES_EMBALAGEM = ["embalagem", "tamanho", "unidade", "medida", "volume", "envase"];
const ALIASES_VALOR = [
  "valorunit",
  "valorunitario",
  "vlrunit",
  "valor",
  "preco",
  "precounitario",
  "precodevenda",
  "precovenda",
  "precounit",
];

export function detectarMapeamentoLista(cabecalho: string[]): MapeamentoLista {
  const chaves = cabecalhoNormalizado(cabecalho);
  return {
    descricaoProduto: encontrarIndice(chaves, ALIASES_PRODUTO),
    embalagem: encontrarIndice(chaves, ALIASES_EMBALAGEM),
    valorUnit: encontrarIndice(chaves, ALIASES_VALOR),
  };
}

export function detectarColunasMatriz(
  cabecalho: string[],
  fixas: { categoria?: number | null; produto?: number | null; detalhes?: number | null } = {},
): ColunasMatriz {
  const chaves = cabecalhoNormalizado(cabecalho);
  const categoria = fixas.categoria !== undefined ? fixas.categoria : encontrarIndice(chaves, ALIASES_CATEGORIA);
  const produto = fixas.produto !== undefined ? fixas.produto : encontrarIndice(chaves, ALIASES_PRODUTO);
  const detalhes = fixas.detalhes !== undefined ? fixas.detalhes : encontrarIndice(chaves, ALIASES_DETALHES);

  const usados = new Set([categoria, produto, detalhes].filter((i): i is number => i !== null));
  const embalagens: ColunaEmbalagem[] = [];
  cabecalho.forEach((titulo, indice) => {
    if (usados.has(indice)) return;
    const embalagem = textoDaCelula(titulo);
    if (embalagem) embalagens.push({ indice, embalagem });
  });

  return { categoria, produto, detalhes, embalagens };
}

/**
 * Procura a linha de cabeçalho nas primeiras linhas do arquivo e decide se o
 * conteúdo é uma matriz produto × embalagem ou uma lista simples de 3 colunas.
 */
export function analisarLinhas(linhas: unknown[][], limiteBusca = 15): PlanilhaLida {
  for (let i = 0; i < Math.min(linhas.length, limiteBusca); i++) {
    const cabecalho = (linhas[i] ?? []).map(textoDaCelula);
    if (cabecalho.filter(Boolean).length < 2) continue;

    const mapeamentoLista = detectarMapeamentoLista(cabecalho);
    const colunasMatriz = detectarColunasMatriz(cabecalho);

    const listaOk = mapeamentoLista.descricaoProduto !== null && mapeamentoLista.valorUnit !== null;
    const matrizOk = colunasMatriz.produto !== null && colunasMatriz.embalagens.length >= 2;

    // Uma lista de verdade tem poucas colunas (descrição, embalagem, valor[, categoria]).
    // Muitas colunas de preço indicam a matriz produto × embalagem do molde oficial.
    if (listaOk && cabecalho.length <= 5) {
      return { linhas, linhaCabecalho: i, cabecalho, formato: "lista", mapeamentoLista, colunasMatriz };
    }
    if (matrizOk) {
      return { linhas, linhaCabecalho: i, cabecalho, formato: "matriz", mapeamentoLista, colunasMatriz };
    }
    if (listaOk) {
      return { linhas, linhaCabecalho: i, cabecalho, formato: "lista", mapeamentoLista, colunasMatriz };
    }
  }

  const primeira = (linhas[0] ?? []).map(textoDaCelula);
  return {
    linhas,
    linhaCabecalho: -1,
    cabecalho: primeira,
    formato: "lista",
    mapeamentoLista: { descricaoProduto: null, embalagem: null, valorUnit: null },
    colunasMatriz: { categoria: null, produto: null, detalhes: null, embalagens: [] },
  };
}

function converterLista(planilha: PlanilhaLida, mapeamento: MapeamentoLista): ResultadoConversao {
  const produtos: EntradaProduto[] = [];
  const ignorados: LinhaIgnorada[] = [];

  const inicio = planilha.linhaCabecalho + 1;
  const { descricaoProduto, embalagem, valorUnit } = mapeamento;
  if (descricaoProduto === null || valorUnit === null) return { produtos, ignorados };

  for (let i = inicio; i < planilha.linhas.length; i++) {
    const linha = planilha.linhas[i] ?? [];
    const numeroLinha = i + 1; // 1-based, como o usuário vê no Excel
    if (linhaVazia(linha)) continue;

    const nome = textoDaCelula(linha[descricaoProduto]);
    const bruto = linha[valorUnit];
    const valor = lerNumeroBR(bruto as string | number);

    if (!nome) {
      ignorados.push({ linha: numeroLinha, motivo: "Sem descrição do produto" });
      continue;
    }
    if (valor === null) {
      ignorados.push({ linha: numeroLinha, motivo: `Valor inválido (“${textoDaCelula(bruto)}”)` });
      continue;
    }
    if (valor <= 0) {
      ignorados.push({ linha: numeroLinha, motivo: "Valor zerado ou negativo" });
      continue;
    }

    produtos.push({
      nome,
      embalagem: embalagem === null ? "" : textoDaCelula(linha[embalagem]),
      valorUnit: valor,
    });
  }

  return { produtos, ignorados };
}

function converterMatriz(planilha: PlanilhaLida, colunas: ColunasMatriz): ResultadoConversao {
  const produtos: EntradaProduto[] = [];
  const ignorados: LinhaIgnorada[] = [];

  const inicio = planilha.linhaCabecalho + 1;
  if (colunas.produto === null) return { produtos, ignorados };

  for (let i = inicio; i < planilha.linhas.length; i++) {
    const linha = planilha.linhas[i] ?? [];
    const numeroLinha = i + 1;
    if (linhaVazia(linha)) continue;

    const nomeProduto = textoDaCelula(linha[colunas.produto]);
    if (!nomeProduto) {
      ignorados.push({ linha: numeroLinha, motivo: "Sem nome de produto" });
      continue;
    }

    const detalhes = colunas.detalhes !== null ? textoDaCelula(linha[colunas.detalhes]) : "";

    let algumPreco = false;
    for (const coluna of colunas.embalagens) {
      const bruto = linha[coluna.indice];
      const texto = textoDaCelula(bruto);
      if (!texto) continue; // célula vazia = combinação indisponível, não é erro

      const valor = lerNumeroBR(bruto as string | number);
      if (valor === null) {
        ignorados.push({
          linha: numeroLinha,
          motivo: `${coluna.embalagem}: valor inválido (“${texto}”)`,
        });
        continue;
      }
      if (valor <= 0) continue; // zerado, ignora silenciosamente

      produtos.push({
        nome: nomeProduto,
        detalhes: detalhes || undefined,
        embalagem: coluna.embalagem,
        valorUnit: valor,
      });
      algumPreco = true;
    }

    if (!algumPreco) {
      ignorados.push({ linha: numeroLinha, motivo: "Nenhum preço informado nesta linha" });
    }
  }

  return { produtos, ignorados };
}

export function converter(
  planilha: PlanilhaLida,
  mapeamentoOuColunas?: MapeamentoLista | ColunasMatriz,
): ResultadoConversao {
  if (planilha.formato === "matriz") {
    return converterMatriz(planilha, (mapeamentoOuColunas as ColunasMatriz) ?? planilha.colunasMatriz);
  }
  return converterLista(planilha, (mapeamentoOuColunas as MapeamentoLista) ?? planilha.mapeamentoLista);
}
