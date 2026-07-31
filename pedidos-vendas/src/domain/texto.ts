/** Normaliza texto para busca e comparação: minúsculas, sem acento, sem espaço nas pontas. */
export function normalizar(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Normalização mais agressiva, para casar cabeçalhos de planilha ("Valor Unit." → "valorunit"). */
export function normalizarChave(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]/g, "");
}
