import { intervaloPeriodo } from "../../domain/relatorios";

/**
 * Filtro de período do Histórico: um dia específico, a semana ou o mês que
 * contêm esse dia. Reaproveita o cálculo de semana/mês de `relatorios.ts`
 * (mesma definição de semana: domingo a sábado) em vez de duplicar.
 */

export type TipoPeriodo = "dia" | "semana" | "mes";

export interface FiltroPeriodo {
  tipo: TipoPeriodo;
  /** Data âncora "YYYY-MM-DD" escolhida no calendário. */
  referencia: string;
}

export function dataLocalDoISO(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function intervaloFiltroPeriodo(filtro: FiltroPeriodo): { inicio: string; fim: string } {
  if (filtro.tipo === "dia") return { inicio: filtro.referencia, fim: filtro.referencia };
  const { inicio, fim } = intervaloPeriodo(filtro.tipo, dataLocalDoISO(filtro.referencia));
  return { inicio: inicio!, fim: fim! };
}

const FORMATADOR_DIA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const FORMATADOR_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function rotuloFiltroPeriodo(filtro: FiltroPeriodo): string {
  const { inicio, fim } = intervaloFiltroPeriodo(filtro);
  if (filtro.tipo === "dia") return FORMATADOR_DIA.format(dataLocalDoISO(inicio));
  if (filtro.tipo === "semana") {
    return `Semana de ${FORMATADOR_DIA.format(dataLocalDoISO(inicio))} a ${FORMATADOR_DIA.format(dataLocalDoISO(fim))}`;
  }
  return comMaiuscula(FORMATADOR_MES.format(dataLocalDoISO(inicio)));
}
