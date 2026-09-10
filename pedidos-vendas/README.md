# App de Pedidos (PWA)

Aplicativo instalável para vendedores em campo criarem pedidos **offline**, no
celular, e exportarem em Excel (.xlsx) e PDF — no molde oficial da empresa (mesmo
molde para MERKO e ARARA AZUL). Substitui o preenchimento manual da planilha de
pedidos.

Base: [documentation/especificacao_tecnica_app_merko.docx](documentation/especificacao_tecnica_app_merko.docx).

## Rodar

```sh
npm install
npm run dev              # desenvolvimento
npm run build            # checagem de tipos + build de produção
npm run preview --host   # build + servidor local, acessível pelo IP na rede (testar no celular)
npm test                 # testes unitários e de tela
```

## Como está organizado

```
src/
  domain/      tipos, cálculos do pedido, CPF/CNPJ, listas fixas, agregações de relatório — regras puras, sem React
  db/          schema do Dexie (IndexedDB), com migração de versão
  data/        interface Repository + implementação Dexie + provider React
  components/  kit de UI: botão, campo, select+outro, chips, sheet, toast, confirm,
               e o "redesenho" 2.0 — Tela com capa, Painel, LinhaLista, Etiqueta,
               Esqueleto, Passos, ZonaDeRisco, Logo, ícones (redesenho.module.css)
  pwa.ts       registro do service worker, checagem periódica de atualização
  versaoApp.ts número da versão exibida na Home + changelog
  features/
    home/        tela inicial — atalhos, indicador de base, pedidos recentes
    bases/       hub "Cadastros": Clientes, Produtos e Marcas num lugar só
    marcas/      cadastro de marcas (lista + form); a marca do pedido sai daqui
    clientes/    lista, cadastro/edição, importação em lote
    produtos/    base de preços: listagem, edição/exclusão manual, importação
    pedidos/     novo pedido, itens, resumo, finalização e histórico
    checkin/     check-in de visita ao cliente (horário) e exportação por data
    relatorios/  vendas por período (semana/mês/tudo, com navegação e soma de
                 períodos), recorte Reais/Orçados/Teste, visão por produto
                 (categoria → produtos), por cliente ou por marca, com gráfico
                 de rosca e linha do tempo no detalhe; + o Relatório de teste
    export/      geração do .xlsx (molde real + gerador alternativo) e do .pdf
    config/      representante, backup, Ambiente de teste, "Marcas nos relatórios"
```

### Pontos de extensão

| O que | Onde |
|---|---|
| Mapeamento de campos do Excel oficial | `src/features/export/mapaCelulas.ts` (único arquivo que conhece endereços de célula) |
| Modelos `.xlsx` oficiais | `public/templates/modelo_pedido_30.xlsx` (até 30 itens) e `modelo_pedido_70.xlsx` (31 a 70 itens) — veja o LEIA-ME da pasta |
| Formato de importação da base de produtos | `src/features/produtos/importarPlanilha.ts` |
| Formato de importação da base de clientes | `src/features/clientes/importarClientesPlanilha.ts` (aliases de coluna por campo — ajustar se o molde da planilha mudar) |
| Detecção de coluna por planilha (compartilhada entre os dois importadores acima) | `src/domain/planilha.ts` |
| Listas fixas (condição de pagamento, forma de solicitação) | `src/domain/condicoesPagamento.ts`, `src/domain/formasSolicitacao.ts` |
| Métricas do relatório de vendas | `src/domain/relatorios.ts` — funções puras, sem I/O |
| Recorte dos Relatórios (Reais/Orçados/Teste) e visibilidade de marca | filtro `enviados` em `src/features/relatorios/RelatoriosPage.tsx` |
| Quais marcas contam nos números / grupos de marcas | `src/features/config/MarcasRelatorioPage.tsx` (`visivelEmRelatorios`, `listarGruposMarca`) |
| Conjunto fictício do Relatório de teste | `src/features/relatorios/relatoriosTeste.ts` |
| Lista simples do check-in (PDF/texto, agrupada por data) | `src/features/checkin/exportarCheckIns.ts` |
| Número da versão e changelog exibidos na Tela Inicial | `src/versaoApp.ts` — atualizar à mão a cada release |
| Sincronização futura (Supabase) | implementar `Repository` em `src/data/` e trocar no `RepositoryProvider` |

### Importação da base de produtos

O arquivo de preços é uma **matriz**: uma linha por produto (Categoria, Produto,
Detalhes) e uma coluna por embalagem (Galão, Lata, Tambor…), com o preço na célula
— vazia quando a combinação não existe. O importador detecta esse formato
automaticamente e explode cada linha em uma combinação produto+embalagem por
coluna preenchida. Também aceita, como alternativa, uma lista simples de 3 colunas
(descrição, embalagem, valor) — o detector escolhe o formato pelo número de
colunas do cabeçalho. Produto tem `nome`, `categoria` (a própria coluna
"Categoria" da planilha, capturada de verdade — antes só era usada pra
detectar as colunas de preço, agora também é gravada), `detalhes`
(variante/observação, ex.: diferença de preço por cor) e `variacao`
(tamanho/tipo que **não** muda o preço, ex.: "#08", "médio") separados no
banco — `detalhes` nunca aparece na exportação, `variacao` aparece somada ao
nome quando o item tiver uma (ver "Exportação em Excel" abaixo), e
`categoria` alimenta o agrupamento em Relatórios (produto sem categoria —
base ainda não reimportada com a coluna — entra como "Sem categoria"). Ao
montar o pedido, se um nome tiver mais de uma variante (`detalhes` diferente)
e/ou mais de uma variação, o vendedor escolhe qual antes de ver
embalagem/preço — cada etapa só aparece quando o produto realmente tem mais
de uma opção.

### Importação da base de clientes

Diferente da base de produtos (que é **substituída** por inteiro a cada
importação), a importação de clientes faz **upsert por CPF/CNPJ**: uma linha
cujo CPF/CNPJ (normalizado, sem máscara) já existe atualiza o cadastro
existente (mantendo `id`/data de criação e só sobrescrevendo campos que vieram
preenchidos na planilha); uma linha nova cria um cliente. Nenhum cliente
existente é apagado — pedidos já feitos referenciam clientes por `id`, e um
"substituir tudo" como o de produtos os deixaria órfãos.

A planilha é sempre uma **lista** (uma linha por cliente; não existe formato
matriz aqui). A detecção de coluna é por lista de aliases (mesmo mecanismo do
importador de produtos, extraído para `src/domain/planilha.ts`), testada
contra o relatório real "BR TINTAS - BASE DE CLIENTES". Linha sem nome ou sem
CPF/CNPJ válido é ignorada (aparece na conferência antes de confirmar, com o
motivo). Um campo `situacao` (texto livre vindo da planilha, ex. "Ativo",
"Inativo") é só importado e exibido como uma tag na lista de clientes — nunca
filtra nem bloqueia nada.

### Exportação em Excel — como o app se adapta ao molde oficial

Há dois arquivos de molde: `public/templates/modelo_pedido_30.xlsx` (pedidos
com até 30 itens) e `modelo_pedido_70.xlsx` (31 a 70 itens), ambos na aba
"Pedido" — juntos, são a fonte de verdade do layout. `gerarExcel`
(`caminhoModeloPara` em `src/features/export/excel.ts`) escolhe qual dos dois
carregar pela quantidade de itens do pedido; existem dois arquivos em vez de
um só porque o ExcelJS não permite duplicar linha com segurança (ver abaixo),
então cada faixa de tamanho já vem com a quantidade de linhas de item pronta.

Dentro de cada arquivo, o app **não usa endereços de linha fixos** para o
bloco de itens: ele escaneia a coluna A a partir da primeira linha de item
procurando o texto "Subtotal" (que já vem nativo no molde, junto com
"Desconto" logo abaixo) e calcula a partir daí a capacidade de produtos e a
posição do rodapé (Forma de solicitação / Data / Representante / Valor do
pedido). Isso significa que aumentar ou diminuir a tabela de itens em um dos
arquivos `.xlsx` **não exige alterar o código** — só o número de linhas
hardcoded como fallback em `mapaCelulas.ts` (`ultimaLinhaFallback`), usado
apenas se a busca por "Subtotal" falhar.

Se o pedido tiver mais produtos do que a capacidade do molde escolhido (hoje,
mais de 70 — além do que o maior dos dois comporta), o app não tenta duplicar
linha nele — o ExcelJS não realoca mesclagens já existentes abaixo do ponto de
inserção (o rodapé e o bloco de revisão do molde ficariam presos no lugar
antigo), e isso nem sempre lança exceção, às vezes só redireciona a escrita
para a célula errada em silêncio. Nesse caso, o app cai automaticamente no
gerador alternativo (`construirDoZero`, monta uma planilha equivalente do
zero), o mesmo usado quando o arquivo do molde não está disponível.

Os `.xlsx` dos moldes ficam **fora do precache do service worker** de
propósito — só o bundle do app é precacheado. Cada molde é buscado com
`NetworkFirst` (sempre tenta a rede primeiro; só usa cache quando genuinamente
offline), para que trocar os arquivos em produção não fique preso atrás de um
service worker antigo. Por isso `src/main.tsx` já dispara uma busca dos dois
moldes assim que o app abre (não só na hora de exportar), pra maximizar a
chance de já estarem em cache quando o vendedor for exportar sem internet
depois. Quando mesmo assim a exportação cai no gerador alternativo — molde
indisponível ou pedido com mais itens do que a capacidade do maior molde —
`gerarExcel` (`src/features/export/excel.ts`)
devolve o motivo (`usouModelo`/`motivoFallback`) e `FinalizarPedidoPage` mostra
um toast explicando qual dos dois casos aconteceu, em vez de só dizer "Excel
gerado." sem indicar qual modelo foi usado.

Os arquivos exportados (Excel e PDF) mostram o **nome** do produto — ou o
`nomeExportado`, quando o vendedor marcou "Alterar nome final do produto" na
tela do item para ajustar só esse texto, sem tocar em `nomeProduto`/na base —
seguido da **variação** de tamanho/tipo quando o item tiver uma (ex.: "Arenito
glitz médio"). `detalhes` (a variante de preço, ex.: diferença de cor) nunca
aparece; fica visível só dentro do app (tela do pedido, resumo). A composição
final é feita em `montarDadosExportacao` (`src/features/export/dadosExportacao.ts`).

### Atualização do service worker (PWA)

O app instalado na tela inicial costuma ficar aberto muito tempo sem uma
navegação de verdade, e o navegador só checa atualização do service worker em
certas navegações — então o modo `autoUpdate` do vite-plugin-pwa às vezes
nunca chegava a aplicar a versão nova (só resolvia apagando e reinstalando o
app). Por isso `registerType` é `"prompt"` e o registro é feito à mão em
`src/pwa.ts`, com três mecanismos: checagem periódica (a cada 1h) enquanto o
app está aberto, um toast "Atualizar agora" quando uma versão nova é
detectada, e um botão "Verificar atualizações" em Configurações que força a
checagem e aplica na hora. `injectRegister: false` em `vite.config.ts` porque
o registro não é mais o script injetado automaticamente pelo plugin.

## Estado atual

Fases 1 e 2 da especificação original estão implementadas, mais várias rodadas
de ajustes após uso real do app e, na **2.0**, um redesenho de todas as telas
(capa com o número que importa em primeiro plano, campos em painéis, listas
padronizadas, ícones e logo próprios):

**Cadastros** — a Tela Inicial → **"Cadastros"** (`src/features/bases/`) reúne
Clientes, Produtos e **Marcas** num hub só, cada linha com o total e a data da
última importação.

**Clientes** — cadastro com CPF/CNPJ **opcional** (útil pra cadastrar cliente
ainda em fase de orçamento, com o documento capturado depois); quando
preenchido, é validado por dígito verificador e bloqueia finalizar/exportar o
pedido se for inválido — nunca bloqueia por estar vazio, nem impede salvar o
rascunho do cadastro. Endereço e contato ficam num painel que só abre quando
precisa; **cidade e UF em campos separados** (gravados juntos em `cidadeEstado`,
no mesmo formato da importação); sair do cadastro com alteração não salva pede
confirmação. Condição de pagamento como lista fixa (42 opções) com opção
"Outro", lista no formato de linha padrão (essencial à esquerda, ações no menu
"⋯"), busca com debounce, ordenação (Nome/Recentes), **importação em lote por
planilha** (upsert por CPF/CNPJ, ver seção acima), tag de situação
(Ativo/Inativo/Atenção) na lista quando vem da planilha, campos `nomeFantasia`
e `contato` no cadastro. Excluir avisa quantos pedidos ficam sem o nome do
cliente antes de confirmar, e oferece "Desfazer" logo depois.

**Marcas** — deixaram de ser texto livre: viram cadastro (`src/features/marcas/`),
com lista e formulário. No pedido a marca é escolhida numa lista, com atalho
"+ Cadastrar nova marca". Pedidos antigos (marca só em texto) são convertidos
em cadastro automaticamente na primeira vez que a base de marcas é lida, sem
perder nada. Cada marca tem `visivelEmRelatorios` (ver "Relatórios") e pode ser
marcada como `teste`.

**Produtos** — importação com prévia, formato matriz ou lista, base editável
(criar/editar/excluir produto na mão, com "Desfazer", além da importação),
ordenação (Nome/Valor), indicador de base desatualizada (verde ≤30 dias, amarelo
30–90, vermelho >90 — acima de 90 dias exige uma confirmação extra ao finalizar
o pedido, mas nunca bloqueia). Campo Categoria (capturado da planilha,
opcional) usado pelo agrupamento de Relatórios. Campo Variação (tamanho/tipo,
ex.: "#08", "médio") opcional e independente de Detalhes — usado hoje pelas
famílias Textura rústica/arranhado e Arenito (glitz, especial); quando um
produto tem mais de uma variação, o vendedor escolhe qual ao montar o item, e
o valor escolhido some ao nome no Excel/PDF exportado.

**Pedido** — marca escolhida numa lista (ver "Marcas") e data do pedido
(editável em Finalizar; o horário da visita não é mais gravado no pedido, ver
"Check-in" abaixo), busca de produto só por nome (com escolha de
variante/variação quando há mais de uma), embalagem em chips com opção "Outro",
embalagem e valor obrigatórios, quantidade com botões −/+, desconto em % ou R$
com motivo opcional. Checkbox "Alterar nome final do produto" mostra um campo
editável, pré-preenchido com o nome do produto, pra ajustar só o texto que sai
no Excel/PDF — embalagem, preço e o nome na base de produtos continuam intactos.
Um item pode ser marcado como "com desconto" (valor promocional avulso, com o
campo Padrão/Complemento pré-preenchido "Valor promocional", já que esse campo
aparece no Excel/PDF) — esse item fica de fora do cálculo do desconto geral do
pedido. Na tela do pedido, o bloco de cliente/marca tem um botão de edição (✎)
pra trocar cliente ou marca de um pedido já criado, sem excluir e recomeçar.

Em Finalizar: número do pedido editável (com aviso se já existe outro pedido
com o mesmo número — bloqueia a **exportação de arquivo** até corrigir); forma
de solicitação, condição de pagamento, transportadora e local de entrega como
campos editáveis — os três últimos vêm pré-preenchidos do cadastro do cliente
ao criar o pedido, com um link "Usar do cliente" pra reaplicar se o cadastro
mudar depois, mas editar aqui nunca altera o cadastro. O botão **"Exportar"**
abre uma folha com Excel (.xlsx), PDF e **"Salvar como orçamento e voltar"**.
Essa última troca a folha por um card que mostra o próximo código de orçamento
disponível (ex.: "ORC04", contador próprio, independente do número de pedido)
pra conferir e confirmar; ao confirmar, o pedido vira orçamento
(`somenteOrcamento`), fica com status **enviado** e volta pra Tela Inicial —
aparecendo na hora no recorte "Orçados" dos Relatórios. Reabrindo um orçamento
em Finalizar, o campo mostra "Código do orçamento" (só leitura) e um link
**"Converter em pedido"** devolve um número (o próximo disponível, excluindo o
próprio pedido do cálculo). "Salvar como orçamento" fica disponível mesmo com o
número inválido/duplicado (ele descarta o número), mas continua bloqueado sem
cliente ou sem itens.

Excluir pedido (com "Desfazer"); histórico no formato de lista padrão, com
capa que já traz busca e um resumo ("R$ no filtro" — que conta só venda de
verdade, sem orçamento nem teste — e a contagem de pedidos), filtros
(status/marca/cliente/período com calendário) numa folha com contador de
filtros ativos, ordenação (Recentes/Maior valor), e Abrir/Duplicar/Reenviar no
menu "⋯" de cada linha. Excluir cliente/produto/pedido, restaurar backup e o
aviso de base de preços crítica usam um diálogo de confirmação no próprio
visual do app (`useConfirm`, `src/components/ui/Confirm.tsx`), não o alerta
nativo do navegador.

**Check-in** — tela dedicada (`src/features/checkin/`) pra registrar a visita
a um cliente, independente de existir pedido: escolhe o cliente (mesmo
seletor usado em Novo pedido), data e horário com padrão o dia/hora atual,
ambos editáveis (dá pra registrar uma visita retroativa). Lista no formato de
linha padrão, com filtro por cliente e por período (dia/semana/mês, calendário)
e excluir no menu "⋯" da linha; exportação à parte — lista simples (horário,
cliente, código do cliente) agrupada por data, em PDF ou copiada como texto
simples para a área de transferência (`src/features/checkin/exportarCheckIns.ts`)
— substitui a exportação de "histórico de visita" que antes vivia dentro do
Histórico de pedidos, já que o horário não depende mais de um pedido existir.

**Exportação** — Excel no molde oficial (com fallback e adaptação automática de
capacidade, ver acima) e PDF com bloco de cliente e bloco de totais estilizados
nas cores da marca, tabela de itens com listras zebradas (incluindo a coluna
Padrão/Complemento, igual ao Excel).

**Relatórios** — capa com total vendido, número de pedidos e ticket médio do
recorte atual. Três **recortes fechados** que nunca se misturam:
**"Reais"** (venda fechada — sem teste, sem orçamento, sem marca oculta/de
teste), **"Orçados"** (só pedidos "somente orçamento", que são cotação, não
venda) e **"Teste"** (o Ambiente de teste). O seletor só mostra os recortes que
fazem sentido (só aparece "Orçados" se há orçamento na base; "Teste" se há
Ambiente de teste).

Filtros: período por tipo (**Semana** ou **Mês**) com setas pra navegar entre
períodos e a opção de somar mais de um mês/semana no mesmo relatório, ou
**"Tudo"**; várias marcas de uma vez; **grupos de marcas**; cliente. As visões
são **"Por produto"** (agrupado por Categoria, drill-down categoria → produtos),
**"Por cliente"** e **"Por marca"**. Gráfico de rosca (donut, SVG desenhado à
mão — sem lib de gráfico) mostra a distribuição do nível atual, com legenda
clicável; clicar num item folha (produto, cliente ou marca) abre um gráfico de
linha com a evolução ao longo do período (granularidade diária num único
mês/semana, mensal quando são vários ou "Tudo" — ver `granularidadeParaSelecao`
em `src/domain/relatorios.ts`). Paleta categórica validada (colorblind-safe)
contra a superfície real do app.

Conta só pedidos com status "Enviado", e no recorte "Reais" ignora ainda os
pedidos de teste e as marcas com `visivelEmRelatorios: false` (que somem até de
"Tudo"). O desconto do pedido é **rateado entre os itens** (`valoresLiquidosItens`
em `src/domain/calculos.ts`), então a soma por produto/categoria bate com o
"Total vendido" da capa. Só reflete os pedidos deste aparelho, já que a
sincronização entre vendedores ainda não existe.

**Configurações** — dados do representante; **backup** (baixar toda a base
local — clientes, produtos, marcas, pedidos, representante — em um `.json` e
restaurar a partir de um arquivo desses, útil pra trocar de aparelho antes da
sincronização em nuvem existir); **"Marcas nos relatórios"**
(`MarcasRelatorioPage`) — liga/desliga quais marcas entram nos números e monta
os grupos de marcas usados no filtro de Relatórios; e o **"Ambiente de teste"**
(`AmbienteTestePage`) — um lugar só pros dados fictícios: gera clientes de
teste e um conjunto de pedidos espalhados por várias semanas e meses em 3
marcas de teste, com atalho pro "Relatório de teste". Clientes, pedidos e
marcas de teste ficam marcados (campo `teste` em `src/domain/types.ts`) — nunca
entram nos números reais (nem em "Tudo") e podem ser apagados de uma vez, sem
afetar cadastros reais.

**App / atualização** — rodapé da Tela Inicial mostra a versão (`v2.0`) com um
ícone que abre o changelog (`src/versaoApp.ts`); ver seção "Atualização do
service worker" acima. Além disso: os pedaços carregados sob demanda (exceljs,
jspdf, xlsx) pertencem à build que abriu a aba — se o app foi atualizado no
meio do caminho, o navegador não acha mais o arquivo e o que parecia "erro de
exportação" agora vira um aviso **"Recarregar"** (ouve `vite:preloadError` em
`src/App.tsx` e o erro de MIME em `src/domain/erros.ts`).

**Visual (2.0)** — redesenho de todas as telas: cada uma abre com uma **capa**
que já traz o número/estado que importa, os campos ficam agrupados em
**painéis** (`Painel`, colapsáveis com resumo), as listas seguem um formato
único (`LinhaLista` — essencial à esquerda, valor à direita, ações no menu
"⋯"), com **esqueletos** de carregamento, ícones e logo/tipografia próprios
(`src/components/ui/redesenho.module.css`). Status do pedido colorido: Rascunho
em amarelo, Enviado em verde e **Orçado** no mesmo tom do rascunho — "Enviado"
verde passava ideia de venda fechada, o que um orçamento não é.

267 testes automatizados (`npm test`), incluindo testes contra os arquivos reais
dos moldes Excel (`excel.modelo.test.ts`) e da base de clientes real.

Fase 3 (sincronização com Supabase) ainda não foi iniciada — é o próximo passo
maior. Cobertura de teste de tela para o fluxo de pedido (Finalizar, exclusão)
foi ampliada, mas ainda não é exaustiva; erros de armazenamento cheio já
mostram mensagem própria (`src/domain/erros.ts`), aplicada nos principais
pontos de gravação/importação, mas não em absolutamente todos.
