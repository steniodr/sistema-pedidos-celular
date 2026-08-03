/**
 * Número da versão mostrado no rodapé da Tela Inicial e o histórico de
 * novidades por trás do ícone (i). Atualizar os dois a cada versão publicada
 * — nada aqui é gerado automaticamente a partir de commits/PRs.
 */

export const VERSAO_APP = "1.0";

export interface EntradaChangelog {
  versao: string;
  data: string;
  itens: string[];
}

/** Mais recente primeiro. */
export const CHANGELOG: EntradaChangelog[] = [
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
