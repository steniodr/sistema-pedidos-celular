/**
 * Entidades do app, mapeadas da especificação técnica (seções 4.1 a 4.4).
 * Datas são gravadas como ISO string para facilitar persistência e futura sincronização.
 */

export type ISODateTime = string;

export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  codigoCliente?: string;
  telefone?: string;
  endereco?: string;
  bairro?: string;
  cidadeEstado?: string;
  cep?: string;
  transportadora?: string;
  condicaoPagamento?: string;
  localEntrega?: string;
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
  itens: ItemPedido[];
  descontoTipo: DescontoTipo;
  descontoValor: number;
  /** Justificativa do desconto (quem autorizou, motivo), opcional. */
  descontoDescricao?: string;
  status: StatusPedido;
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
