/**
 * Entidades do app, mapeadas da especificação técnica (seções 4.1 a 4.4).
 * Datas são gravadas como ISO string para facilitar persistência e futura sincronização.
 */

export type ISODateTime = string;

export interface Cliente {
  id: string;
  nome: string;
  /** Nome fantasia, quando diferente da razão social (ex.: planilhas de base de clientes). */
  nomeFantasia?: string;
  cpfCnpj: string;
  codigoCliente?: string;
  /** Nome da pessoa de contato no cliente. */
  contato?: string;
  telefone?: string;
  endereco?: string;
  bairro?: string;
  cidadeEstado?: string;
  cep?: string;
  transportadora?: string;
  condicaoPagamento?: string;
  /** Observações gerais (entrega, horário de recebimento, financeiro etc.). */
  obsGerais?: string;
  /** Situação do cliente vinda da base importada (ex.: "Ativo", "Inativo"); texto livre, sem lista fechada. */
  situacao?: string;
  /** Criado pelo gerador de dados de teste (Configurações) — nunca vem de cadastro/importação real. */
  teste?: boolean;
  criadoEm: ISODateTime;
  atualizadoEm: ISODateTime;
}

export interface Produto {
  id: string;
  nome: string;
  /** Variante/observação da tabela de preços (ex.: "exceto amarelo, laranja e vermelho"). */
  detalhes?: string;
  embalagem: string;
  valorUnit: number;
  /** Nome do arquivo de onde o produto veio, para rastreabilidade. */
  origemArquivo: string;
  atualizadoEm: ISODateTime;
}

export interface ItemPedido {
  /** Número sequencial do item dentro do pedido, começando em 1. */
  item: number;
  qtd: number;
  embalagem: string;
  /** Texto final (nome + detalhes) usado no Excel/PDF. */
  descricaoProduto: string;
  /** Nome do produto isolado, sem detalhes — usado para reabrir o fluxo guiado ao editar o item. */
  nomeProduto?: string;
  detalhesProduto?: string;
  cor?: string;
  padraoComplemento?: string;
  /** Campo livre do vendedor, não vai para a coluna de descrição do produto. */
  descricao?: string;
  valorUnit: number;
  /** Item com valor promocional avulso — fica de fora da base do desconto geral do pedido. */
  comDesconto?: boolean;
}

export type DescontoTipo = "percentual" | "valor";
export type StatusPedido = "rascunho" | "enviado";

export interface Pedido {
  id: string;
  numero: number;
  /** Texto livre do cabeçalho da planilha (ex.: MERKO, ARARA AZUL). */
  marca: string;
  clienteId: string;
  dataPedido: string;
  representanteNome?: string;
  representanteTelefone?: string;
  representanteEmail?: string;
  formaSolicitacao?: string;
  /** Pré-preenchida do cadastro do cliente ao criar o pedido; editável, não altera o cadastro. */
  condicaoPagamento?: string;
  itens: ItemPedido[];
  descontoTipo: DescontoTipo;
  descontoValor: number;
  /** Justificativa do desconto (quem autorizou, motivo), opcional. */
  descontoDescricao?: string;
  status: StatusPedido;
  /** Criado pelo gerador de dados de teste (Configurações) — excluído dos totais de Relatórios. */
  teste?: boolean;
  criadoEm: ISODateTime;
  atualizadoEm: ISODateTime;
}

/** Check-in de visita a um cliente — independente de existir pedido. */
export interface CheckIn {
  id: string;
  clienteId: string;
  /** "YYYY-MM-DD", padrão o dia atual. */
  data: string;
  /** "HH:mm", padrão a hora atual — editável. */
  hora: string;
  criadoEm: ISODateTime;
  atualizadoEm: ISODateTime;
}

/** Dados do vendedor, reaproveitados no rodapé de todo pedido. */
export interface Representante {
  nome: string;
  telefone: string;
  email: string;
}

/** Registro da última importação da base de produtos. */
export interface ImportacaoInfo {
  arquivo: string;
  quandoEm: ISODateTime;
  totalProdutos: number;
}
