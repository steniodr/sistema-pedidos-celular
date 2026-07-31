import type { Repository, EntradaCliente } from "../../data/repository";

/**
 * Dois clientes de exemplo para testar o app sem precisar digitar dados na mão.
 * CPF e CNPJ são válidos (passam na validação de dígito verificador) mas fictícios.
 * O nome traz "(teste)" de propósito, para ficarem fáceis de achar e excluir depois
 * em Clientes → abrir o cliente → “Excluir cliente”.
 */
const CLIENTES_TESTE: EntradaCliente[] = [
  {
    nome: "Maria Pereira (teste)",
    cpfCnpj: "52998224725",
    codigoCliente: "T001",
    telefone: "67991234567",
    endereco: "Rua das Palmeiras, 120",
    bairro: "Centro",
    cidadeEstado: "Campo Grande / MS",
    cep: "79002000",
    transportadora: "Rodoviário Sul",
    condicaoPagamento: "28/35/42 dias",
    localEntrega: "Depósito central",
  },
  {
    nome: "Tintas do Vale Ltda (teste)",
    cpfCnpj: "11222333000181",
    codigoCliente: "T002",
    telefone: "67998887766",
    endereco: "Av. Afonso Pena, 3200",
    bairro: "Jardim dos Estados",
    cidadeEstado: "Campo Grande / MS",
    cep: "79020000",
    transportadora: "FOB - Transportadora",
    condicaoPagamento: "A combinar",
    localEntrega: "Loja",
  },
];

/** Cria os clientes de teste que ainda não existem (comparação pelo CPF/CNPJ). */
export async function semearClientesTeste(repo: Repository): Promise<number> {
  const existentes = await repo.listarClientes();
  const cpfsExistentes = new Set(existentes.map((c) => c.cpfCnpj));

  let criados = 0;
  for (const cliente of CLIENTES_TESTE) {
    if (cpfsExistentes.has(cliente.cpfCnpj)) continue;
    await repo.salvarCliente(cliente);
    criados++;
  }
  return criados;
}
