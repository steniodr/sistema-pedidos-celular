/**
 * Validação de CPF/CNPJ por dígito verificador, 100% client-side (especificação 6.2).
 * O pedido não pode ser finalizado com documento inválido, mas o rascunho pode ser salvo.
 */

export function somenteDigitos(valor: string): string {
  return (valor || "").replace(/\D/g, "");
}

function digitosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

export function validarCPF(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || digitosIguais(d)) return false;

  for (const [tamanho, posicao] of [
    [9, 10],
    [10, 11],
  ]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (posicao - i);
    const resto = (soma * 10) % 11;
    const digito = resto === 10 || resto === 11 ? 0 : resto;
    if (digito !== Number(d[tamanho])) return false;
  }
  return true;
}

export function validarCNPJ(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || digitosIguais(d)) return false;

  for (const tamanho of [12, 13]) {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(d[i]) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (digito !== Number(d[tamanho])) return false;
  }
  return true;
}

export function validarCpfCnpj(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

/** Aplica a máscara conforme o usuário digita, sem travar tamanhos intermediários. */
export function mascararCpfCnpj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14);

  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }

  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascararTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function mascararCep(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8);
  return d.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
}
