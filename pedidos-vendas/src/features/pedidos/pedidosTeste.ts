import type { Repository } from "../../data/repository";
import type { ItemPedido, Pedido, StatusPedido } from "../../domain/types";
import { semearClientesTeste } from "../clientes/clientesTeste";

/**
 * Pedidos de exemplo espalhados em semanas/meses diferentes, com marcas e
 * clientes variados — só para o vendedor validar a tela de Relatórios sem
 * precisar montar pedidos de verdade na mão. Nada aqui depende da base de
 * produtos: cada item já vem com nome/valor prontos (mesmo formato que o
 * pedido grava normalmente).
 */

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const PRODUTOS_TESTE = [
  { nome: "Esmalte sintético brilhante", embalagem: "Galão 3,6 L", valorUnit: 95.64 },
  { nome: "Verniz marítimo", embalagem: "Tambor 180 L", valorUnit: 5794.88 },
  { nome: "Massa corrida", embalagem: "Lata 18 L", valorUnit: 210.5 },
  { nome: "Selador acrílico", embalagem: "Galão 3,6 L", valorUnit: 68.9 },
] as const;

function item(indiceProduto: number, qtd: number, posicao: number): ItemPedido {
  const produto = PRODUTOS_TESTE[indiceProduto];
  return {
    item: posicao,
    qtd,
    embalagem: produto.embalagem,
    descricaoProduto: produto.nome,
    nomeProduto: produto.nome,
    valorUnit: produto.valorUnit,
  };
}

function dataHaDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

interface PedidoTeste {
  diasAtras: number;
  marca: "ARARA AZUL" | "MERKO";
  status: StatusPedido;
  itens: ItemPedido[];
}

const PEDIDOS_TESTE: PedidoTeste[] = [
  { diasAtras: 1, marca: "ARARA AZUL", status: "enviado", itens: [item(0, 2, 1), item(2, 1, 2)] },
  { diasAtras: 3, marca: "MERKO", status: "enviado", itens: [item(1, 1, 1)] },
  // Rascunho de propósito: não deve entrar nos totais do relatório.
  { diasAtras: 6, marca: "ARARA AZUL", status: "rascunho", itens: [item(0, 1, 1)] },
  { diasAtras: 10, marca: "MERKO", status: "enviado", itens: [item(3, 3, 1)] },
  { diasAtras: 20, marca: "ARARA AZUL", status: "enviado", itens: [item(0, 4, 1), item(1, 1, 2)] },
  { diasAtras: 40, marca: "MERKO", status: "enviado", itens: [item(2, 2, 1)] },
  { diasAtras: 65, marca: "ARARA AZUL", status: "enviado", itens: [item(3, 1, 1)] },
  { diasAtras: 95, marca: "MERKO", status: "enviado", itens: [item(0, 5, 1)] },
];

/** Garante clientes de teste e cria os pedidos acima. Devolve quantos pedidos foram criados. */
export async function gerarPedidosTeste(repo: Repository): Promise<number> {
  await semearClientesTeste(repo);
  // Só clientes de teste — nunca vincula um pedido fictício a um cliente real
  // (senão o pedido de teste também aparece misturado no histórico dele).
  const clientes = (await repo.listarClientes()).filter((c) => c.teste);
  if (clientes.length === 0) return 0;

  let criados = 0;
  for (let i = 0; i < PEDIDOS_TESTE.length; i++) {
    const base = PEDIDOS_TESTE[i];
    const cliente = clientes[i % clientes.length];
    const momento = new Date().toISOString();
    const pedido: Pedido = {
      id: novoId(),
      numero: await repo.proximoNumeroPedido(),
      marca: base.marca,
      clienteId: cliente.id,
      dataPedido: dataHaDias(base.diasAtras),
      itens: base.itens,
      descontoTipo: "percentual",
      descontoValor: 0,
      status: base.status,
      teste: true,
      criadoEm: momento,
      atualizadoEm: momento,
    };
    await repo.salvarPedido(pedido);
    criados++;
  }
  return criados;
}
