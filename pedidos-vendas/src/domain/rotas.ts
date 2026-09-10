/**
 * Define um parametro numa rota de retorno, SUBSTITUINDO a chave se ela ja
 * existir.
 *
 * As telas de escolha (cliente, marca) voltam para o fluxo original anexando
 * `?clienteId=` / `?marcaId=` a uma rota que o chamador montou. Quando essa
 * rota ja trazia a mesma chave (mesmo que vazia, para preservar o outro
 * campo), concatenar gerava a chave duplicada e `URLSearchParams.get()`
 * devolvia a PRIMEIRA ocorrencia — a vazia. Resultado: escolher o cliente nao
 * surtia efeito e o fluxo do pedido travava.
 */
export function definirParametro(rota: string, chave: string, valor: string): string {
  const [caminho, query = ""] = rota.split("?");
  const params = new URLSearchParams(query);
  params.set(chave, valor);
  const busca = params.toString();
  return busca ? `${caminho}?${busca}` : caminho;
}
