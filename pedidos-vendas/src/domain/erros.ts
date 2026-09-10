/** Mensagem amigável para erros de gravação — em especial "armazenamento cheio", comum em celular. */
export function mensagemErro(e: unknown, padrao: string): string {
  if (e instanceof Error) {
    if (e.name === "QuotaExceededError" || /quota/i.test(e.message)) {
      return "O armazenamento do celular está cheio. Libere espaço (ex.: exporte pedidos antigos e desinstale apps sem uso) e tente novamente.";
    }
    return e.message || padrao;
  }
  return padrao;
}

/**
 * `true` quando a falha foi o navegador nao conseguir baixar um pedaco do app
 * carregado sob demanda (exceljs, jspdf, xlsx).
 *
 * Acontece quando o app foi atualizado enquanto a aba continuava aberta: a
 * pagina em execucao e a versao antiga e pede arquivos com o hash antigo, que
 * nao existem mais no servidor. Como o host devolve index.html para caminho
 * inexistente, o erro chega como "MIME type text/html". Nao e erro de
 * exportacao — basta recarregar na versao nova.
 */
export function ehAppDesatualizado(e: unknown): boolean {
  const texto = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? "");
  return (
    /dynamically imported module/i.test(texto) ||
    /Importing a module script failed/i.test(texto) ||
    /Failed to load module script/i.test(texto) ||
    /MIME type/i.test(texto)
  );
}

/** Mensagem unica para o caso acima, usada em toda importacao sob demanda. */
export const MENSAGEM_APP_DESATUALIZADO =
  "O app foi atualizado e esta tela ainda está na versão antiga. Recarregue para continuar.";
