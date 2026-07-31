import type {
  Cliente,
  ImportacaoInfo,
  Pedido,
  Produto,
  Representante,
} from "../domain/types";

/**
 * Contrato entre as telas e a origem dos dados (especificação, seção 2).
 * Hoje só existe a implementação sobre IndexedDB; na Fase 3 uma implementação
 * com Supabase entra aqui sem que nenhuma tela precise mudar.
 */
export interface Repository {
  // Clientes
  listarClientes(busca?: string): Promise<Cliente[]>;
  obterCliente(id: string): Promise<Cliente | undefined>;
  salvarCliente(cliente: EntradaCliente): Promise<Cliente>;
  removerCliente(id: string): Promise<void>;

  // Produtos
  listarProdutos(busca?: string, limite?: number): Promise<Produto[]>;
  /** Nomes distintos que casam a busca — para a etapa 1 de escolha de produto no pedido. */
  listarNomesProdutos(busca?: string, limite?: number): Promise<string[]>;
  /** Todas as variantes (linhas) de um mesmo nome de produto — etapa 2, se houver mais de uma. */
  listarVariantesPorNome(nome: string): Promise<Produto[]>;
  obterProduto(id: string): Promise<Produto | undefined>;
  /** Cria ou atualiza um produto isolado (tela de edição manual). */
  salvarProduto(produto: EntradaProdutoUnico): Promise<Produto>;
  removerProduto(id: string): Promise<void>;
  contarProdutos(): Promise<number>;
  /** Troca a base inteira de produtos e registra a origem/data da importação. */
  substituirBaseProdutos(produtos: EntradaProduto[], arquivo: string): Promise<ImportacaoInfo>;
  obterUltimaImportacao(): Promise<ImportacaoInfo | undefined>;

  // Pedidos
  listarPedidos(filtro?: FiltroPedidos): Promise<Pedido[]>;
  obterPedido(id: string): Promise<Pedido | undefined>;
  salvarPedido(pedido: Pedido): Promise<Pedido>;
  removerPedido(id: string): Promise<void>;
  criarPedido(dados: NovoPedido): Promise<Pedido>;
  duplicarPedido(id: string): Promise<Pedido>;
  proximoNumeroPedido(): Promise<number>;

  // Configuração
  obterRepresentante(): Promise<Representante | undefined>;
  salvarRepresentante(representante: Representante): Promise<void>;
}

export type EntradaCliente = Omit<Cliente, "id" | "criadoEm" | "atualizadoEm"> & {
  id?: string;
};

export type EntradaProduto = Pick<Produto, "nome" | "detalhes" | "embalagem" | "valorUnit">;

export type EntradaProdutoUnico = EntradaProduto & { id?: string };

export interface NovoPedido {
  clienteId: string;
  marca: string;
}

export interface FiltroPedidos {
  status?: Pedido["status"];
  marca?: string;
  /** Casa número do pedido, marca ou nome do cliente vinculado. */
  busca?: string;
}
