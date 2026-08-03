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

export function produtosMaisVendidos(pedidos: Pedido[], limite = 10): ProdutoMaisVendido[] {
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
  return [...porNome.values()].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, limite);
}
