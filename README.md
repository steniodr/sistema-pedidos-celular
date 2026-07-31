# Sistema de Pedidos — Arara Azul / Merko

Aplicativo para os vendedores de campo da **Arara Azul** e **Merko** montarem
pedidos direto do celular, no lugar do preenchimento manual da planilha.
Funciona **mesmo sem internet** e gera o pedido pronto em Excel e PDF, no
mesmo modelo já usado hoje pela empresa.

**Teste agora:** [sistema-pedidos-dr-system.vercel.app](https://sistema-pedidos-dr-system.vercel.app/)
— abra o link no celular e, se quiser, use a opção "Adicionar à tela
inicial" do navegador para instalar como um app normal.

## O problema que resolve

Hoje o pedido é preenchido à mão em planilha, em campo, muitas vezes sem
internet disponível no local do cliente — o que gera erro de digitação,
cálculo manual de totais e retrabalho para revisar e formatar o arquivo
depois. O app substitui esse processo por um fluxo guiado no celular:
escolher cliente, adicionar produtos com preço já cadastrado, aplicar
desconto e forma de pagamento, e finalizar — o Excel e o PDF saem prontos,
no padrão oficial da empresa, sem precisar editar nada depois.

## Como funciona na prática

- **Funciona sem internet.** O vendedor cadastra o pedido em qualquer lugar,
  mesmo sem sinal — os dados ficam salvos no próprio celular e nada se
  perde. A internet só é necessária para importar a base de preços
  atualizada e para enviar/exportar o arquivo final.
- **Não precisa instalar nada de loja de aplicativo.** É um site que se
  comporta como um app: abre o link, adiciona à tela inicial do celular e
  passa a funcionar como qualquer outro aplicativo instalado, com ícone
  próprio.
- **Base de preços sempre visível.** O app avisa quando a tabela de preços
  está desatualizada, para o vendedor saber se precisa importar uma versão
  mais recente antes de fechar um pedido importante.
- **Saída pronta para envio.** Excel e PDF já saem no layout que a empresa
  usa hoje (mesmo molde para Arara Azul e Merko), com totais, desconto e
  dados do cliente calculados automaticamente.

## Tecnologia (resumo)

Aplicativo web (PWA — Progressive Web App): roda no navegador do celular
(Android ou iPhone) sem precisar de loja de aplicativos, e guarda os dados
localmente no aparelho para funcionar offline. Não depende de um servidor
próprio rodando o tempo todo — é hospedado como um site estático em nuvem,
o que também facilita distribuir atualizações para todos os vendedores ao
mesmo tempo, sem reinstalação manual.

## Praticidade e economia

- Nenhuma licença de software, nenhuma instalação por loja de aplicativos,
  nenhum servidor dedicado para manter no ar — a solução foi pensada para
  ter o menor custo operacional possível de infraestrutura.
- Roda em qualquer celular com navegador, sem exigir aparelho específico.
- Atualizações chegam automaticamente a todos os vendedores assim que
  publicadas, sem passo manual de reinstalar o app.
- Reduz erro humano e tempo gasto formatando planilha depois do pedido
  feito em campo.

## Estado atual do projeto

O app já cobre o fluxo completo de cadastro de cliente, base de produtos,
montagem de pedido e exportação em Excel/PDF no molde oficial, incluindo
histórico de pedidos. Sincronização automática entre vendedores (nuvem) e
tela de gráficos/relatórios de vendas ainda estão planejadas como próximos
passos.

Detalhes técnicos e de organização do código: [pedidos-vendas/README.md](pedidos-vendas/README.md).
