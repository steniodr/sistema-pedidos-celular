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
    home/      tela inicial — atalhos, indicador de base, pedidos recentes
    clientes/  lista, cadastro/edição, clientes de teste
    produtos/  base de preços: listagem, edição/exclusão manual, importação
    pedidos/   novo pedido, itens, resumo, finalização e histórico
    export/    geração do .xlsx (molde real + gerador alternativo) e do .pdf
    config/    dados do representante, atalho de importação
```

### Pontos de extensão

| O que | Onde |
|---|---|
| Mapeamento de campos do Excel oficial | `src/features/export/mapaCelulas.ts` (único arquivo que conhece endereços de célula) |
| Modelo `.xlsx` oficial | `public/templates/modelo_pedido.xlsx` — veja o LEIA-ME da pasta |
| Formato de importação da base de produtos | `src/features/produtos/importarPlanilha.ts` |
| Listas fixas (condição de pagamento, forma de solicitação) | `src/domain/condicoesPagamento.ts`, `src/domain/formasSolicitacao.ts` |
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
"Outro", lista com ícone de edição, exclusão, clientes de teste (Configurações).

**Produtos** — importação com prévia, formato matriz ou lista, base editável
(criar/editar/excluir produto na mão, além da importação), indicador de base
desatualizada (verde ≤30 dias, amarelo 30–60, vermelho >60 — só alerta, nunca
bloqueia).

**Pedido** — marca em texto livre, busca de produto só por nome (com escolha de
variante quando há mais de uma), embalagem em chips com opção "Outro", embalagem
e valor obrigatórios, quantidade com botões −/+, desconto em % ou R$ com motivo
opcional, forma de solicitação como lista fixa, histórico com filtro por
marca/cliente/status, duplicar e reenviar pedido, botões "Salvar rascunho" e
"Voltar ao início".

**Exportação** — Excel no molde oficial (com fallback e adaptação automática de
capacidade, ver acima) e PDF com bloco de cliente e bloco de totais estilizados
nas cores da marca, tabela de itens com listras zebradas.

**Visual** — gradiente da marca na Tela Inicial, status do pedido colorido
(Rascunho em amarelo, Enviado em verde).

87 testes automatizados (`npm test`), incluindo testes contra o arquivo real do
molde Excel (`excel.modelo.test.ts`).

Fase 3 (sincronização com Supabase) e a tela de gráficos (produtos mais vendidos)
ainda não foram iniciadas — ficaram combinadas como próximos passos.
