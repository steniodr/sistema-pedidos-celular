# Modelo de Excel do pedido

O arquivo do molde oficial fica aqui, com o nome exato:

    modelo_pedido.xlsx

na aba **"Pedido"**. O app carrega esse arquivo ao exportar, preenche as células
e preserva toda a formatação original (bordas, mesclagens, fórmulas).

**Este arquivo fica fora do precache do service worker de propósito.** Ele é
buscado com a estratégia `NetworkFirst` (sempre tenta a rede primeiro; só usa a
cópia em cache quando o celular está genuinamente offline). Isso significa que
trocar este arquivo e rodar `npm run build`/`npm run preview` de novo já é
suficiente para o app pegar a versão nova — não fica preso atrás de um service
worker antigo instalado no navegador. Se mesmo assim continuar aparecendo a
versão anterior, é cache do próprio navegador: dê um Ctrl+Shift+R (ou limpe os
dados do site) uma vez.

**Enquanto o arquivo não estiver aqui** (ou se tiver mais produtos do que o
molde comporta), a exportação continua funcionando: o app monta uma planilha
equivalente do zero (mesmo cabeçalho, mesmas colunas, mesmo rodapé).

## A tabela de itens pode mudar de tamanho livremente

O app **não usa números de linha fixos** para achar onde a tabela de itens
termina. Ele escaneia a coluna A a partir da primeira linha de item (11)
procurando o texto "Subtotal" — que já vem nativo no molde, mesclado A:G com o
valor em H, e a linha "Desconto" logo abaixo no mesmo formato — e calcula a
posição do rodapé (Forma de solicitação / Data / Representante / Valor do
pedido) a partir daí.

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
condição de pagamento, os itens em si, Subtotal, Desconto, e o rodapé inteiro
(incluindo "VALOR DO PEDIDO", que no molde soma os itens sem considerar
desconto — o app substitui pelo total já descontado).

## Se a estrutura mudar de um jeito diferente disso

Confira/ajuste `src/features/export/mapaCelulas.ts` — é o único arquivo do
projeto que conhece endereços de célula (cabeçalho e colunas dos itens ainda são
fixos; só a posição do bloco de Subtotal/Desconto/rodapé é encontrada em tempo
de execução).
