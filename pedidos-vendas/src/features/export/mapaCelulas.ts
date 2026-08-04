import type { DadosExportacao } from "./dadosExportacao";

/**
 * Tradução campo → célula do modelo oficial (.xlsx), mapeada a partir do arquivo
 * real `public/templates/modelo_pedido.xlsx`, aba "Pedido" (a aba com o rodapé de
 * 4 colunas — Forma de solicitação / Data / Representante / Valor do pedido —
 * usado para os dois modelos MERKO/ARARA AZUL).
 *
 * ⚠ Este é o ÚNICO arquivo que conhece endereços de célula. Sempre a célula MESTRE
 * de cada intervalo mesclado — escrever numa célula não-mestre não dá erro no
 * ExcelJS, mas redireciona silenciosamente o valor para a célula mestre errada
 * (foi a causa do Excel "sair vazio" na primeira versão deste mapeamento).
 *
 * Coluna de condição de pagamento (F7) reaproveita a própria célula do rótulo —
 * no arquivo original ela funciona como placeholder/dropdown que é sobrescrito
 * ao preencher, então não há uma célula de valor separada pra esse campo.
 *
 * A fórmula original de "VALOR DO PEDIDO" soma os totais das linhas (incluindo as
 * próprias linhas de Subtotal/Desconto — um jeito estranho de somar que o molde já
 * traz) sem aplicar desconto de verdade; sobrescrevemos essa célula com o total já
 * descontado calculado pelo app.
 *
 * O usuário já mudou a quantidade de linhas de item do molde 3 vezes durante o
 * desenvolvimento. Por isso, `itens.ultimaLinha` aqui NÃO é usado diretamente —
 * é só um valor de referência/fallback. Em tempo real, `excel.ts` localiza a
 * linha "Subtotal" de verdade dentro do arquivo carregado (ela já vem nativa no
 * molde, mesclada A:G com o valor em H) e calcula tudo a partir dali: Subtotal,
 * Desconto e o rodapé inteiro são posições RELATIVAS a essa linha encontrada, não
 * endereços fixos. Se o usuário aumentar/diminuir a tabela de itens de novo, o
 * app se ajusta sozinho, sem precisar editar este arquivo.
 */

export interface ColunasItem {
  item: string;
  qtd: string;
  embalagem: string;
  descricaoProduto: string;
  cor: string;
  padraoComplemento: string;
  valorUnit: string;
  total: string;
}

/** Célula relativa à linha do Subtotal (0 = a própria linha do Subtotal). */
export interface CampoRelativo {
  coluna: string;
  deltaLinha: number;
  resolver: (d: DadosExportacao) => string | number;
}

export interface MapaModelo {
  /** Nome da aba do pedido; vazio usa a primeira aba do arquivo. */
  aba: string;
  /** Célula → texto a escrever, resolvido a partir dos dados do pedido. */
  cabecalho: Record<string, (d: DadosExportacao) => string | number>;
  itens: {
    primeiraLinha: number;
    /** Só usado se o app não conseguir achar a linha "Subtotal" no arquivo. */
    ultimaLinhaFallback: number;
    colunas: ColunasItem;
  };
  /** Texto que identifica a linha de Subtotal, procurado na coluna A. */
  textoSubtotal: string;
  /** Colunas do bloco de itens usadas pelo rótulo/valor de Subtotal e Desconto. */
  totalizadores: {
    colunaLabelInicio: string;
    colunaLabelFim: string;
    colunaValorInicio: string;
    colunaValorFim: string;
  };
  /** Campos do rodapé, em linhas relativas à linha do Desconto (Subtotal + 1). */
  rodape: CampoRelativo[];
}

export const MAPA_PADRAO: MapaModelo = {
  aba: "Pedido",
  cabecalho: {
    C2: (d) => d.marca,
    G2: (d) => d.numero,
    D3: (d) => d.cliente.nome,
    G3: (d) => d.cliente.codigoCliente,
    D4: (d) => d.cliente.cpfCnpj,
    G4: (d) => d.cliente.telefone,
    D5: (d) => d.cliente.endereco,
    G5: (d) => d.cliente.bairro,
    D6: (d) => d.cliente.cidadeEstado,
    G6: (d) => d.cliente.cep,
    D7: (d) => d.cliente.transportadora,
    F7: (d) => d.cliente.condicaoPagamento,
    D8: (d) => d.cliente.obsGerais,
  },
  itens: {
    primeiraLinha: 11,
    ultimaLinhaFallback: 60,
    colunas: {
      item: "A",
      qtd: "B",
      embalagem: "C",
      descricaoProduto: "D",
      cor: "E",
      padraoComplemento: "F",
      valorUnit: "G",
      total: "H",
    },
  },
  textoSubtotal: "Subtotal",
  totalizadores: {
    colunaLabelInicio: "A",
    colunaLabelFim: "G",
    colunaValorInicio: "H",
    colunaValorFim: "H",
  },
  // Linha do rótulo = linhaDesconto + 1 (FORMA DE SOLICITAÇÃO/DATA/REPRESENTANTE/
  // VALOR DO PEDIDO) — nunca sobrescrita, o molde tem uma célula de valor de
  // verdade pra cada uma na linha de baixo (deltaLinha 2); e-mail do
  // representante fica ainda uma linha abaixo (3).
  rodape: [
    { coluna: "A", deltaLinha: 2, resolver: (d) => d.formaSolicitacao },
    { coluna: "D", deltaLinha: 2, resolver: (d) => d.dataPedido },
    {
      coluna: "E",
      deltaLinha: 2,
      resolver: (d) => [d.representante.nome, d.representante.telefone].filter(Boolean).join(" · "),
    },
    { coluna: "E", deltaLinha: 3, resolver: (d) => d.representante.email },
    { coluna: "G", deltaLinha: 2, resolver: (d) => d.totais.total },
  ],
};
