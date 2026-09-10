/**
 * Número da versão mostrado no rodapé da Tela Inicial e o histórico de
 * novidades por trás do ícone (i). Atualizar os dois a cada versão publicada
 * — nada aqui é gerado automaticamente a partir de commits/PRs.
 */

export const VERSAO_APP = "2.0";

export interface EntradaChangelog {
  versao: string;
  data: string;
  itens: string[];
}

/** Mais recente primeiro. */
export const CHANGELOG: EntradaChangelog[] = [
  {
    versao: "2.0",
    data: "2026-09-10",
    itens: [
      "Visual novo em todo o app: cada tela abre com uma capa que já mostra o número que importa, os campos ficam agrupados em painéis, e há ícones e logo próprios. As listas (Histórico, Clientes, Produtos, Check-in) passaram a ter o mesmo formato — uma linha por registro, com um menu “⋯” para as ações.",
      "Marcas agora são cadastro: a Tela Inicial → “Cadastros” reúne Clientes, Produtos e Marcas. No pedido, a marca é escolhida numa lista (com atalho “+ Cadastrar nova marca”); pedidos antigos viram cadastro sozinhos, sem perder nada.",
      "Orçamento: em Finalizar, “Exportar” → “Salvar como orçamento e voltar” mostra um card para conferir o código (ex.: ORC04) e confirmar. O orçamento entra na hora nos Relatórios; depois dá para “Converter em pedido”. Substitui a antiga caixa “Somente orçamento”.",
      "Histórico e Tela Inicial: orçamento aparece como “Orçado” (no mesmo tom do rascunho), não mais como “Enviado” verde — que passava ideia de venda fechada.",
      "Relatórios: recorte “Orçados” separado de “Reais” e “Teste” — orçamentos têm o próprio relatório e nunca entram nos números de venda. No Histórico, o total do topo também deixa orçamento e pedido de teste de fora (eles continuam na lista, com etiqueta).",
      "Relatórios: nova visão “Por marca”, filtro com várias marcas de uma vez e grupos de marcas (ex.: “Empresa A”); período por tipo (Semana/Mês) com setas para navegar e opção de somar mais de um mês ou semana no mesmo relatório.",
      "Relatórios: corrigida a diferença entre o “Total vendido” do card e o total do gráfico — o desconto do pedido passa a ser rateado entre os itens, então a soma por produto/categoria bate com o card.",
      "Configurações: “Marcas nos relatórios” decide quais marcas entram nos números (as desligadas somem até de “Tudo”) e monta os grupos; os botões de dados de teste viraram um “Ambiente de teste” só, com um Relatório de teste (várias semanas e meses em 3 marcas) que nunca aparece nos números reais.",
      "Cadastro de cliente: endereço e contato num painel que só abre quando precisa; cidade e UF em campos separados; sair com alteração não salva pede confirmação.",
      "Se o app é atualizado com a aba aberta, exportar ou importar não falha mais em silêncio — aparece um aviso “Recarregar” explicando que a aba está velha.",
    ],
  },
  {
    versao: "1.10",
    data: "2026-09-09",
    itens: [
      "Tela do pedido: botão de edição (✎) no bloco de cliente/marca — permite trocar a marca e o cliente vinculado a um pedido já criado, sem precisar excluir e começar de novo",
    ],
  },
  {
    versao: "1.9",
    data: "2026-08-18",
    itens: [
      "Finalizar pedido: novo checkbox \"Somente orçamento\" logo abaixo do número do pedido — dispensa o número (gera um código próprio, ex.: \"ORC01\") e não conta nos totais de Relatórios, igual aos pedidos de teste; continua podendo ser exportado em Excel/PDF normalmente, usando o código no lugar do número. Ao desmarcar, volta a sugerir o próximo número de pedido disponível (editável)",
    ],
  },
  {
    versao: "1.8",
    data: "2026-08-05",
    itens: [
      "Relatórios: tela reformulada — alterna entre visão \"Por produto\" (agrupado por Categoria, com detalhe de quais produtos mais venderam dentro dela) e \"Por cliente\"; gráfico de rosca colorido com a distribuição geral e legenda clicável, e gráfico de linha mostrando a evolução ao longo do tempo ao detalhar uma categoria, produto ou cliente específico",
      "Base de produtos: novo campo Categoria (capturado automaticamente da planilha de preços), usado pelo agrupamento de Relatórios — produto sem categoria (base antiga, ainda não reimportada) entra como \"Sem categoria\"",
    ],
  },
  {
    versao: "1.7",
    data: "2026-08-05",
    itens: [
      "Adicionar item: checkbox \"Alterar nome final do produto\" — mostra um campo editável, pré-preenchido com o nome atual, pra ajustar só o texto que sai no Excel/PDF; embalagem, preço e o nome na base de produtos continuam intactos",
    ],
  },
  {
    versao: "1.6",
    data: "2026-08-05",
    itens: [
      "Exportar Excel: molde oficial agora é escolhido pelo tamanho do pedido — até 30 itens usa modelo_pedido_30.xlsx, de 31 a 70 usa modelo_pedido_70.xlsx (antes era um arquivo só, com capacidade fixa)",
      "Base de produtos: novo campo Variação (tamanho/tipo, ex.: “#08”, “médio”), independente de Detalhes — Textura rústica/arranhado e as famílias de Arenito (glitz, especial) ganham uma etapa extra pra escolher a variação, que passa a aparecer no nome exportado (ex.: “Arenito glitz médio”)",
      "Cadastro de cliente: CPF/CNPJ deixou de ser obrigatório — dá pra cadastrar um cliente ainda em fase de orçamento, com o documento capturado depois; finalizar/exportar o pedido só é bloqueado se o campo foi preenchido com algo inválido, nunca por estar vazio",
    ],
  },
  {
    versao: "1.5",
    data: "2026-08-04",
    itens: [
      "Exportar PDF: corrigido texto de Cor/Padrão-Complemento (e qualquer outro campo) vazando por cima da coluna vizinha quando muito longo — agora quebra em até 2 linhas e corta com \"...\" se ainda não couber",
    ],
  },
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
