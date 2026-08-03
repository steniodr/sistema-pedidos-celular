import { normalizarChave } from "./texto";

/**
 * Helpers de leitura de planilha compartilhados entre os importadores
 * (produtos, clientes): detecção de coluna por lista de aliases, leitura de
 * célula como texto e teste de linha em branco.
 */

export interface LinhaIgnorada {
  linha: number;
  motivo: string;
}

export function encontrarIndice(chaves: string[], aliases: string[]): number | null {
  for (const alias of aliases) {
    const exato = chaves.indexOf(alias);
    if (exato >= 0) return exato;
  }
  for (const alias of aliases) {
    const parcial = chaves.findIndex((c) => c.includes(alias));
    if (parcial >= 0) return parcial;
  }
  return null;
}

export function cabecalhoNormalizado(cabecalho: string[]): string[] {
  return cabecalho.map(normalizarChave);
}

/** Espaços, tabs e quebras de linha (o Excel usa Alt+Enter dentro da própria célula). */
export function textoDaCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

export function linhaVazia(linha: unknown[]): boolean {
  return linha.every((c) => textoDaCelula(c) === "");
}
