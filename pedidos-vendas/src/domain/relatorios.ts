import { totaisPedido, valoresLiquidosItens } from "./calculos";
import type { Pedido } from "./types";

/**
 * Agregações puras para a tela de Relatórios — sem I/O, testável como
 * `calculos.ts`. A tela busca os pedidos via Repository e processa tudo
 * aqui, evitando um método de agregação no Repository que teria que ser
 * replicado quando a sincronização com Supabase (Fase 3) existir.
 */

export type Periodo = "semana" | "mes" | "tudo";

export interface IntervaloData {
  inicio: string | null;
  fim: string | null;
}

/** Domingo (00:00) e sábado da semana da data de referência, em `YYYY-MM-DD`. */
function inicioFimSemana(referencia: Date): IntervaloData {
  const diaSemana = referencia.getDay();
  const inicio = new Date(referencia);
  inicio.setDate(referencia.getDate() - diaSemana);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  return { inicio: paraChaveData(inicio), fim: paraChaveData(fim) };
}

function inicioFimMes(referencia: Date): IntervaloData {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  return { inicio: paraChaveData(inicio), fim: paraChaveData(fim) };
}

function paraChaveData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** `dataPedido` já é salvo como `YYYY-MM-DD`, então dá para comparar as strings direto. */
export function intervaloPeriodo(periodo: Periodo, referencia: Date = new Date()): IntervaloData {
  if (periodo === "semana") return inicioFimSemana(referencia);
  if (periodo === "mes") return inicioFimMes(referencia);
  return { inicio: null, fim: null };
}

// ── Navegação de período (tipo + seleção de um ou mais períodos concretos) ──

/** Só "semana" e "mes" navegam períodos concretos; "tudo" não tem chave. */
export type TipoPeriodo = Exclude<Periodo, "tudo">;

export interface PeriodoOpcao {
  /** `YYYY-MM` (mês) ou `YYYY-MM-DD` do domingo (semana) — ordenável como string. */
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
}

const TETO_PERIODOS: Record<TipoPeriodo, number> = { mes: 24, semana: 12 };
const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function domingoDaSemana(referencia: Date): Date {
  const d = new Date(referencia);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Chave do período (mês/semana) que contém a data de referência. */
export function chavePeriodo(tipo: TipoPeriodo, referencia: Date = new Date()): string {
  if (tipo === "mes") {
    return `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}`;
  }
  return paraChaveData(domingoDaSemana(referencia));
}

/** Intervalo `{inicio, fim}` de uma chave de período. */
export function intervaloDaChave(tipo: TipoPeriodo, chave: string): IntervaloData {
  if (tipo === "mes") {
    const [ano, mes] = chave.split("-").map(Number);
    return inicioFimMes(new Date(ano, mes - 1, 1));
  }
  const [ano, mes, dia] = chave.split("-").map(Number);
  return inicioFimSemana(new Date(ano, mes - 1, dia));
}

/** Rótulo curto de um período ("Mês atual", "Setembro/26", "Semana atual", "2ª sem · 08–14/09"). */
export function rotuloPeriodo(
  tipo: TipoPeriodo,
  chave: string,
  referencia: Date = new Date(),
): string {
  if (chave === chavePeriodo(tipo, referencia)) {
    return tipo === "mes" ? "Mês atual" : "Semana atual";
  }
  if (tipo === "mes") {
    const [ano, mes] = chave.split("-").map(Number);
    return `${MESES_LONGOS[mes - 1]}/${String(ano).slice(2)}`;
  }
  const { inicio, fim } = intervaloDaChave("semana", chave);
  const [, mi, di] = (inicio ?? "").split("-");
  const [, mf, df] = (fim ?? "").split("-");
  const domingo = new Date(chave + "T00:00:00");
  const ordinal = Math.floor((domingo.getDate() - 1) / 7) + 1;
  return `${ordinal}ª sem · ${di}/${mi}–${df}/${mf}`;
}

/**
 * Períodos concretos que o vendedor pode escolher, do mais recente ao mais
 * antigo: do período atual até o do pedido mais antigo, limitado por
 * `TETO_PERIODOS`. O período atual entra sempre, mesmo sem pedidos.
 */
export function periodosDisponiveis(
  pedidos: Pedido[],
  tipo: TipoPeriodo,
  referencia: Date = new Date(),
): PeriodoOpcao[] {
  const chaves = new Set<string>([chavePeriodo(tipo, referencia)]);
  for (const p of pedidos) {
    if (!p.dataPedido) continue;
    chaves.add(chavePeriodo(tipo, new Date(p.dataPedido + "T00:00:00")));
  }
  return [...chaves]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, TETO_PERIODOS[tipo])
    .map((chave) => {
      const { inicio, fim } = intervaloDaChave(tipo, chave);
      return { chave, rotulo: rotuloPeriodo(tipo, chave, referencia), inicio: inicio!, fim: fim! };
    });
}

/** `true` se a data cai em algum dos intervalos (união dos períodos selecionados). */
export function emAlgumIntervalo(dataPedido: string, intervalos: IntervaloData[]): boolean {
  return intervalos.some(
    (i) => (!i.inicio || dataPedido >= i.inicio) && (!i.fim || dataPedido <= i.fim),
  );
}

export interface FiltroRelatorio {
  inicio?: string | null;
  fim?: string | null;
  /** União de períodos selecionados; quando presente, substitui `inicio`/`fim`. */
  intervalos?: IntervaloData[];
  clienteId?: string;
  marca?: string;
  /** Marcas aceitas (nomes). Vazio/ausente = todas. */
  marcasIn?: string[];
  /** Só entram no relatório pedidos "enviado" — rascunho não é venda fechada. */
  status?: Pedido["status"];
}

export function filtrarPedidos(pedidos: Pedido[], filtro: FiltroRelatorio): Pedido[] {
  return pedidos.filter((p) => {
    if (filtro.status && p.status !== filtro.status) return false;
    if (filtro.intervalos?.length) {
      if (!emAlgumIntervalo(p.dataPedido, filtro.intervalos)) return false;
    } else {
      if (filtro.inicio && p.dataPedido < filtro.inicio) return false;
      if (filtro.fim && p.dataPedido > filtro.fim) return false;
    }
    if (filtro.clienteId && p.clienteId !== filtro.clienteId) return false;
    if (filtro.marca && p.marca !== filtro.marca) return false;
    if (filtro.marcasIn?.length && !filtro.marcasIn.includes(p.marca)) return false;
    return true;
  });
}

export interface ResumoVendas {
  totalVendido: number;
  numeroPedidos: number;
  ticketMedio: number;
}

export function resumoVendas(pedidos: Pedido[]): ResumoVendas {
  const totalVendido = pedidos.reduce((soma, p) => soma + totaisPedido(p).total, 0);
  const numeroPedidos = pedidos.length;
  const ticketMedio = numeroPedidos > 0 ? totalVendido / numeroPedidos : 0;
  return { totalVendido, numeroPedidos, ticketMedio };
}

export interface ProdutoMaisVendido {
  nome: string;
  quantidade: number;
  valorTotal: number;
}

export type OrdemValor = "desc" | "asc";

export function produtosMaisVendidos(
  pedidos: Pedido[],
  limite = 10,
  ordem: OrdemValor = "desc",
): ProdutoMaisVendido[] {
  const porNome = new Map<string, ProdutoMaisVendido>();
  for (const pedido of pedidos) {
    // Valor líquido (com a fatia proporcional do desconto do pedido) para a
    // soma por produto bater com o "Total vendido" do card.
    const liquidos = valoresLiquidosItens(pedido);
    pedido.itens.forEach((item, i) => {
      const nome = item.nomeProduto ?? item.descricaoProduto;
      const atual = porNome.get(nome) ?? { nome, quantidade: 0, valorTotal: 0 };
      atual.quantidade += item.qtd || 0;
      atual.valorTotal += liquidos[i];
      porNome.set(nome, atual);
    });
  }
  const sinal = ordem === "desc" ? -1 : 1;
  return [...porNome.values()]
    .sort((a, b) => sinal * (a.valorTotal - b.valorTotal))
    .slice(0, limite);
}

export interface ClienteMaisVendido {
  clienteId: string;
  nome: string;
  quantidadePedidos: number;
  valorTotal: number;
}

/** Espelha `produtosMaisVendidos`, agrupando por cliente em vez de produto — visão "por cliente" de Relatórios. */
export function clientesMaisVendidos(
  pedidos: Pedido[],
  nomePorClienteId: Map<string, string>,
  limite = 10,
  ordem: OrdemValor = "desc",
): ClienteMaisVendido[] {
  const porCliente = new Map<string, ClienteMaisVendido>();
  for (const pedido of pedidos) {
    const atual = porCliente.get(pedido.clienteId) ?? {
      clienteId: pedido.clienteId,
      nome: nomePorClienteId.get(pedido.clienteId) ?? "Cliente removido",
      quantidadePedidos: 0,
      valorTotal: 0,
    };
    atual.quantidadePedidos += 1;
    atual.valorTotal += totaisPedido(pedido).total;
    porCliente.set(pedido.clienteId, atual);
  }
  const sinal = ordem === "desc" ? -1 : 1;
  return [...porCliente.values()]
    .sort((a, b) => sinal * (a.valorTotal - b.valorTotal))
    .slice(0, limite);
}

export interface MarcaMaisVendida {
  marca: string;
  quantidadePedidos: number;
  valorTotal: number;
}

/** Espelha `clientesMaisVendidos`, agrupando por marca — visão "por marca" de Relatórios. */
export function marcasMaisVendidas(
  pedidos: Pedido[],
  limite = 10,
  ordem: OrdemValor = "desc",
): MarcaMaisVendida[] {
  const porMarca = new Map<string, MarcaMaisVendida>();
  for (const pedido of pedidos) {
    const marca = pedido.marca || "Sem marca";
    const atual = porMarca.get(marca) ?? { marca, quantidadePedidos: 0, valorTotal: 0 };
    atual.quantidadePedidos += 1;
    atual.valorTotal += totaisPedido(pedido).total;
    porMarca.set(marca, atual);
  }
  const sinal = ordem === "desc" ? -1 : 1;
  return [...porMarca.values()]
    .sort((a, b) => sinal * (a.valorTotal - b.valorTotal))
    .slice(0, limite);
}

export interface CategoriaMaisVendida {
  categoria: string;
  quantidade: number;
  valorTotal: number;
}

/** Categoria dos itens sem produto correspondente no catálogo atual (renomeado/removido). */
export const SEM_CATEGORIA = "Sem categoria";

/**
 * Reagrupa a saída (completa, sem `limite`) de `produtosMaisVendidos` por
 * categoria, usando o mapa nome→categoria montado a partir do catálogo atual
 * de produtos. Não repete a lógica de somar por nome — só redistribui o que
 * já foi somado.
 */
export function categoriasMaisVendidas(
  produtos: ProdutoMaisVendido[],
  categoriaPorNome: Map<string, string | undefined>,
  ordem: OrdemValor = "desc",
): CategoriaMaisVendida[] {
  const porCategoria = new Map<string, CategoriaMaisVendida>();
  for (const produto of produtos) {
    const categoria = categoriaPorNome.get(produto.nome) || SEM_CATEGORIA;
    const atual = porCategoria.get(categoria) ?? { categoria, quantidade: 0, valorTotal: 0 };
    atual.quantidade += produto.quantidade;
    atual.valorTotal += produto.valorTotal;
    porCategoria.set(categoria, atual);
  }
  const sinal = ordem === "desc" ? -1 : 1;
  return [...porCategoria.values()].sort((a, b) => sinal * (a.valorTotal - b.valorTotal));
}

export type Granularidade = "dia" | "mes";

export interface PontoSerieTempo {
  /** `YYYY-MM-DD` (dia) ou `YYYY-MM` (mês) — ordenável como string. */
  chave: string;
  /** Já formatado pro eixo do gráfico (ex.: "05/08" ou "ago/26"). */
  rotulo: string;
  valorTotal: number;
}

/** "tudo" cobre um período grande demais pra granularidade diária fazer sentido no gráfico. */
export function granularidadePara(periodo: Periodo): Granularidade {
  return periodo === "tudo" ? "mes" : "dia";
}

/**
 * Granularidade do gráfico de linha conforme a seleção de período: diária só
 * quando o recorte é um único mês/semana; caso contrário (vários períodos ou
 * "tudo") o eixo fica mensal para não virar um matagal de pontos.
 */
export function granularidadeParaSelecao(
  tipo: Periodo,
  qtdPeriodos: number,
): Granularidade {
  return tipo === "tudo" || qtdPeriodos > 1 ? "mes" : "dia";
}

const MESES_ABREVIADOS = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

function chaveData(dataPedido: string, granularidade: Granularidade): string {
  return granularidade === "mes" ? dataPedido.slice(0, 7) : dataPedido;
}

function rotuloData(chave: string, granularidade: Granularidade): string {
  if (granularidade === "mes") {
    const [ano, mes] = chave.split("-");
    return `${MESES_ABREVIADOS[Number(mes) - 1]}/${ano.slice(2)}`;
  }
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

function ordenarSerie(totalPorChave: Map<string, number>, granularidade: Granularidade): PontoSerieTempo[] {
  return [...totalPorChave.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([chave, valorTotal]) => ({ chave, rotulo: rotuloData(chave, granularidade), valorTotal }));
}

/** Soma o pedido inteiro por período — usada no detalhe de um cliente (pedidos já filtrados por `clienteId`). */
export function serieTemporalPedidos(pedidos: Pedido[], granularidade: Granularidade): PontoSerieTempo[] {
  const totalPorChave = new Map<string, number>();
  for (const pedido of pedidos) {
    const chave = chaveData(pedido.dataPedido, granularidade);
    totalPorChave.set(chave, (totalPorChave.get(chave) ?? 0) + totaisPedido(pedido).total);
  }
  return ordenarSerie(totalPorChave, granularidade);
}

/** Soma só os itens cujo nome está em `nomes` por período — usada no detalhe de uma categoria (vários nomes) ou de um produto (um nome só). */
export function serieTemporalItens(
  pedidos: Pedido[],
  nomes: Set<string>,
  granularidade: Granularidade,
): PontoSerieTempo[] {
  const totalPorChave = new Map<string, number>();
  for (const pedido of pedidos) {
    const chave = chaveData(pedido.dataPedido, granularidade);
    const liquidos = valoresLiquidosItens(pedido);
    pedido.itens.forEach((item, i) => {
      const nome = item.nomeProduto ?? item.descricaoProduto;
      if (!nomes.has(nome)) return;
      totalPorChave.set(chave, (totalPorChave.get(chave) ?? 0) + liquidos[i]);
    });
  }
  return ordenarSerie(totalPorChave, granularidade);
}
