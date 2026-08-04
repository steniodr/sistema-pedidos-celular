/**
 * Número da versão mostrado no rodapé da Tela Inicial e o histórico de
 * novidades por trás do ícone (i). Atualizar os dois a cada versão publicada
 * — nada aqui é gerado automaticamente a partir de commits/PRs.
 */

export const VERSAO_APP = "1.4";

export interface EntradaChangelog {
  versao: string;
  data: string;
  itens: string[];
}

/** Mais recente primeiro. */
export const CHANGELOG: EntradaChangelog[] = [
  {
    versao: "1.4",
    data: "2026-08-04",
    itens: [
      "Exportar PDF: coluna \"Padrão/Compl.\" na tabela de itens, igual ao Excel — antes só saía no Excel",
    ],
  },
  {
    versao: "1.3",
    data: "2026-08-04",
    itens: [
      "Finalizar pedido: número do pedido editável, com aviso se já existe outro pedido com o mesmo número",
      "Finalizar pedido: transportadora e local de entrega vêm pré-preenchidos do cadastro do cliente e podem ser editados só para aquele pedido",
      "Item com desconto: a descrição \"Valor promocional\" agora vai no campo Padrão/Complemento (aparece no Excel/PDF), não mais numa observação que ficava só como comentário invisível na planilha",
      "Telefone do representante em Finalizar pedido agora aparece com a máscara (xx) xxxxx-xxxx / (xx) xxxx-xxxx, como nos outros cadastros",
      "Excel: corrigido bug que sobrescrevia os rótulos \"FORMA DE SOLICITAÇÃO\" e \"DATA\" do rodapé — o valor agora vai na célula certa, uma linha abaixo",
      "Excel: corrigido travamento ao exportar pedidos com 3 ou mais itens (fórmula compartilhada do molde quebrava a geração do arquivo)",
      "Check-in: campo de Data (além do horário), editável, padrão o dia atual — permite registrar uma visita retroativa",
      "Atalho \"Check-in\" na Tela Inicial agora é um botão do mesmo tamanho de \"Novo pedido\"",
    ],
  },
  {
    versao: "1.2",
    data: "2026-08-03",
    itens: [
      "Nova tela Check-in: registra a visita ao cliente (horário editável, padrão a hora atual), com exportação em PDF/texto agrupada por data — o horário sai do pedido e passa a viver aqui",
      "Pedido: item pode ser marcado como \"com desconto\" (valor promocional avulso), que fica de fora do cálculo do desconto geral do pedido",
      "Finalizar pedido: condição de pagamento vem pré-preenchida do cadastro do cliente e pode ser editada só para aquele pedido",
      "Excel: quando sai no modelo padrão em vez do oficial, um aviso explica o motivo (sem internet/molde ainda não baixado, ou pedido com mais itens do que o molde comporta) — o app também tenta baixar o molde assim que abre, não só na hora de exportar",
    ],
  },
  {
    versao: "1.1",
    data: "2026-08-03",
    itens: [
      "Dados de teste (Configurações) ficam marcados e nunca mais entram nos totais de Relatórios — e agora dá para removê-los todos de uma vez",
      "Excluir cliente/produto/pedido, restaurar backup e o aviso de base de preços crítica usam o visual do próprio app, em vez do alerta do navegador",
      "Histórico: filtro por período com calendário (dia, semana ou mês) e os demais filtros agrupados num painel, com contador de filtros ativos",
      "Finalizar pedido: Exportar Excel/PDF fica fixo na parte de baixo da tela",
      "Importar clientes/produtos: mapeamento de colunas some quando a planilha é reconhecida automaticamente (só aparece se precisar ajustar)",
    ],
  },
  {
    versao: "1.0",
    data: "2026-08-03",
    itens: [
      "Relatórios de vendas: total, ticket médio e produtos mais vendidos, filtrando por semana/mês, cliente e marca",
      "Importação de clientes por planilha — atualiza quem já existe pelo CPF/CNPJ, sem duplicar nem apagar",
      "Backup: baixar e restaurar toda a base do aparelho (clientes, produtos e pedidos) em um arquivo",
      "Excluir cliente, produto ou pedido agora tem \"Desfazer\"",
      "Exportar o histórico em PDF, agrupado por data",
      "Aviso extra ao finalizar pedido com a base de preços muito desatualizada",
    ],
  },
];
