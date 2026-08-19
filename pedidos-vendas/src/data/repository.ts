import type {
  CheckIn,
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
  /**
   * Importa clientes em lote, casando por CPF/CNPJ (normalizado): quem já existe é
   * atualizado (mantendo id/criadoEm), quem não existe é criado. Ao contrário de
   * `substituirBaseProdutos`, NUNCA apaga clientes existentes — pedidos já feitos
   * referenciam clientes por id e ficariam órfãos.
   */
  importarClientes(entradas: EntradaCliente[], arquivo: string): Promise<ImportacaoClientesInfo>;
  /** Recoloca um cliente exatamente como estava — usado só pelo "Desfazer" da exclusão. */
  restaurarCliente(cliente: Cliente): Promise<void>;

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
  /** Recoloca um produto exatamente como estava — usado só pelo "Desfazer" da exclusão. */
  restaurarProduto(produto: Produto): Promise<void>;
  contarProdutos(): Promise<number>;
  /** Troca a base inteira de produtos e registra a origem/data da importação. */
  substituirBaseProdutos(produtos: EntradaProduto[], arquivo: string): Promise<ImportacaoInfo>;
  obterUltimaImportacao(): Promise<ImportacaoInfo | undefined>;

  // Pedidos
  listarPedidos(filtro?: FiltroPedidos): Promise<Pedido[]>;
  obterPedido(id: string): Promise<Pedido | undefined>;
  salvarPedido(pedido: Pedido): Promise<Pedido>;
  removerPedido(id: string): Promise<void>;
  /** Recoloca um pedido exatamente como estava — usado só pelo "Desfazer" da exclusão. */
  restaurarPedido(pedido: Pedido): Promise<void>;
  criarPedido(dados: NovoPedido): Promise<Pedido>;
  duplicarPedido(id: string): Promise<Pedido>;
  /** `excluirId` ignora o próprio pedido no cálculo — usado ao reatribuir número de um pedido já existente (ex.: sair de "Somente orçamento"), pra não subir a cada ida-e-volta. */
  proximoNumeroPedido(excluirId?: string): Promise<number>;
  /** `true` se já existe OUTRO pedido com esse número (`excluirId` ignora o próprio pedido ao editar). */
  existeNumeroPedido(numero: number, excluirId?: string): Promise<boolean>;
  /** Próximo código de orçamento disponível (ex.: "ORC01", "ORC02"...) — contador próprio, independente de `numero`. */
  proximoCodigoOrcamento(): Promise<string>;

  // Check-in (visita ao cliente, independente de pedido)
  listarCheckIns(filtro?: FiltroCheckIns): Promise<CheckIn[]>;
  obterCheckIn(id: string): Promise<CheckIn | undefined>;
  salvarCheckIn(checkIn: EntradaCheckIn): Promise<CheckIn>;
  removerCheckIn(id: string): Promise<void>;
  /** Recoloca um check-in exatamente como estava — usado só pelo "Desfazer" da exclusão. */
  restaurarCheckIn(checkIn: CheckIn): Promise<void>;

  // Configuração
  obterRepresentante(): Promise<Representante | undefined>;
  salvarRepresentante(representante: Representante): Promise<void>;

  // Backup (troca de aparelho — a sincronização entre vendedores ainda não existe)
  exportarBackup(): Promise<BackupDados>;
  /** Substitui clientes, produtos, pedidos e configuração pelo conteúdo do backup. */
  restaurarBackup(dados: BackupDados): Promise<void>;

  /** Apaga todos os clientes e pedidos marcados como `teste` (gerados em Configurações). */
  removerDadosTeste(): Promise<RemocaoDadosTeste>;
}

export interface RemocaoDadosTeste {
  clientes: number;
  pedidos: number;
}

export type EntradaCliente = Omit<Cliente, "id" | "criadoEm" | "atualizadoEm"> & {
  id?: string;
};

export interface ImportacaoClientesInfo {
  arquivo: string;
  quandoEm: string;
  totalNovos: number;
  totalAtualizados: number;
  totalIgnorados: number;
}

export type EntradaProduto = Pick<
  Produto,
  "nome" | "categoria" | "detalhes" | "variacao" | "embalagem" | "valorUnit"
>;

export type EntradaProdutoUnico = EntradaProduto & { id?: string };

export interface NovoPedido {
  clienteId: string;
  marca: string;
}

export interface FiltroPedidos {
  status?: Pedido["status"];
  marca?: string;
  clienteId?: string;
  /** Casa número do pedido, marca ou nome do cliente vinculado. */
  busca?: string;
}

export type EntradaCheckIn = Omit<CheckIn, "id" | "criadoEm" | "atualizadoEm"> & {
  id?: string;
};

export interface FiltroCheckIns {
  clienteId?: string;
  /** Casa nome do cliente vinculado. */
  busca?: string;
}

/** Cópia completa da base local — baixada como .json e usada para restaurar em outro aparelho. */
export interface BackupDados {
  versao: 1;
  geradoEm: string;
  clientes: Cliente[];
  produtos: Produto[];
  pedidos: Pedido[];
  checkIns?: CheckIn[];
  representante?: Representante;
  ultimaImportacao?: ImportacaoInfo;
}
