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
  domain/      tipos, cálculos do pedido, CPF/CNPJ, listas fixas — regras puras, sem React
  db/          schema do Dexie (IndexedDB), com migração de versão
  data/        interface Repository + implementação Dexie + provider React
  components/  kit de UI (botão, campo, select+outro, cartão, chips, sheet, toast, status)
  pwa.ts       registro do service worker, checagem periódica de atualização
  versaoApp.ts número da versão exibida na Home + changelog
  features/
    home/        tela inicial — atalhos, indicador de base, pedidos recentes
    clientes/    lista, cadastro/edição, clientes de teste, importação em lote
    produtos/    base de preços: listagem, edição/exclusão manual, importação
    pedidos/     novo pedido, itens, resumo, finalização e histórico
    checkin/     check-in de visita ao cliente (horário) e exportação por data
    relatorios/  vendas por período (semana/mês/tudo), cliente e marca
    export/      geração do .xlsx (molde real + gerador alternativo) e do .pdf
    config/      dados do representante, atalho de importação
```

### Pontos de extensão

| O que | Onde |
|---|---|
| Mapeamento de campos do Excel oficial | `src/features/export/mapaCelulas.ts` (único arquivo que conhece endereços de célula) |
| Modelo `.xlsx` oficial | `public/templates/modelo_pedido.xlsx` — veja o LEIA-ME da pasta |
| Formato de importação da base de produtos | `src/features/produtos/importarPlanilha.ts` |
| Formato de importação da base de clientes | `src/features/clientes/importarClientesPlanilha.ts` (aliases de coluna por campo — ajustar se o molde da planilha mudar) |
| Detecção de coluna por planilha (compartilhada entre os dois importadores acima) | `src/domain/planilha.ts` |
| Listas fixas (condição de pagamento, forma de solicitação) | `src/domain/condicoesPagamento.ts`, `src/domain/formasSolicitacao.ts` |
| Métricas do relatório de vendas | `src/domain/relatorios.ts` — funções puras, sem I/O |
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
colunas do cabeçalho. Produto tem `nome` e `detalhes` (variante) separados no
banco; ao montar o pedido, se um nome tiver mais de uma variante (`detalhes`
diferente), o vendedor escolhe qual antes de ver embalagem/preço.

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

`public/templates/modelo_pedido.xlsx` (aba "Pedido") é a fonte de verdade do
layout. O app **não usa endereços de linha fixos** para o bloco de itens: ele
escaneia a coluna A a partir da primeira linha de item procurando o texto
"Subtotal" (que já vem nativo no molde, junto com "Desconto" logo abaixo) e
calcula a partir daí a capacidade de produtos e a posição do rodapé (Forma de
solicitação / Data / Representante / Valor do pedido). Isso significa que
aumentar ou diminuir a tabela de itens no arquivo `.xlsx` **não exige alterar o
código** — só o número de linhas hardcoded como fallback em `mapaCelulas.ts`
(`ultimaLinhaFallback`), usado apenas se a busca por "Subtotal" falhar.

Se o pedido tiver mais produtos do que a capacidade do molde, o app não tenta
duplicar linha nele — o ExcelJS não realoca mesclagens já existentes abaixo do
ponto de inserção (o rodapé e o bloco de revisão do molde ficariam presos no
lugar antigo), e isso nem sempre lança exceção, às vezes só redireciona a
escrita para a célula errada em silêncio. Nesse caso, o app cai automaticamente
no gerador alternativo (`construirDoZero`, monta uma planilha equivalente do
zero), o mesmo usado quando o arquivo do molde não está disponível.

O `.xlsx` do molde fica **fora do precache do service worker** de propósito —
só o bundle do app é precacheado. O molde é buscado com `NetworkFirst` (sempre
tenta a rede primeiro; só usa cache quando genuinamente offline), para que
trocar o arquivo em produção não fique preso atrás de um service worker antigo.
Por isso `src/main.tsx` já dispara uma busca do molde assim que o app abre
(não só na hora de exportar), pra maximizar a chance de já estar em cache
quando o vendedor for exportar sem internet depois. Quando mesmo assim a
exportação cai no gerador alternativo — molde indisponível ou pedido com mais
itens do que a capacidade do molde — `gerarExcel` (`src/features/export/excel.ts`)
devolve o motivo (`usouModelo`/`motivoFallback`) e `FinalizarPedidoPage` mostra
um toast explicando qual dos dois casos aconteceu, em vez de só dizer "Excel
gerado." sem indicar qual modelo foi usado.

Os arquivos exportados (Excel e PDF) mostram só o **nome** do produto, sem a
variante/detalhes — esses ficam visíveis dentro do app (tela do pedido, resumo)
mas não vazam para o arquivo final.

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

Fases 1 e 2 da especificação original estão implementadas, mais uma rodada
extensa de ajustes pedidos após uso real do app:

**Clientes** — cadastro com validação de CPF/CNPJ (bloqueia finalizar pedido, não
bloqueia rascunho), condição de pagamento como lista fixa (42 opções) com opção
"Outro", lista com ícone de edição, busca com debounce, ordenação (Nome/Recentes),
clientes de teste (Configurações, marcados e removíveis de uma vez, ver
"Backup" abaixo), **importação em lote por planilha** (upsert
por CPF/CNPJ, ver seção acima), tag de situação (Ativo/Inativo/Atenção) na lista
quando vem da planilha, campos `nomeFantasia` e `contato` no cadastro. Excluir
avisa quantos pedidos ficam sem o nome do cliente antes de confirmar, e oferece
"Desfazer" logo depois.

**Produtos** — importação com prévia, formato matriz ou lista, base editável
(criar/editar/excluir produto na mão, com "Desfazer", além da importação),
ordenação (Nome/Valor), indicador de base desatualizada (verde ≤30 dias, amarelo
30–90, vermelho >90 — acima de 90 dias exige uma confirmação extra ao finalizar
o pedido, mas nunca bloqueia).

**Pedido** — marca em texto livre e data do pedido (editável em Finalizar; o
horário da visita não é mais gravado no pedido, ver "Check-in" abaixo), busca
de produto só por nome (com escolha de variante quando há mais de uma),
embalagem em chips com opção "Outro", embalagem e valor obrigatórios,
quantidade com botões −/+, desconto em % ou R$ com motivo opcional. Um item
pode ser marcado como "com desconto" (valor promocional avulso, com o campo
Padrão/Complemento pré-preenchido "Valor promocional", já que esse campo
aparece no Excel/PDF) — esse item fica de fora do cálculo do desconto geral
do pedido. Em Finalizar: número do pedido editável (com aviso se já existe
outro pedido com o mesmo número — bloqueia a exportação até corrigir), forma
de solicitação, condição de pagamento, transportadora e local de entrega
como campos editáveis — os três últimos vêm pré-preenchidos do cadastro do
cliente ao criar o pedido, com um botão "Usar do cliente" pra reaplicar se o
cadastro mudar depois, mas editar aqui nunca altera o cadastro. Excluir
pedido (com "Desfazer"), histórico com filtro por
marca/cliente/status e por período (dia, semana ou mês, com calendário)
agrupados num painel "Filtros" com contador de filtros ativos, busca com
debounce, ordenação (Recentes/Maior valor), duplicar e reenviar pedido,
botões "Salvar rascunho" e "Voltar ao início". Finalizar pedido tem os
botões de exportar Excel/PDF fixos na parte de baixo da tela. Excluir
cliente/produto/pedido, restaurar backup e o aviso de base de preços crítica
usam um diálogo de confirmação no próprio visual do app (`useConfirm`,
`src/components/ui/Confirm.tsx`), não mais o alerta nativo do navegador.

**Check-in** — tela dedicada (`src/features/checkin/`) pra registrar a visita
a um cliente, independente de existir pedido: escolhe o cliente (mesmo
seletor usado em Novo pedido), data e horário com padrão o dia/hora atual,
ambos editáveis (dá pra registrar uma visita retroativa). Lista com filtro
por cliente e por período (dia/semana/mês, calendário),
exportação à parte — lista simples (horário, cliente, código do cliente)
agrupada por data, em PDF ou copiada como texto simples para a área de
transferência (`src/features/checkin/exportarCheckIns.ts`) — substitui a
exportação de "histórico de visita" que antes vivia dentro do Histórico de
pedidos, já que o horário não depende mais de um pedido existir.

**Exportação** — Excel no molde oficial (com fallback e adaptação automática de
capacidade, ver acima) e PDF com bloco de cliente e bloco de totais estilizados
nas cores da marca, tabela de itens com listras zebradas (incluindo a coluna
Padrão/Complemento, igual ao Excel).

**Relatórios** — tela de vendas com filtro por período (semana atual, mês atual
ou tudo), cliente e marca; cartões de total vendido, número de pedidos e
ticket médio; lista de produtos mais vendidos com toggle Maior/Menor valor
(barras simples, sem lib de gráfico — ver `src/domain/relatorios.ts`). Só
conta pedidos com status "Enviado" (rascunho não é venda fechada), nunca
conta os pedidos de teste (ver "Backup" abaixo) e só reflete os pedidos
deste aparelho, já que a sincronização entre vendedores ainda não existe.

**Backup** — Configurações tem botões para baixar toda a base local (clientes,
produtos, pedidos, representante) em um `.json`, e restaurar a partir de um
arquivo desses — útil pra trocar de aparelho antes da sincronização em nuvem
existir. Configurações também tem um gerador de pedidos de teste (datas/marcas
variadas, vinculados só aos clientes de teste) só pra validar a tela de
Relatórios sem montar pedido na mão. Clientes e pedidos de teste ficam
marcados (campo `teste` em `src/domain/types.ts`) — nunca entram nos totais
de Relatórios e podem ser apagados de uma vez pelo botão "Remover dados de
teste", sem afetar cadastros reais.

**App / atualização** — rodapé da Tela Inicial mostra a versão (`v1.4`) com um
ícone (ⓘ) que abre o changelog; ver seção "Atualização do service worker" acima
sobre como o app garante que a versão instalada não fique presa numa build
antiga.

**Visual** — gradiente da marca na Tela Inicial, status do pedido colorido
(Rascunho em amarelo, Enviado em verde).

151 testes automatizados (`npm test`), incluindo testes contra o arquivo real do
molde Excel (`excel.modelo.test.ts`) e da base de clientes real.

Fase 3 (sincronização com Supabase) ainda não foi iniciada — é o próximo passo
maior. Cobertura de teste de tela para o fluxo de pedido (Finalizar, exclusão)
foi ampliada, mas ainda não é exaustiva; erros de armazenamento cheio já
mostram mensagem própria (`src/domain/erros.ts`), aplicada nos principais
pontos de gravação/importação, mas não em absolutamente todos.
