import type { Repository } from "../../data/repository";
import type { ItemPedido, Pedido } from "../../domain/types";
import { semearClientesTeste } from "../clientes/clientesTeste";

/**
 * Dataset fictício só para o Ambiente de teste validar a tela de Relatório:
 * cobre várias semanas e vários meses, com 3 marcas próprias ("Teste 1/2/3").
 * Tudo entra marcado como `teste`, então o relatório real nunca mostra nada
 * disso — nem em "Tudo".
 */

const MARCAS_TESTE = ["Teste 1", "Teste 2", "Teste 3"] as const;

const PRODUTOS_TESTE = [
  { nome: "Tinta acrílica premium (teste)", embalagem: "Lata 18 L", valorUnit: 389.9 },
  { nome: "Massa niveladora (teste)", embalagem: "Balde 25 kg", valorUnit: 142.5 },
  { nome: "Verniz poliuretano (teste)", embalagem: "Galão 3,6 L", valorUnit: 268.75 },
  { nome: "Selador acrílico (teste)", embalagem: "Lata 18 L", valorUnit: 176.4 },
] as const;

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function dataHaDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

function item(indiceProduto: number, qtd: number, posicao: number): ItemPedido {
  const p = PRODUTOS_TESTE[indiceProduto % PRODUTOS_TESTE.length];
  return {
    item: posicao,
    qtd,
    embalagem: p.embalagem,
    descricaoProduto: p.nome,
    nomeProduto: p.nome,
    valorUnit: p.valorUnit,
  };
}

/**
 * Semeia (ou reusa) as 3 marcas de teste, o cliente de teste e cria ~27
 * pedidos espalhados por 6 semanas e 4 meses. Devolve quantos pedidos criou.
 */
export async function gerarRelatorioTeste(repo: Repository): Promise<number> {
  const marcas = await Promise.all(
    MARCAS_TESTE.map((nome) =>
      repo.salvarMarca({ nome, visivelEmRelatorios: false, teste: true }),
    ),
  );

  await semearClientesTeste(repo);
  const clientes = (await repo.listarClientes()).filter((c) => c.teste);
  if (clientes.length === 0) return 0;

  // Espalhamento: 6 janelas semanais recentes + 3 janelas mensais mais antigas.
  const diasBase = [2, 9, 16, 23, 30, 37, 70, 100, 130];

  let criados = 0;
  let seq = 0;
  for (const dias of diasBase) {
    for (let m = 0; m < marcas.length; m++) {
      const marca = marcas[m];
      const cliente = clientes[seq % clientes.length];
      const comDesconto = seq % 3 === 0;
      const momento = new Date().toISOString();
      const pedido: Pedido = {
        id: novoId(),
        numero: await repo.proximoNumeroPedido(),
        marca: marca.nome,
        marcaId: marca.id,
        clienteId: cliente.id,
        dataPedido: dataHaDias(dias),
        itens: [
          item(seq, 2 + (seq % 3), 1),
          item(seq + 1, 1 + (seq % 2), 2),
        ],
        descontoTipo: "percentual",
        descontoValor: comDesconto ? 8 : 0,
        status: "enviado",
        teste: true,
        criadoEm: momento,
        atualizadoEm: momento,
      };
      await repo.salvarPedido(pedido);
      criados++;
      seq++;
    }
  }
  return criados;
}
