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
  features/
    home/        tela inicial — atalhos, indicador de base, pedidos recentes
    clientes/    lista, cadastro/edição, clientes de teste, importação em lote
    produtos/    base de preços: listagem, edição/exclusão manual, importação
    pedidos/     novo pedido, itens, resumo, finalização e histórico
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

Os arquivos exportados (Excel e PDF) mostram só o **nome** do produto, sem a
variante/detalhes — esses ficam visíveis dentro do app (tela do pedido, resumo)
mas não vazam para o arquivo final.

## Estado atual

Fases 1 e 2 da especificação original estão implementadas, mais uma rodada
extensa de ajustes pedidos após uso real do app:

**Clientes** — cadastro com validação de CPF/CNPJ (bloqueia finalizar pedido, não
bloqueia rascunho), condição de pagamento como lista fixa (42 opções) com opção
"Outro", lista com ícone de edição, exclusão, clientes de teste (Configurações),
**importação em lote por planilha** (upsert por CPF/CNPJ, ver seção acima), tag
de situação (Ativo/Inativo/Atenção) na lista quando vem da planilha, campos
`nomeFantasia` e `contato` no cadastro.

**Produtos** — importação com prévia, formato matriz ou lista, base editável
(criar/editar/excluir produto na mão, além da importação), indicador de base
desatualizada (verde ≤30 dias, amarelo 30–90, vermelho >90 — acima de 90 dias
exige uma confirmação extra ao finalizar o pedido, mas nunca bloqueia).

**Pedido** — marca em texto livre, busca de produto só por nome (com escolha de
variante quando há mais de uma), embalagem em chips com opção "Outro", embalagem
e valor obrigatórios, quantidade com botões −/+, desconto em % ou R$ com motivo
opcional, forma de solicitação como lista fixa, histórico com filtro por
marca/cliente/status, duplicar e reenviar pedido, botões "Salvar rascunho" e
"Voltar ao início".

**Exportação** — Excel no molde oficial (com fallback e adaptação automática de
capacidade, ver acima) e PDF com bloco de cliente e bloco de totais estilizados
nas cores da marca, tabela de itens com listras zebradas.

**Relatórios** — tela de vendas com filtro por período (semana atual, mês atual
ou tudo), cliente e marca; cartões de total vendido, número de pedidos e
ticket médio; lista de produtos mais vendidos (barras simples, sem lib de
gráfico — ver `src/domain/relatorios.ts`). Só conta pedidos com status
"Enviado" (rascunho não é venda fechada) e só reflete os pedidos deste
aparelho, já que a sincronização entre vendedores ainda não existe.

**Visual** — gradiente da marca na Tela Inicial, status do pedido colorido
(Rascunho em amarelo, Enviado em verde).

109 testes automatizados (`npm test`), incluindo testes contra o arquivo real do
molde Excel (`excel.modelo.test.ts`) e da base de clientes real.

Fase 3 (sincronização com Supabase) ainda não foi iniciada — é o próximo passo
maior. Backup/exportação da base local, desfazer exclusão e outras melhorias
menores seguem como ideias registradas, não priorizadas ainda.
