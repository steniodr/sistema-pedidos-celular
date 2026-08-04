import type { DescontoTipo, ItemPedido, Pedido } from "./types";

/**
 * Fonte única de verdade dos valores do pedido — usada pelas telas, pelo Excel e pelo PDF.
 * Todo valor monetário é arredondado a 2 casas na saída para evitar que o erro de ponto
 * flutuante apareça no total exportado.
 */

export function arredondar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function totalItem(item: Pick<ItemPedido, "qtd" | "valorUnit">): number {
  return arredondar((item.qtd || 0) * (item.valorUnit || 0));
}

export function subtotal(itens: ItemPedido[]): number {
  return arredondar(itens.reduce((soma, item) => soma + totalItem(item), 0));
}

/** Valor em R$ efetivamente descontado, limitado ao subtotal (nunca gera total negativo). */
export function valorDesconto(base: number, tipo: DescontoTipo, valor: number): number {
  if (!valor || valor <= 0) return 0;
  const bruto = tipo === "percentual" ? (base * valor) / 100 : valor;
  return arredondar(Math.min(Math.max(bruto, 0), base));
}

export function aplicarDesconto(base: number, tipo: DescontoTipo, valor: number): number {
  return arredondar(base - valorDesconto(base, tipo, valor));
}

export interface TotaisPedido {
  subtotal: number;
  desconto: number;
  total: number;
}

export function totaisPedido(
  pedido: Pick<Pedido, "itens" | "descontoTipo" | "descontoValor">,
): TotaisPedido {
  const sub = subtotal(pedido.itens);
  // Itens "com desconto" (valor promocional avulso) ficam de fora da base do
  // desconto geral do pedido — o vendedor já deu o desconto neles na hora de
  // montar o item, não pode descontar de novo em cima.
  const subDescontavel = subtotal(pedido.itens.filter((item) => !item.comDesconto));
  const desconto = valorDesconto(subDescontavel, pedido.descontoTipo, pedido.descontoValor);
  return { subtotal: sub, desconto, total: arredondar(sub - desconto) };
}

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(Number.isFinite(valor) ? valor : 0);
}

/** Lê número digitado em formato brasileiro ("1.234,56") ou americano ("1234.56"). */
export function lerNumeroBR(entrada: unknown): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  if (typeof entrada !== "string") return null;

  const texto = entrada.trim().replace(/^R\$\s*/i, "");
  if (!texto) return null;

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");

  let normalizado = texto;
  if (temVirgula && temPonto) {
    // O separador decimal é o último a aparecer.
    normalizado =
      texto.lastIndexOf(",") > texto.lastIndexOf(".")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "");
  } else if (temVirgula) {
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if (temPonto) {
    // "1.234" com 3 dígitos após o ponto e sem vírgula é separador de milhar.
    normalizado = /^\d{1,3}(\.\d{3})+$/.test(texto) ? texto.replace(/\./g, "") : texto;
  }

  normalizado = normalizado.replace(/\s/g, "");
  if (!/^-?\d*\.?\d+$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}
