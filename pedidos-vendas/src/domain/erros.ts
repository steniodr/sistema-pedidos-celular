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
