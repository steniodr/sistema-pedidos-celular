# Modelo de Excel do pedido

Os arquivos do molde oficial ficam aqui, com os nomes exatos:

    modelo_pedido_30.xlsx   (pedidos com até 30 itens)
    modelo_pedido_70.xlsx   (pedidos com 31 a 70 itens)

ambos na aba **"Pedido"**. O app escolhe qual dos dois carregar pela
quantidade de itens do pedido (`caminhoModeloPara` em `src/features/export/excel.ts`):
até 30 itens usa o molde de 30; acima disso, o de 70. Isso existe porque o
Excel real não duplica linha (ver LEIA-ME abaixo) — cada faixa de tamanho
precisa do próprio arquivo já com a quantidade de linhas de item pronta.

O app preenche as células e preserva toda a formatação original (bordas,
mesclagens) — exceto a fórmula da coluna de total dos itens (ver linha abaixo:
fórmula compartilhada nessa coluna corrompia o arquivo ao serializar pedidos
com mais de 2 itens; o app grava o valor já calculado ali em vez de tentar
preservar a fórmula).

**Este arquivo fica fora do precache do service worker de propósito.** Ele é
buscado com a estratégia `NetworkFirst` (sempre tenta a rede primeiro; só usa a
cópia em cache quando o celular está genuinamente offline). Isso significa que
trocar este arquivo e rodar `npm run build`/`npm run preview` de novo já é
suficiente para o app pegar a versão nova — não fica preso atrás de um service
worker antigo instalado no navegador. Se mesmo assim continuar aparecendo a
versão anterior, é cache do próprio navegador: dê um Ctrl+Shift+R (ou limpe os
dados do site) uma vez.

**Enquanto o arquivo certo não estiver aqui** (ou se o pedido tiver mais
produtos do que os 70 que o maior molde comporta), a exportação continua
funcionando: o app monta uma planilha equivalente do zero (mesmo cabeçalho,
mesmas colunas, mesmo rodapé).

## A tabela de itens de cada arquivo pode mudar de tamanho livremente

Para cada um dos dois arquivos, o app **não usa números de linha fixos** para
achar onde a tabela de itens termina. Ele escaneia a coluna A a partir da
primeira linha de item (11) procurando o texto "Subtotal" — que já vem nativo
no molde, mesclado A:G com o valor em H, e a linha "Desconto" logo abaixo no
mesmo formato — e calcula a posição do rodapé (Forma de solicitação / Data /
Representante / Valor do pedido) a partir daí.

**Ou seja: para aumentar ou diminuir a quantidade de linhas de item, basta
editar a planilha.** Não precisa avisar para ajustar código, desde que a
estrutura continue seguindo o padrão:

1. Linhas de item (uma abaixo da outra, a partir da linha 11)
2. Linha "Subtotal" (rótulo mesclado A:G, valor em H)
3. Linha "Desconto..." logo em seguida (mesmo formato)
4. Linha de rodapé com "FORMA DE SOLICITAÇÃO" / "DATA" / "REPRESENTANTE" / "VALOR DO PEDIDO"
5. As 2 linhas de valor do rodapé logo abaixo

Os únicos campos que o app sempre sobrescreve com o valor do pedido (perdendo o
texto/fórmula original do molde) são: MARCA, Pedido n°, dados do cliente,
condição de pagamento, os itens em si (incluindo a coluna de total — sempre
valor fixo, nunca fórmula, mesmo que o molde traga uma), Subtotal, Desconto, e
o rodapé inteiro (incluindo "VALOR DO PEDIDO", que no molde soma os itens sem
considerar desconto — o app substitui pelo total já descontado).

## Se a estrutura mudar de um jeito diferente disso

Confira/ajuste `src/features/export/mapaCelulas.ts` — é o único arquivo do
projeto que conhece endereços de célula (cabeçalho e colunas dos itens ainda são
fixos; só a posição do bloco de Subtotal/Desconto/rodapé é encontrada em tempo
de execução).
