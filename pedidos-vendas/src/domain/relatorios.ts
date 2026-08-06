import { totaisPedido, totalItem } from "./calculos";
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

export interface FiltroRelatorio {
  inicio?: string | null;
  fim?: string | null;
  clienteId?: string;
  marca?: string;
  /** Só entram no relatório pedidos "enviado" — rascunho não é venda fechada. */
  status?: Pedido["status"];
}

export function filtrarPedidos(pedidos: Pedido[], filtro: FiltroRelatorio): Pedido[] {
  return pedidos.filter((p) => {
    if (filtro.status && p.status !== filtro.status) return false;
    if (filtro.inicio && p.dataPedido < filtro.inicio) return false;
    if (filtro.fim && p.dataPedido > filtro.fim) return false;
    if (filtro.clienteId && p.clienteId !== filtro.clienteId) return false;
    if (filtro.marca && p.marca !== filtro.marca) return false;
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
    for (const item of pedido.itens) {
      const nome = item.nomeProduto ?? item.descricaoProduto;
      const atual = porNome.get(nome) ?? { nome, quantidade: 0, valorTotal: 0 };
      atual.quantidade += item.qtd || 0;
      atual.valorTotal += totalItem(item);
      porNome.set(nome, atual);
    }
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
    for (const item of pedido.itens) {
      const nome = item.nomeProduto ?? item.descricaoProduto;
      if (!nomes.has(nome)) continue;
      totalPorChave.set(chave, (totalPorChave.get(chave) ?? 0) + totalItem(item));
    }
  }
  return ordenarSerie(totalPorChave, granularidade);
}
