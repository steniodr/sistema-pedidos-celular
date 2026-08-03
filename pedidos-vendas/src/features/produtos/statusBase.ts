import type { ImportacaoInfo } from "../../domain/types";

/**
 * Indicador de base de produtos desatualizada (especificação 6.3).
 * Nunca bloqueia o pedido — apenas alerta com intensidade crescente.
 */
export type NivelBase = "vazia" | "ok" | "atencao" | "critico";

export interface StatusBase {
  nivel: NivelBase;
  diasDesdeImportacao: number | null;
  mensagem: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function avaliarBase(
  info: ImportacaoInfo | undefined,
  agora: Date = new Date(),
): StatusBase {
  if (!info) {
    return {
      nivel: "vazia",
      diasDesdeImportacao: null,
      mensagem: "Nenhuma base de produtos importada.",
    };
  }

  const dias = Math.floor((agora.getTime() - new Date(info.quandoEm).getTime()) / DIA_MS);

  if (dias > 90) {
    return {
      nivel: "critico",
      diasDesdeImportacao: dias,
      mensagem: `Base com ${dias} dias. Importe a tabela atualizada antes de continuar.`,
    };
  }
  if (dias > 30) {
    return {
      nivel: "atencao",
      diasDesdeImportacao: dias,
      mensagem: `Base importada há ${dias} dias.`,
    };
  }
  return {
    nivel: "ok",
    diasDesdeImportacao: dias,
    mensagem:
      dias === 0 ? "Base importada hoje." : `Base importada há ${dias} dia${dias > 1 ? "s" : ""}.`,
  };
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarData(iso: string): string {
  // Aceita "2026-07-30" e ISO completo, sem cair no fuso do UTC.
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
