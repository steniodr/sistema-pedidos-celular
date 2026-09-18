import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { RepositoryProvider } from "./data/RepositoryContext";
import { ConfirmProvider } from "./components/ui/Confirm";
import { ToastProvider } from "./components/ui/Toast";
import { dexieRepository } from "./data/dexieRepository";
import { db } from "./db/schema";
import { totaisPedido } from "./domain/calculos";

/**
 * Percurso completo do vendedor sobre o repositório real (Dexie em IndexedDB
 * simulado). Cobre o que o TypeScript não vê: renderização, navegação e gravação.
 */

function abrir(rota = "/") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <RepositoryProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </RepositoryProvider>
    </MemoryRouter>,
  );
}

async function preencher(rotulo: RegExp, valor: string) {
  // `find*` (não `get*`): logo depois de uma navegação o campo pode ainda não
  // ter montado (a tela carrega o pedido via useDados) — espera aparecer.
  const campo = await screen.findByLabelText(rotulo);
  await userEvent.clear(campo);
  await userEvent.type(campo, valor);
}

/**
 * A barra de Finalizar tem uma acao so ("Exportar"), que abre a folha com
 * Excel/PDF. Devolve o botao do Excel ja visivel.
 */
async function abrirExportacao() {
  await userEvent.click(await screen.findByRole("button", { name: "Exportar" }));
  return await screen.findByRole("button", { name: /Exportar Excel/ });
}

beforeEach(async () => {
  // Deixa consultas em voo de telas recém-desmontadas (useDados) resolverem
  // antes de fechar o banco — senão o Dexie emite um "DatabaseClosedError"
  // não tratado que a suíte contabiliza como falha em outro teste.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await db.delete();
  await db.open();
});

describe("navegação básica", () => {
  it("abre a tela inicial com o alerta de base vazia", async () => {
    abrir("/");
    expect(await screen.findByRole("heading", { name: "Pedidos" })).toBeDefined();
    expect(
      await screen.findByText(/Nenhuma base de produtos importada/),
    ).toBeDefined();
    expect(await screen.findByText("Nenhum pedido ainda")).toBeDefined();
  });

  it("abre configurações e salva o representante", async () => {
    abrir("/config/representante");
    await preencher(/^Nome/, "João Vendedor");
    await preencher(/^E-mail/, "joao@exemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(async () => {
      expect((await dexieRepository.obterRepresentante())?.nome).toBe("João Vendedor");
    });
  });
});

describe("fluxo do pedido", () => {
  it("cadastra cliente, cria pedido, adiciona item e chega ao resumo", async () => {
    await dexieRepository.substituirBaseProdutos(
      [
        {
          nome: "Esmalte sintético brilhante",
          embalagem: "Galão (3,6 L)",
          valorUnit: 95.64,
        },
        {
          nome: "Esmalte sintético brilhante",
          embalagem: "Lata (18 L)",
          valorUnit: 453.31,
        },
      ],
      "tabela-teste.xlsx",
    );

    abrir("/clientes/novo");
    // Exclui "Nome fantasia" (também presente na tela) do casamento.
    await preencher(/^Nome(?! fantasia)/, "Tintas do Vale");
    await preencher(/CPF \/ CNPJ/, "11222333000181");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(async () => {
      expect((await dexieRepository.listarClientes()).length).toBe(1);
    });
    const [cliente] = await dexieRepository.listarClientes();

    const marca = await dexieRepository.salvarMarca({
      nome: "ARARA AZUL",
      visivelEmRelatorios: true,
    });

    // Novo pedido já com o cliente escolhido, como volta da tela de seleção.
    abrir(`/pedidos/novo?clienteId=${cliente.id}&marcaId=${marca.id}`);
    expect(await screen.findByText("Tintas do Vale")).toBeDefined();
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar pedido" }));

    const item = await screen.findByRole("button", { name: "Adicionar item" });
    await userEvent.click(item);

    // Busca só pelo nome do produto; a embalagem aparece como chip na etapa seguinte.
    await preencher(/^Produto/, "esmalte");
    const nomeEncontrado = await screen.findByText("Esmalte sintético brilhante");
    await userEvent.click(nomeEncontrado);

    const chipGalao = await screen.findByRole("button", { name: "Galão (3,6 L)" });
    await userEvent.click(chipGalao);

    await preencher(/^Quantidade/, "10");
    // Aparece na conta do painel e no total da barra inferior.
    expect((await screen.findAllByText("R$ 956,40")).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    // De volta ao pedido, com o item listado e o total na barra inferior.
    expect(await screen.findByText(/Esmalte sintético brilhante/)).toBeDefined();
    await userEvent.click(await screen.findByRole("button", { name: "Resumo" }));

    // Resumo com desconto de 10%.
    await preencher(/Percentual/, "10");
    await waitFor(async () => {
      const [pedido] = await dexieRepository.listarPedidos();
      expect(pedido.descontoValor).toBe(10);
    });

    const [pedido] = await dexieRepository.listarPedidos();
    expect(pedido.numero).toBe(1);
    expect(pedido.marca).toBe("ARARA AZUL");
    expect(pedido.itens).toHaveLength(1);
    expect(pedido.itens[0].valorUnit).toBe(95.64);
    expect(pedido.itens[0].embalagem).toBe("Galão (3,6 L)");
  });

  it("pede para escolher a variante quando o produto tem mais de uma linha na base", async () => {
    // Regressão: o auto-resolve de variante rodava com dados da busca anterior
    // (ainda vazios) antes do fetch da nova terminar, pulando direto para a
    // etapa de embalagem sem nunca perguntar qual variante — mesmo havendo 2.
    await dexieRepository.substituirBaseProdutos(
      [
        {
          nome: "Esmalte sintético brilhante",
          detalhes: "exceto amarelo, laranja e vermelho",
          embalagem: "Galão (3,6 L)",
          valorUnit: 95.64,
        },
        {
          nome: "Esmalte sintético brilhante",
          detalhes: "amarelo, laranja e vermelho",
          embalagem: "Galão (3,6 L)",
          valorUnit: 118.8,
        },
      ],
      "tabela-teste.xlsx",
    );

    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "ARARA AZUL" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await screen.findByRole("heading", { name: "Adicionar item" });
    await preencher(/^Produto/, "esmalte");
    const nomeEncontrado = await screen.findByText("Esmalte sintético brilhante");
    await userEvent.click(nomeEncontrado);

    // As duas variantes devem aparecer para escolha — nada de embalagem ainda.
    expect(await screen.findByText("exceto amarelo, laranja e vermelho")).toBeDefined();
    expect(await screen.findByText("amarelo, laranja e vermelho")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Galão (3,6 L)" })).toBeNull();

    await userEvent.click(screen.getByText("amarelo, laranja e vermelho"));

    // Escolhida a variante: campo de leitura com o detalhe e chip de embalagem
    // com o preço certo daquela variante (118,80, não 95,64 da outra).
    // A variante escolhida vira etiqueta de resumo (antes era um campo readOnly).
    expect(await screen.findByText("amarelo, laranja e vermelho")).toBeDefined();
    const chipGalao = await screen.findByRole("button", { name: "Galão (3,6 L)" });
    await userEvent.click(chipGalao);
    await preencher(/^Quantidade/, "2");
    expect((await screen.findAllByText("R$ 237,60")).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.itens).toHaveLength(1);
    });
    const salvo = await dexieRepository.obterPedido(pedido.id);
    expect(salvo?.itens[0].valorUnit).toBe(118.8);
    expect(salvo?.itens[0].detalhesProduto).toBe("amarelo, laranja e vermelho");
    expect(salvo?.itens[0].descricaoProduto).toBe(
      "Esmalte sintético brilhante (amarelo, laranja e vermelho)",
    );
  });

  it("permite ajustar o nome final do produto só para o Excel/PDF, sem mudar a base", async () => {
    await dexieRepository.substituirBaseProdutos(
      [
        {
          nome: "Esmalte sintético brilhante",
          embalagem: "Galão (3,6 L)",
          valorUnit: 95.64,
        },
      ],
      "tabela-teste.xlsx",
    );

    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "ARARA AZUL" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await screen.findByRole("heading", { name: "Adicionar item" });
    await preencher(/^Produto/, "esmalte");
    await userEvent.click(await screen.findByText("Esmalte sintético brilhante"));

    // Sem marcar o checkbox, o campo de nome customizado não aparece.
    const checkbox = await screen.findByRole("checkbox", { name: /Alterar nome final do produto/ });
    expect(screen.queryByLabelText(/^Nome final do produto/)).toBeNull();

    await userEvent.click(checkbox);
    // Pré-preenchido com o nome atual do produto, editável.
    const campoNomeFinal = (await screen.findByLabelText(
      /^Nome final do produto/,
    )) as HTMLInputElement;
    expect(campoNomeFinal.value).toBe("Esmalte sintético brilhante");
    await userEvent.clear(campoNomeFinal);
    await userEvent.type(campoNomeFinal, "Esmalte Premium Linha Ouro");

    await userEvent.click(await screen.findByRole("button", { name: "Galão (3,6 L)" }));
    await preencher(/^Quantidade/, "1");
    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.itens).toHaveLength(1);
    });
    const salvo = await dexieRepository.obterPedido(pedido.id);
    // Nome real do produto (base) intacto — só o texto de exportação muda.
    expect(salvo?.itens[0].nomeProduto).toBe("Esmalte sintético brilhante");
    expect(salvo?.itens[0].nomeExportado).toBe("Esmalte Premium Linha Ouro");
    expect(salvo?.itens[0].embalagem).toBe("Galão (3,6 L)");
    expect(salvo?.itens[0].valorUnit).toBe(95.64);

    const produtosNaBase = await dexieRepository.listarProdutos();
    expect(produtosNaBase.map((p) => p.nome)).toEqual(["Esmalte sintético brilhante"]);

    const dados = await import("./features/export/dadosExportacao").then((m) =>
      m.montarDadosExportacao(salvo!, cliente),
    );
    expect(dados.itens[0].descricaoProduto).toBe("Esmalte Premium Linha Ouro");
  });

  it("avisa quando quantidade ou valor unitário não são números válidos, e bloqueia salvar", async () => {
    await dexieRepository.substituirBaseProdutos(
      [{ nome: "Esmalte sintético brilhante", embalagem: "Galão (3,6 L)", valorUnit: 95.64 }],
      "tabela-teste.xlsx",
    );
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "ARARA AZUL" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await screen.findByRole("heading", { name: "Adicionar item" });
    await preencher(/^Produto/, "esmalte");
    await userEvent.click(await screen.findByText("Esmalte sintético brilhante"));
    await userEvent.click(await screen.findByRole("button", { name: "Galão (3,6 L)" }));

    // Quantidade com texto inválido: erro ao sair do campo, botão continua desabilitado.
    const campoQtd = screen.getByLabelText(/^Quantidade/);
    await userEvent.clear(campoQtd);
    await userEvent.type(campoQtd, "abc");
    await userEvent.tab();
    expect(await screen.findByText("Informe um número válido.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Salvar item" }).hasAttribute("disabled")).toBe(true);

    // Corrige a quantidade — o erro some e o valor unitário (preenchido pela
    // embalagem escolhida) continua válido, então dá pra salvar normalmente.
    await userEvent.clear(campoQtd);
    await userEvent.type(campoQtd, "2");
    await userEvent.tab();
    expect(screen.queryByText("Informe um número válido.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.itens).toHaveLength(1);
    });
  });

  it("bloqueia a exportação quando o CPF/CNPJ é inválido", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Sem Documento",
      cpfCnpj: "11111111111",
    });
    const pedido = await dexieRepository.criarPedido({
      clienteId: cliente.id,
      marca: "MERKO",
    });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        {
          item: 1,
          qtd: 1,
          embalagem: "Galão",
          descricaoProduto: "Esmalte",
          valorUnit: 100,
        },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    expect(await screen.findByText(/CPF\/CNPJ do cliente é inválido/)).toBeDefined();

    const botao = await screen.findByRole("button", { name: "Exportar" });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("número do pedido limpo bloqueia exportar arquivo, mas ainda deixa salvar como orçamento", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Válido",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    await screen.findByRole("heading", { name: "Finalizar pedido" });
    // userEvent.type não aceita string vazia — só limpar já dispara o onChange
    // com o campo em branco, que é o caso que queremos testar.
    await userEvent.clear(screen.getByLabelText(/^Número do pedido/));
    expect(await screen.findByText("O número do pedido é obrigatório.")).toBeDefined();

    // A folha abre (número inválido não trava o caminho de orçamento)...
    await userEvent.click(await screen.findByRole("button", { name: "Exportar" }));
    // ...mas gerar arquivo continua bloqueado.
    expect(
      (await screen.findByRole("button", { name: /Exportar Excel/ })).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /Exportar PDF/ }).hasAttribute("disabled"),
    ).toBe(true);
    // Salvar como orçamento segue disponível — ele descarta o número.
    expect(
      screen
        .getByRole("button", { name: "Salvar como orçamento e voltar" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("permite exportar mesmo sem CPF/CNPJ do cliente (documento é opcional, ex.: orçamento)", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Sem Documento Ainda",
      cpfCnpj: "",
    });
    const pedido = await dexieRepository.criarPedido({
      clienteId: cliente.id,
      marca: "MERKO",
    });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    const botao = await screen.findByRole("button", { name: "Exportar" });
    expect(screen.queryByText(/CPF\/CNPJ do cliente é inválido/)).toBeNull();
    expect(botao.hasAttribute("disabled")).toBe(false);
  });

  it("exporta um pedido válido e marca como enviado", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Válido",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    const botaoExcel = await abrirExportacao();
    expect(botaoExcel.hasAttribute("disabled")).toBe(false);

    await userEvent.click(botaoExcel);

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.status).toBe("enviado");
    });
    // Sem `fetch` mockado pro molde neste teste, cai no gerador alternativo —
    // o toast avisa isso explicitamente (ver correção do "Excel saindo no
    // modelo padrão sem aviso").
    expect(await screen.findByText(/Excel gerado no modelo padrão/)).toBeDefined();
  });

  it("exige confirmação extra ao finalizar com a base de preços crítica (>90 dias)", async () => {
    await db.meta.put({
      chave: "ultimaImportacao",
      valor: {
        arquivo: "tabela-antiga.xlsx",
        quandoEm: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        totalProdutos: 10,
      },
    });
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Válido",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    const botaoExcel = await abrirExportacao();
    await userEvent.click(botaoExcel);

    // Sheet de confirmação (base crítica) aparece — cancela.
    await screen.findByText(/Os preços deste pedido podem estar desatualizados/);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    // Cancelou a confirmação: não deve exportar nem marcar como enviado.
    const aindaRascunho = await dexieRepository.obterPedido(pedido.id);
    expect(aindaRascunho?.status).toBe("rascunho");
  });

  it("item marcado como 'com desconto' fica de fora do desconto geral do pedido", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "ARARA AZUL" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await screen.findByRole("heading", { name: "Adicionar item" });
    await preencher(/^Produto/, "Verniz");
    await userEvent.click(await screen.findByText("Usar “Verniz”"));
    await preencher(/^Embalagem/, "Galão");
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Item com desconto/ }),
    );
    // "Padrão / Complemento" vem pré-preenchido ao marcar o checkbox (esse
    // campo aparece no Excel/PDF exportado, diferente da observação livre).
    expect(await screen.findByDisplayValue("Valor promocional")).toBeDefined();
    await preencher(/^Quantidade/, "1");
    await preencher(/Valor unitário/, "500");
    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    // De volta ao pedido (mesma navegação da tela, sem remontar) — adiciona um
    // segundo item, normal (sujeito ao desconto geral).
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar item" }));
    await preencher(/^Produto/, "Esmalte");
    await userEvent.click(await screen.findByText("Usar “Esmalte”"));
    await preencher(/^Embalagem/, "Lata");
    await preencher(/^Quantidade/, "1");
    await preencher(/Valor unitário/, "1000");
    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

    await userEvent.click(await screen.findByRole("button", { name: "Resumo" }));
    await preencher(/Percentual/, "10");

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.descontoValor).toBe(10);
    });
    const salvo = await dexieRepository.obterPedido(pedido.id);
    // Subtotal soma os dois (1500); desconto de 10% incide só sobre o item
    // normal (1000) — o promocional (500) não entra na base.
    expect(salvo).toBeDefined();
    const totais = totaisPedido(salvo!);
    expect(totais.subtotal).toBe(1500);
    expect(totais.desconto).toBe(100);
    expect(totais.total).toBe(1400);
  });

  it("desconto: texto inválido no campo avisa e não zera o valor já aplicado", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
      descontoTipo: "valor",
      descontoValor: 10,
    });

    abrir(`/pedidos/${pedido.id}/resumo`);
    await screen.findByRole("heading", { name: "Resumo do pedido" });
    expect(await screen.findByText("R$ 90,00")).toBeDefined(); // total já com os R$ 10 de desconto

    // Digita em cima do valor existente ("10"), sem limpar antes — texto vira
    // "10abc", inválido. Sai do campo (tab) pra disparar a validação de erro.
    const campoDesconto = screen.getByLabelText(/Valor \(R\$\)/);
    await userEvent.type(campoDesconto, "abc");
    await userEvent.tab();

    expect(await screen.findByText("Informe um número válido.")).toBeDefined();
    // O desconto de R$ 10 continua valendo — texto inválido não zera silenciosamente.
    const pedidoAtual = await dexieRepository.obterPedido(pedido.id);
    expect(pedidoAtual?.descontoValor).toBe(10);
  });

  it("desconto: trocar entre % e R$ limpa o valor, em vez de reinterpretar o mesmo número", async () => {
    // Regressão: "10" como percentual (10% de desconto) virava "10" como R$
    // (R$10 fixo) ao trocar o tipo, sem o vendedor perceber — o item
    // promocional continuava excluído da base em ambos os casos, mas o
    // *valor* do desconto mudava de sentido silenciosamente.
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Item normal", valorUnit: 1000 },
        {
          item: 2,
          qtd: 1,
          embalagem: "Galão",
          descricaoProduto: "Item promocional",
          valorUnit: 500,
          comDesconto: true,
        },
      ],
      descontoTipo: "percentual",
      descontoValor: 10,
    });

    abrir(`/pedidos/${pedido.id}/resumo`);
    await screen.findByRole("heading", { name: "Resumo do pedido" });
    // 10% sobre os R$1000 descontáveis (item promocional de fora) = R$100 de desconto.
    expect(await screen.findByText("R$ 1.400,00")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "R$" }));

    // Campo de valor limpo — não continua mostrando "10" reinterpretado como R$10.
    const campoValor = screen.getByLabelText(/Valor \(R\$\)/) as HTMLInputElement;
    expect(campoValor.value).toBe("");

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.descontoTipo).toBe("valor");
      expect(salvo?.descontoValor).toBe(0);
    });
    // Sem desconto até o vendedor digitar um valor novo — subtotal e total
    // ficam iguais ("R$ 1.500,00" aparece duas vezes, por isso findAllByText).
    expect((await screen.findAllByText("R$ 1.500,00")).length).toBe(2);

    await userEvent.type(campoValor, "50");
    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.descontoValor).toBe(50);
    });
    // R$50 de desconto saem só do item descontável (1000 → 950); o
    // promocional (500) continua intacto: total 1450, não 1450 - promo.
    expect(await screen.findByText("R$ 1.450,00")).toBeDefined();
  });

  it("Salvar como orçamento: confere o código na folha, salva como enviado e volta pra inicial", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    await screen.findByRole("heading", { name: "Finalizar pedido" });
    expect(screen.getByLabelText(/^Número do pedido/)).toBeDefined();

    // Abre a folha de exportar e escolhe "Salvar como orçamento".
    await userEvent.click(await screen.findByRole("button", { name: "Exportar" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar como orçamento e voltar" }),
    );

    // Card de conferência: mostra o próximo código disponível antes de confirmar.
    expect(await screen.findByText("Código do orçamento")).toBeDefined();
    expect(screen.getByText("ORC01")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar orçamento ORC01/ }));

    // Volta pra tela inicial e grava como orçamento já enviado.
    await screen.findByRole("heading", { name: "Pedidos" });
    const salvo = await dexieRepository.obterPedido(pedido.id);
    expect(salvo?.somenteOrcamento).toBe(true);
    expect(salvo?.codigoOrcamento).toBe("ORC01");
    expect(salvo?.status).toBe("enviado");
  });

  it("Orçamento salvo: reabre sem pendência de número, exporta, e converte de volta em pedido", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
      status: "enviado",
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    await screen.findByRole("heading", { name: "Finalizar pedido" });

    // Código no lugar do número, somente leitura — e sem pendência de número.
    const campoCodigo = (await screen.findByLabelText(/Código do orçamento/)) as HTMLInputElement;
    expect(campoCodigo.value).toBe("ORC01");
    expect(campoCodigo).toHaveProperty("disabled", true);
    expect(screen.queryByLabelText(/^Número do pedido/)).toBeNull();
    expect(screen.queryByText(/pendência/)).toBeNull();

    // Exportar não fica bloqueado por falta de número.
    expect(screen.getByRole("button", { name: "Exportar" }).hasAttribute("disabled")).toBe(false);

    // "Converter em pedido": some o código, volta o número — o próximo
    // disponível excluindo ele mesmo do cálculo é 1 (o que ele já tinha).
    await userEvent.click(screen.getByRole("button", { name: /Converter em pedido/ }));
    expect(screen.queryByLabelText(/Código do orçamento/)).toBeNull();
    const campoNumero = (await screen.findByLabelText(/^Número do pedido/)) as HTMLInputElement;
    await waitFor(() => expect(campoNumero.value).toBe("1"));

    const salvoFinal = await dexieRepository.obterPedido(pedido.id);
    expect(salvoFinal?.somenteOrcamento).toBe(false);
    expect(salvoFinal?.numero).toBe(1);
  });

  it("edita marca e troca de cliente pelo botão de edição no primeiro bloco da tela do pedido", async () => {
    const clienteA = await dexieRepository.salvarCliente({
      nome: "Cliente A",
      cpfCnpj: "11222333000181",
    });
    const clienteB = await dexieRepository.salvarCliente({
      nome: "Cliente B",
      cpfCnpj: "52998224725",
    });
    const marcaMerko = await dexieRepository.salvarMarca({
      nome: "MERKO",
      visivelEmRelatorios: true,
    });
    await dexieRepository.salvarMarca({ nome: "ARARA AZUL", visivelEmRelatorios: true });
    const pedido = await dexieRepository.criarPedido({
      clienteId: clienteA.id,
      marca: marcaMerko.nome,
      marcaId: marcaMerko.id,
    });

    abrir(`/pedidos/${pedido.id}`);
    await screen.findByText("Cliente A");
    expect(screen.getByText("MERKO")).toBeDefined();
    expect(screen.queryByLabelText(/^Marca/)).toBeNull();

    // A linha de cliente/marca inteira abre a edicao (antes era so o glifo "✎").
    await userEvent.click(screen.getByRole("button", { name: /Cliente A/ }));

    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLSelectElement;
    expect(campoMarca.value).toBe(marcaMerko.id);
    await userEvent.selectOptions(campoMarca, "ARARA AZUL");
    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.marca).toBe("ARARA AZUL");
    });

    await userEvent.click(screen.getByRole("button", { name: "Trocar cliente" }));
    await screen.findByRole("heading", { name: "Escolher cliente" });
    await userEvent.click(await screen.findByText("Cliente B"));

    // Volta pra tela do pedido (remontada pela navegação de rota, por isso
    // sai do modo edição) já com o cliente novo refletido, sem sobrar o
    // clienteId na URL (a query string é limpa logo depois de aplicada).
    await screen.findByRole("heading", { name: "Pedido nº " + pedido.numero });
    await waitFor(() => expect(screen.getByText("Cliente B")).toBeDefined());
    expect(screen.queryByText("Cliente A")).toBeNull();
    expect(screen.getByText("ARARA AZUL")).toBeDefined();
    expect(screen.getByRole("button", { name: /Cliente B/ })).toBeDefined();

    // Excluir saiu do meio da tela e vive no menu de acoes da capa.
    await userEvent.click(screen.getByRole("button", { name: "Mais ações do pedido" }));
    expect(await screen.findByRole("button", { name: "Excluir pedido" })).toBeDefined();
    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.clienteId).toBe(clienteB.id);
    });
  });
});

describe("histórico", () => {
  it("lista, filtra e duplica pedidos", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "52998224725",
    });
    const pedido = await dexieRepository.criarPedido({
      clienteId: cliente.id,
      marca: "MERKO",
    });
    await dexieRepository.salvarPedido({ ...pedido, status: "enviado" });

    abrir("/pedidos");
    // A linha agora traz o cliente em primeiro plano; o numero vira apoio.
    expect(await screen.findByText("Cliente Teste")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Rascunhos" }));
    expect(await screen.findByText("Nenhum pedido neste filtro")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));

    // Duplicar/Reenviar sairam do cartao e vivem no menu "..." da linha.
    await userEvent.click(await screen.findByRole("button", { name: "Ações do pedido nº 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "Duplicar" }));

    await waitFor(async () => {
      expect((await dexieRepository.listarPedidos()).length).toBe(2);
    });
    const numeros = (await dexieRepository.listarPedidos()).map((p) => p.numero);
    expect(numeros).toEqual([2, 1]);
  });

  it("o total do topo não conta orçamento (que continua listado)", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    const real = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...real,
      status: "enviado",
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
    });
    const orcamento = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...orcamento,
      status: "enviado",
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
      itens: [{ item: 1, qtd: 1, embalagem: "Balde", descricaoProduto: "Textura", valorUnit: 900 }],
    });

    abrir("/pedidos");
    // Espera a lista carregar (o orçamento continua listado).
    expect(await screen.findByText(/ORC01/)).toBeDefined();
    const topo = (await screen.findByText("no filtro")).parentElement!;
    // Só o pedido real (R$ 100) entra no total; o orçamento de R$ 900 não.
    expect(await within(topo).findByText("R$ 100,00")).toBeDefined();
    expect(screen.queryByText("R$ 1.000,00")).toBeNull();
  });

  it('orçamento enviado aparece como "Orçado", não como "Enviado" verde', async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    const orcamento = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...orcamento,
      status: "enviado",
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
      itens: [{ item: 1, qtd: 1, embalagem: "Balde", descricaoProduto: "Textura", valorUnit: 900 }],
    });
    const real = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({ ...real, status: "enviado" });

    abrir("/pedidos");
    expect(await screen.findByText("Orçado")).toBeDefined();
    // "Enviado" fica só com o pedido de verdade.
    expect(screen.getAllByText("Enviado")).toHaveLength(1);
  });
});

describe("relatórios", () => {
  it("não conta pedidos marcados como teste nos totais de vendas", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    const pedidoReal = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedidoReal,
      status: "enviado",
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
    });

    const clienteTeste = await dexieRepository.salvarCliente({
      nome: "Cliente (teste)",
      cpfCnpj: "11222333000181",
      teste: true,
    });
    const pedidoTeste = await dexieRepository.criarPedido({
      clienteId: clienteTeste.id,
      marca: "MERKO",
    });
    await dexieRepository.salvarPedido({
      ...pedidoTeste,
      status: "enviado",
      teste: true,
      itens: [
        { item: 1, qtd: 1, embalagem: "Tambor", descricaoProduto: "Verniz", valorUnit: 5000 },
      ],
    });

    abrir("/relatorios");
    const totalVendidoRotulo = await screen.findByText("Total vendido");
    expect(within(totalVendidoRotulo.parentElement!).getByText("R$ 100,00")).toBeDefined();
    expect(screen.queryByText("R$ 5.100,00")).toBeNull();
    expect(screen.queryByText(/Verniz/)).toBeNull();
  });

  it('orçamento fica fora das vendas reais e tem o seu próprio recorte "Orçados"', async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });

    const real = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...real,
      status: "enviado",
      itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 }],
    });

    // Orçamento também exportado (status enviado) — R$ 900.
    const orcamento = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...orcamento,
      status: "enviado",
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
      itens: [{ item: 1, qtd: 1, embalagem: "Balde", descricaoProduto: "Textura", valorUnit: 900 }],
    });

    abrir("/relatorios");
    // "Reais" (padrão): só os R$ 100 do pedido de verdade.
    let rotulo = await screen.findByText("Total vendido");
    expect(within(rotulo.parentElement!).getByText("R$ 100,00")).toBeDefined();
    expect(screen.queryByText("R$ 1.000,00")).toBeNull();
    expect(screen.queryByText(/Textura/)).toBeNull();

    // Recorte "Orçados": agora só os R$ 900 do orçamento.
    await userEvent.click(screen.getByRole("button", { name: "Orçados" }));
    rotulo = await screen.findByText("Total vendido");
    expect(await within(rotulo.parentElement!).findByText("R$ 900,00")).toBeDefined();
    expect(screen.queryByText("R$ 100,00")).toBeNull();
  });

  it("marca desligada some dos totais reais, mesmo em 'Tudo'", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    const visivel = await dexieRepository.salvarMarca({
      nome: "MERKO",
      visivelEmRelatorios: true,
    });
    const oculta = await dexieRepository.salvarMarca({
      nome: "ARARA AZUL",
      visivelEmRelatorios: false,
    });
    for (const [m, valor] of [
      [visivel, 100],
      [oculta, 7000],
    ] as const) {
      const p = await dexieRepository.criarPedido({
        clienteId: cliente.id,
        marca: m.nome,
        marcaId: m.id,
      });
      await dexieRepository.salvarPedido({
        ...p,
        status: "enviado",
        itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Item", valorUnit: valor }],
      });
    }

    abrir("/relatorios");
    await userEvent.click(await screen.findByRole("button", { name: "Tudo" }));
    const rotulo = await screen.findByText("Total vendido");
    expect(within(rotulo.parentElement!).getByText("R$ 100,00")).toBeDefined();
    expect(screen.queryByText("R$ 7.100,00")).toBeNull();
  });

  it("as setas de mês trocam os valores; comparar dois meses soma", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    await dexieRepository.salvarMarca({ nome: "MERKO", visivelEmRelatorios: true });

    const hoje = new Date();
    const esteMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-15`;
    const mesPassadoDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15);
    const mesPassado = `${mesPassadoDate.getFullYear()}-${String(
      mesPassadoDate.getMonth() + 1,
    ).padStart(2, "0")}-15`;

    for (const [data, valor] of [
      [esteMes, 100],
      [mesPassado, 900],
    ] as const) {
      const p = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
      await dexieRepository.salvarPedido({
        ...p,
        status: "enviado",
        dataPedido: data,
        itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Item", valorUnit: valor }],
      });
    }

    abrir("/relatorios");
    const rotulo = await screen.findByText("Total vendido");
    // Mês atual: só o pedido de 100.
    expect(await within(rotulo.parentElement!).findByText("R$ 100,00")).toBeDefined();

    // Seta "‹" → mês anterior: agora aparece o de 900.
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(await within(rotulo.parentElement!).findByText("R$ 900,00")).toBeDefined();

    // Seta "›" volta pro mês atual: de novo 100.
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await within(rotulo.parentElement!).findByText("R$ 100,00")).toBeDefined();

    // "+ Comparar com mês anterior" → soma os dois: 1.000.
    await userEvent.click(screen.getByRole("button", { name: /Comparar com m[êe]s anterior/ }));
    expect(await within(rotulo.parentElement!).findByText("R$ 1.000,00")).toBeDefined();
  });

  it("Relatório de teste mostra os dados fictícios; o relatório real não, nem em 'Tudo'", async () => {
    const { gerarRelatorioTeste } = await import("./features/relatorios/relatoriosTeste");
    await gerarRelatorioTeste(dexieRepository);

    // Rota direta: já abre no modo teste, com "Tudo" por padrão e dados na tela.
    abrir("/relatorios/teste");
    expect(await screen.findByText(/dados fictícios/i)).toBeDefined();
    expect(await screen.findByText("Total vendido")).toBeDefined();
    expect(await screen.findAllByText(/Teste [123]/)).not.toHaveLength(0);
    cleanup();

    // Tela normal: começa em "Reais" (sem dados reais → vazio), e o seletor
    // "Teste" aparece porque há dados de teste na base.
    abrir("/relatorios");
    await userEvent.click(await screen.findByRole("button", { name: "Tudo" }));
    expect(await screen.findByText("Nenhum pedido enviado neste filtro")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Teste" }));
    expect(await screen.findByText(/dados fictícios/i)).toBeDefined();
    expect(await screen.findByText("Total vendido")).toBeDefined();
    expect(await screen.findAllByText(/Teste [123]/)).not.toHaveLength(0);
  });
});

describe("seleção de cliente e marca (ida e volta pela query string)", () => {
  it("escolher cliente no seletor volta com o cliente aplicado e a marca preservada", async () => {
    const marca = await dexieRepository.salvarMarca({
      nome: "MERKO",
      visivelEmRelatorios: true,
    });
    await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
    });

    // Entra em Novo pedido já com a marca escolhida e SEM cliente — é o estado
    // em que o vendedor toca em "Escolher cliente".
    abrir(`/pedidos/novo?marcaId=${marca.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Escolher cliente" }));

    await screen.findByRole("heading", { name: "Escolher cliente" });
    await userEvent.click(await screen.findByText("Tintas do Vale"));

    // Regressão: a rota de retorno já carregava "clienteId=" vazio e o seletor
    // acrescentava outro, então params.get() devolvia o vazio e o cliente nunca
    // era aplicado — travando o fluxo inteiro.
    await screen.findByRole("heading", { name: "Novo pedido" });
    expect(await screen.findByText("Tintas do Vale")).toBeDefined();

    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLSelectElement;
    expect(campoMarca.value).toBe(marca.id);

    const iniciar = await screen.findByRole("button", { name: "Iniciar pedido" });
    expect(iniciar.hasAttribute("disabled")).toBe(false);
    await userEvent.click(iniciar);

    await waitFor(async () => {
      const [pedido] = await dexieRepository.listarPedidos();
      expect(pedido?.marca).toBe("MERKO");
      expect(pedido?.clienteId).toBeTruthy();
    });
  });

  it("cadastrar marca no meio do fluxo volta com a marca aplicada e o cliente preservado", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Casa da Tinta",
      cpfCnpj: "52998224725",
    });

    abrir(`/pedidos/novo?clienteId=${cliente.id}`);
    await userEvent.click(await screen.findByRole("button", { name: /Cadastrar nova marca/ }));

    await screen.findByRole("heading", { name: "Nova marca" });
    await preencher(/Nome da marca/, "ARARA AZUL");
    await userEvent.click(screen.getByRole("button", { name: "Salvar marca" }));

    // Volta pro pedido com a marca nova já selecionada e o cliente intacto.
    await screen.findByRole("heading", { name: "Novo pedido" });
    expect(await screen.findByText("Casa da Tinta")).toBeDefined();
    await screen.findByRole("option", { name: "ARARA AZUL" });
    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLSelectElement;
    await waitFor(() => expect(campoMarca.value).not.toBe(""));

    await userEvent.click(screen.getByRole("button", { name: "Iniciar pedido" }));
    await waitFor(async () => {
      const [pedido] = await dexieRepository.listarPedidos();
      expect(pedido?.marca).toBe("ARARA AZUL");
      expect(pedido?.clienteId).toBe(cliente.id);
    });
  });

  it("trocar o cliente de um pedido já criado aplica o novo cliente", async () => {
    const a = await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: "11222333000181" });
    const b = await dexieRepository.salvarCliente({ nome: "Cliente B", cpfCnpj: "52998224725" });
    const marca = await dexieRepository.salvarMarca({ nome: "MERKO", visivelEmRelatorios: true });
    const pedido = await dexieRepository.criarPedido({
      clienteId: a.id,
      marca: marca.nome,
      marcaId: marca.id,
    });

    abrir(`/pedidos/${pedido.id}`);
    await userEvent.click(await screen.findByRole("button", { name: /Cliente A/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Trocar cliente" }));
    await screen.findByRole("heading", { name: "Escolher cliente" });
    await userEvent.click(await screen.findByText("Cliente B"));

    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.clienteId).toBe(b.id);
    });
  });
});

describe("redesenho — comportamentos novos", () => {
  async function pedidoComItem() {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
    });
    const marca = await dexieRepository.salvarMarca({
      nome: "MERKO",
      visivelEmRelatorios: true,
    });
    const pedido = await dexieRepository.criarPedido({
      clienteId: cliente.id,
      marca: marca.nome,
      marcaId: marca.id,
    });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        {
          item: 1,
          qtd: 2,
          embalagem: "Galão",
          descricaoProduto: "Esmalte sintético",
          nomeProduto: "Esmalte sintético",
          valorUnit: 100,
        },
      ],
    });
    return { pedido, cliente };
  }

  it("remover um item do pedido agora pede confirmação (antes excluía direto)", async () => {
    const { pedido } = await pedidoComItem();

    abrir(`/pedidos/${pedido.id}/item/0`);
    await screen.findByRole("heading", { name: "Editar item" });
    await userEvent.click(await screen.findByRole("button", { name: "Remover item" }));

    await screen.findByText(/Remover .* do pedido\?/);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect((await dexieRepository.obterPedido(pedido.id))?.itens).toHaveLength(1);

    await userEvent.click(await screen.findByRole("button", { name: "Remover item" }));
    await screen.findByText(/Remover .* do pedido\?/);
    await userEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.itens).toHaveLength(0);
    });
  });

  it("no item, quantidade e valor lado a lado calculam o total e o painel opcional guarda os campos", async () => {
    const { pedido } = await pedidoComItem();

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await preencher(/^Produto/, "Verniz");
    await userEvent.click(await screen.findByText(/Usar/));
    await preencher(/^Embalagem/, "Lata");
    await preencher(/^Quantidade/, "3");
    await preencher(/Valor unitário/, "50");

    // A conta aparece no painel e o total na barra — mesmo valor nos dois.
    await waitFor(async () => {
      expect((await screen.findAllByText("R$ 150,00")).length).toBeGreaterThan(1);
    });

    // Painel "Detalhes opcionais" já abre num item novo; fechar e reabrir
    // mantém o que foi digitado.
    expect(screen.getByLabelText(/^Cor/)).toBeDefined();
    await preencher(/^Cor/, "Branco neve");
    await userEvent.click(screen.getByRole("button", { name: /Detalhes opcionais/ }));
    expect(screen.queryByLabelText(/^Cor/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Detalhes opcionais/ }));
    expect(((await screen.findByLabelText(/^Cor/)) as HTMLInputElement).value).toBe("Branco neve");

    await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));
    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.itens.at(-1)?.cor).toBe("Branco neve");
      expect(salvo?.itens.at(-1)?.qtd).toBe(3);
    });
  });

  it("histórico: filtro ativo vira etiqueta removível e o menu da linha abre o pedido", async () => {
    const { pedido } = await pedidoComItem();
    await dexieRepository.salvarPedido({
      ...(await dexieRepository.obterPedido(pedido.id))!,
      status: "enviado",
    });

    abrir("/pedidos");
    await screen.findByText("Tintas do Vale");

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: "Rascunhos" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // O filtro aplicado fica visível como etiqueta — antes era só um número.
    const etiqueta = await screen.findByRole("button", { name: /Rascunhos/ });
    expect(await screen.findByText("Nenhum pedido neste filtro")).toBeDefined();

    // Tocar na etiqueta limpa aquele filtro.
    await userEvent.click(etiqueta);
    expect(await screen.findByText("Tintas do Vale")).toBeDefined();
  });

  it("cadastrar um cliente novo dentro do fluxo volta com ele já selecionado", async () => {
    const marca = await dexieRepository.salvarMarca({
      nome: "MERKO",
      visivelEmRelatorios: true,
    });

    abrir(`/pedidos/novo?marcaId=${marca.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Escolher cliente" }));
    await screen.findByRole("heading", { name: "Escolher cliente" });
    await userEvent.click(await screen.findByRole("button", { name: "Novo cliente" }));

    await screen.findByRole("heading", { name: "Novo cliente" });
    await preencher(/^Nome(?! fantasia)/, "Depósito Primavera");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    // Mesma armadilha da query string: o cadastro tambem precisa DEFINIR o
    // clienteId na rota de retorno, nao concatenar mais uma copia.
    await screen.findByRole("heading", { name: "Novo pedido" });
    expect(await screen.findByText("Depósito Primavera")).toBeDefined();
    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLSelectElement;
    expect(campoMarca.value).toBe(marca.id);
  });

  it("desmarcar 'item promocional' desfaz o texto sugerido, mas preserva o que o vendedor escreveu", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    const promocional = await screen.findByRole("checkbox", { name: /Item com desconto/ });

    // Marcar sugere o texto e abre o painel opcional.
    await userEvent.click(promocional);
    let campo = (await screen.findByLabelText(/Padrão \/ Complemento/)) as HTMLInputElement;
    expect(campo.value).toBe("Valor promocional");

    // Desmarcar tem de desfazer a sugestao — era o bug: o texto ficava para tras.
    await userEvent.click(promocional);
    campo = (await screen.findByLabelText(/Padrão \/ Complemento/)) as HTMLInputElement;
    await waitFor(() => expect(campo.value).toBe(""));

    // Ja um complemento digitado pelo vendedor nao pode ser apagado.
    await preencher(/Padrão \/ Complemento/, "Pintura externa");
    await userEvent.click(promocional);
    await userEvent.click(promocional);
    campo = (await screen.findByLabelText(/Padrão \/ Complemento/)) as HTMLInputElement;
    expect(campo.value).toBe("Pintura externa");
  });

  it("no item, 'Trocar' produto volta para a busca sem travar o formulário", async () => {
    await dexieRepository.substituirBaseProdutos(
      [{ nome: "Verniz marítimo", embalagem: "Lata", valorUnit: 200 }],
      "tabela.xlsx",
    );
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    abrir(`/pedidos/${pedido.id}/item/novo`);
    await preencher(/^Produto/, "verniz");
    await userEvent.click(await screen.findByText("Verniz marítimo"));
    await screen.findByRole("button", { name: "Lata" });

    await userEvent.click(screen.getByRole("button", { name: "Trocar" }));
    // Volta a busca: o campo Produto reaparece e a embalagem escolhida some.
    expect(await screen.findByLabelText(/^Produto/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Lata" })).toBeNull();
  });

  it("finalizar: o painel de entrega abre e o link 'usar do cliente' preenche o campo", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
      condicaoPagamento: "28/35/42 dias",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      // criarPedido copia a condicao do cliente; limpa para o link ter o que oferecer.
      condicaoPagamento: "",
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    // Sem nada preenchido, o painel comeca fechado.
    expect(screen.queryByLabelText(/Condição de pagamento/)).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /Entrega e pagamento/ }));

    await userEvent.click(
      await screen.findByRole("button", { name: /Usar do cliente \(28\/35\/42 dias\)/ }),
    );
    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.condicaoPagamento).toBe(
        "28/35/42 dias",
      );
    });
  });

  it("telefone do representante é gravado só com dígitos e sai mascarado na exportação", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    await screen.findByRole("heading", { name: "Finalizar pedido" });
    await preencher(/^Telefone/, "11978319643");

    // Guarda dígitos: antes gravava o texto exibido, que no 11º número ainda
    // estava no formato de telefone fixo e ia torto para o Excel/PDF.
    await waitFor(async () => {
      expect((await dexieRepository.obterPedido(pedido.id))?.representanteTelefone).toBe(
        "11978319643",
      );
    });

    const campo = (await screen.findByLabelText(/^Telefone/)) as HTMLInputElement;
    expect(campo.value).toBe("(11) 97831-9643");
  });

  it("pedido: o menu da capa leva para Finalizar", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({
      ...pedido,
      itens: [
        { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Esmalte", valorUnit: 100 },
      ],
    });

    abrir(`/pedidos/${pedido.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Mais ações do pedido" }));
    await userEvent.click(await screen.findByRole("button", { name: "Finalizar pedido" }));
    expect(await screen.findByRole("heading", { name: "Finalizar pedido" })).toBeDefined();
  });

  it("novo pedido sem nenhuma marca cadastrada explica o que fazer e bloqueia o início", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Teste",
      cpfCnpj: "11222333000181",
    });

    abrir(`/pedidos/novo?clienteId=${cliente.id}`);
    expect(await screen.findByText(/Nenhuma marca cadastrada ainda/)).toBeDefined();
    const iniciar = await screen.findByRole("button", { name: "Iniciar pedido" });
    expect(iniciar.hasAttribute("disabled")).toBe(true);
  });

  it("finalizar: pendências ficam num bloco só e a exportação passa pela folha", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Sem Item",
      cpfCnpj: "11222333000181",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    abrir(`/pedidos/${pedido.id}/finalizar`);
    expect(await screen.findByText("1 pendência antes de exportar")).toBeDefined();
    expect(await screen.findByText("O pedido não tem itens.")).toBeDefined();

    // Com pendência, a única ação da barra fica desligada.
    const exportar = await screen.findByRole("button", { name: "Exportar" });
    expect(exportar.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /Exportar Excel/ })).toBeNull();
  });
});
describe("cadastros (fase 2)", () => {
  it("cadastro de cliente: cidade e UF são campos separados e continuam gravados juntos", async () => {
    abrir("/clientes/novo");
    await preencher(/^Nome(?! fantasia)/, "Depósito Primavera");

    // O painel de endereço começa fechado num cadastro novo.
    expect(screen.queryByLabelText(/^Cidade/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Endereço e contato/ }));

    await preencher(/^Cidade/, "Três Lagoas");
    await preencher(/^UF/, "ms");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(async () => {
      const [cliente] = await dexieRepository.listarClientes();
      // Continua em `cidadeEstado`, no mesmo formato que a importação produz.
      expect(cliente?.cidadeEstado).toBe("Três Lagoas / MS");
    });
  });

  it("cadastro de cliente: sair com alteração pendente pede confirmação", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
    });

    abrir(`/clientes/${cliente.id}`);
    await screen.findByDisplayValue("Tintas do Vale");

    // Sem mexer em nada, o voltar não incomoda.
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByText(/alterações não salvas/)).toBeNull();

    await preencher(/^Nome(?! fantasia)/, "Tintas do Vale Ltda");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText(/alterações não salvas/)).toBeDefined();

    // Cancelar mantém na tela, sem perder o que foi digitado.
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      ((await screen.findByLabelText(/^Nome(?! fantasia)/)) as HTMLInputElement).value,
    ).toBe("Tintas do Vale Ltda");
  });

  it("lista de clientes: a linha inteira abre o cadastro (o glifo ✎ deixou de existir)", async () => {
    await dexieRepository.salvarCliente({
      nome: "Casa da Tinta",
      cpfCnpj: "52998224725",
    });

    abrir("/clientes");
    expect(screen.queryByText("✎")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /Casa da Tinta/ }));
    expect(await screen.findByDisplayValue("Casa da Tinta")).toBeDefined();
  });

  it("base de produtos avisa quando a lista foi cortada, em vez de cortar em silêncio", async () => {
    await dexieRepository.substituirBaseProdutos(
      Array.from({ length: 105 }, (_, i) => ({
        nome: `Produto ${String(i).padStart(3, "0")}`,
        embalagem: "Galão",
        valorUnit: i + 1,
      })),
      "tabela.xlsx",
    );

    abrir("/produtos");
    expect(await screen.findByText(/Mostrando os primeiros 100 de 105/)).toBeDefined();
  });

  it("importar produtos abre no passo 1 e só libera 'Conferir' com arquivo lido", async () => {
    abrir("/produtos/importar");
    expect(await screen.findByRole("heading", { name: "Importar produtos" })).toBeDefined();
    expect(await screen.findByText(/Passo 1 de 3/)).toBeDefined();

    // O mapeamento de colunas não aparece antes de existir arquivo — antes tudo
    // vinha de uma vez na mesma rolagem.
    expect(screen.queryByText(/colunas de embalagem/)).toBeNull();
    const conferir = await screen.findByRole("button", { name: /Conferir/ });
    expect(conferir.hasAttribute("disabled")).toBe(true);
  });

  it("importar clientes abre no passo 1, sem despejar os 13 seletores de coluna", async () => {
    abrir("/clientes/importar");
    expect(await screen.findByText(/Passo 1 de 3/)).toBeDefined();
    expect(screen.queryByLabelText(/Vira Nome \/ Razão social/)).toBeNull();
    expect(await screen.findByRole("button", { name: "Escolher arquivo" })).toBeDefined();
  });

  it("cadastro de produto separa variante de embalagem/preço e explica a diferença", async () => {
    abrir("/produtos/novo");
    await screen.findByRole("heading", { name: "Novo produto" });

    // "Detalhes" e "Variação" agora convivem num painel com a diferença dita.
    expect(await screen.findByLabelText(/^Detalhes/)).toBeDefined();
    expect(await screen.findByLabelText(/^Variação/)).toBeDefined();
    expect(await screen.findByText(/distingue produtos de preços diferentes/)).toBeDefined();

    await preencher(/^Nome/, "Verniz marítimo");
    await preencher(/Valor unitário/, "200");
    await userEvent.click(screen.getByRole("button", { name: "Salvar produto" }));

    await waitFor(async () => {
      const [produto] = await dexieRepository.listarProdutos();
      expect(produto?.nome).toBe("Verniz marítimo");
      expect(produto?.valorUnit).toBe(200);
    });
  });
});

describe("marcas", () => {
  it("cadastra uma marca e ela fica disponível no Novo pedido", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Tintas do Vale",
      cpfCnpj: "11222333000181",
    });

    abrir("/marcas/nova");
    await preencher(/Nome da marca/, "ARARA AZUL");
    await userEvent.click(screen.getByRole("button", { name: "Salvar marca" }));
    await waitFor(async () => {
      expect((await dexieRepository.listarMarcas()).map((m) => m.nome)).toEqual(["ARARA AZUL"]);
    });
    cleanup();

    abrir(`/pedidos/novo?clienteId=${cliente.id}`);
    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLSelectElement;
    await screen.findByRole("option", { name: "ARARA AZUL" });
    await userEvent.selectOptions(campoMarca, "ARARA AZUL");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar pedido" }));

    await waitFor(async () => {
      const [pedido] = await dexieRepository.listarPedidos();
      expect(pedido?.marca).toBe("ARARA AZUL");
      expect(pedido?.marcaId).toBeTruthy();
    });
  });
});

describe("clientes de teste", () => {
  it("cria pelo botão no Ambiente de teste e depois exclui pela tela do cliente", async () => {
    abrir("/config/teste");
    await userEvent.click(await screen.findByRole("button", { name: /Clientes de teste/ }));

    await waitFor(async () => {
      expect(await dexieRepository.listarClientes()).toHaveLength(2);
    });

    const [primeiro] = await dexieRepository.listarClientes();

    abrir(`/clientes/${primeiro.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    await screen.findByText(/Esta ação não pode ser desfeita/);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(async () => {
      expect(await dexieRepository.listarClientes()).toHaveLength(1);
    });
  });

  it("avisa quantos pedidos ficam sem cliente ao excluir, e o Desfazer restaura", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Com Pedido",
      cpfCnpj: "52998224725",
    });
    await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    abrir(`/clientes/${cliente.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    await screen.findByText(/1 pedido\(s\) registrado\(s\)/);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(async () => {
      expect(await dexieRepository.listarClientes()).toHaveLength(0);
    });

    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(async () => {
      expect(await dexieRepository.listarClientes()).toHaveLength(1);
    });
  });
});

describe("produtos", () => {
  it("bloqueia salvar produto com valor unitário inválido, sem gravar nada", async () => {
    abrir("/produtos/novo");
    await preencher(/^Nome/, "Produto Teste");
    await preencher(/Valor unitário/, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Salvar produto" }));

    expect(await screen.findByText("Informe um valor numérico (ex.: 95,64).")).toBeDefined();
    expect(await dexieRepository.listarProdutos()).toHaveLength(0);
  });

  it("bloqueia salvar produto com valor zero ou negativo", async () => {
    abrir("/produtos/novo");
    await preencher(/^Nome/, "Produto Teste");
    await preencher(/Valor unitário/, "0");
    await userEvent.click(screen.getByRole("button", { name: "Salvar produto" }));

    expect(await screen.findByText("O valor precisa ser maior que zero.")).toBeDefined();
    expect(await dexieRepository.listarProdutos()).toHaveLength(0);
  });

  it("salva o produto normalmente com um valor numérico válido", async () => {
    abrir("/produtos/novo");
    await preencher(/^Nome/, "Produto Teste");
    await preencher(/Valor unitário/, "95,64");
    await userEvent.click(screen.getByRole("button", { name: "Salvar produto" }));

    await waitFor(async () => {
      expect(await dexieRepository.listarProdutos()).toHaveLength(1);
    });
    const [produto] = await dexieRepository.listarProdutos();
    expect(produto.valorUnit).toBe(95.64);
    expect(typeof produto.valorUnit).toBe("number");
  });
});

describe("check-in", () => {
  it("escolhe cliente, salva o horário e o check-in aparece na lista", async () => {
    await dexieRepository.salvarCliente({ nome: "Cliente Visitado", cpfCnpj: "11222333000181" });

    abrir("/checkins/novo");
    await userEvent.click(await screen.findByRole("button", { name: "Escolher cliente" }));

    const cartaoCliente = await screen.findByText("Cliente Visitado");
    await userEvent.click(cartaoCliente);

    // Volta pra /checkins/novo já com o cliente escolhido e horário pré-preenchido
    // (padrão a hora atual — não mexe no campo, só confirma que salva assim mesmo).
    // A linha do cliente é tocável por inteiro: tocar nela troca de cliente.
    await screen.findByRole("button", { name: /Cliente Visitado/ });
    const campoHorario = screen.getByLabelText(/^Horário/) as HTMLInputElement;
    expect(campoHorario.value).toMatch(/^\d{2}:\d{2}$/);
    await userEvent.click(screen.getByRole("button", { name: "Salvar check-in" }));

    await waitFor(async () => {
      expect(await dexieRepository.listarCheckIns()).toHaveLength(1);
    });
    const [checkIn] = await dexieRepository.listarCheckIns();
    expect(checkIn.hora).toBe(campoHorario.value);

    // A lista de Check-in mostra o cliente e o horário salvos.
    expect(await screen.findByText("Cliente Visitado")).toBeDefined();
    expect(await screen.findByText(checkIn.hora)).toBeDefined();
  });
});

describe("configurações, check-in e relatórios (fase 3)", () => {
  it("configurações viram lista: a linha do representante abre o cadastro", async () => {
    await dexieRepository.salvarRepresentante({
      nome: "João Vendedor",
      telefone: "11978319643",
      email: "joao@exemplo.com",
    });

    abrir("/config");
    // O telefone aparece mascarado no resumo da linha (é gravado só com dígitos).
    const linha = await screen.findByRole("button", { name: /\(11\) 97831-9643/ });
    await userEvent.click(linha);

    expect(await screen.findByDisplayValue("João Vendedor")).toBeDefined();
  });

  it("em configurações, restaurar backup fica na zona de risco, longe de baixar", async () => {
    abrir("/config");
    expect(await screen.findByText("Zona de risco")).toBeDefined();

    const restaurar = await screen.findByRole("button", { name: /Restaurar backup/ });
    const baixar = await screen.findByRole("button", { name: /Baixar backup/ });
    // Não são mais dois botões iguais um do lado do outro: só o destrutivo está
    // no bloco de risco.
    expect(restaurar.closest("div")?.contains(baixar)).toBe(false);
  });

  it("marcas nos relatórios: o grupo novo só é gravado ao confirmar", async () => {
    await dexieRepository.salvarMarca({ nome: "MERKO", visivelEmRelatorios: true });

    abrir("/config/marcas-relatorio");
    await userEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));

    // Enquanto o nome não é confirmado, nada foi para o banco — antes o toque em
    // "+ Novo grupo" já gravava um registro chamado "Novo grupo".
    expect(await dexieRepository.listarGruposMarca()).toHaveLength(0);

    await preencher(/Nome do novo grupo/, "Empresa A");
    await userEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    await waitFor(async () => {
      const grupos = await dexieRepository.listarGruposMarca();
      expect(grupos).toHaveLength(1);
      expect(grupos[0].nome).toBe("Empresa A");
    });
  });

  it("marcas nos relatórios: cancelar o grupo novo não deixa resíduo", async () => {
    abrir("/config/marcas-relatorio");
    await userEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    await preencher(/Nome do novo grupo/, "Descartado");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await dexieRepository.listarGruposMarca()).toHaveLength(0);
    expect(await screen.findByRole("button", { name: "Novo grupo" })).toBeDefined();
  });

  it("marcas nos relatórios: 'Desmarcar todas' tira todas dos totais de uma vez", async () => {
    for (const nome of ["MERKO", "ARARA AZUL", "SUVINIL"]) {
      await dexieRepository.salvarMarca({ nome, visivelEmRelatorios: true });
    }

    abrir("/config/marcas-relatorio");
    await userEvent.click(await screen.findByRole("button", { name: "Desmarcar todas" }));

    await waitFor(async () => {
      const marcas = await dexieRepository.listarMarcas();
      expect(marcas.every((m) => !m.visivelEmRelatorios)).toBe(true);
    });

    await userEvent.click(screen.getByRole("button", { name: "Marcar todas" }));
    await waitFor(async () => {
      const marcas = await dexieRepository.listarMarcas();
      expect(marcas.every((m) => m.visivelEmRelatorios)).toBe(true);
    });
  });

  it("check-in: excluir saiu de baixo do cartão e foi para o menu da linha", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Visitado",
      cpfCnpj: "52998224725",
    });
    await dexieRepository.salvarCheckIn({
      clienteId: cliente.id,
      data: "2026-09-10",
      hora: "09:30",
    });

    abrir("/checkins");
    await screen.findByText("Cliente Visitado");
    // O botão vermelho não fica mais colado na linha.
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Ações do check-in de Cliente Visitado" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await screen.findByText(/Esta ação não pode ser desfeita/);
    await userEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0]);

    await waitFor(async () => {
      expect(await dexieRepository.listarCheckIns()).toHaveLength(0);
    });
  });

  it("check-in: 'Agora' devolve data e hora atuais depois de editadas", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Visitado",
      cpfCnpj: "52998224725",
    });
    const checkIn = await dexieRepository.salvarCheckIn({
      clienteId: cliente.id,
      data: "2020-01-02",
      hora: "08:15",
    });

    abrir(`/checkins/${checkIn.id}`);
    // O campo monta com a data de hoje e só depois recebe a do check-in salvo.
    const campoData = (await screen.findByDisplayValue("2020-01-02")) as HTMLInputElement;

    await userEvent.click(screen.getByRole("button", { name: "Agora" }));
    expect(campoData.value).toBe(new Date().toISOString().slice(0, 10));
    // Já em "agora", o atalho some — não há o que atalhar.
    expect(screen.queryByRole("button", { name: "Agora" })).toBeNull();
  });

  it("relatórios: filtrar por marca vira etiqueta removível, e limpar volta ao total", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    for (const [nome, valor] of [
      ["MERKO", 100],
      ["ARARA AZUL", 900],
    ] as const) {
      const marca = await dexieRepository.salvarMarca({ nome, visivelEmRelatorios: true });
      const pedido = await dexieRepository.criarPedido({
        clienteId: cliente.id,
        marca: nome,
        marcaId: marca.id,
      });
      await dexieRepository.salvarPedido({
        ...pedido,
        status: "enviado",
        itens: [
          { item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Item", valorUnit: valor },
        ],
      });
    }

    abrir("/relatorios");
    // Os números agora vêm na capa, antes de qualquer controle de filtro.
    const rotulo = await screen.findByText("Total vendido");
    expect(await within(rotulo.parentElement!).findByText("R$ 1.000,00")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /MERKO/ }));
    expect(await within(rotulo.parentElement!).findByText("R$ 100,00")).toBeDefined();

    // O filtro fica visível como etiqueta — antes só dava pra saber olhando o chip.
    await userEvent.click(await screen.findByRole("button", { name: "Limpar" }));
    expect(await within(rotulo.parentElement!).findByText("R$ 1.000,00")).toBeDefined();
  });

  it("relatórios: filtro sem resultado oferece limpar os filtros", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });
    const marca = await dexieRepository.salvarMarca({ nome: "MERKO", visivelEmRelatorios: true });
    const outra = await dexieRepository.salvarMarca({
      nome: "ARARA AZUL",
      visivelEmRelatorios: true,
    });
    const hoje = new Date();
    const mesPassadoDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15);
    const mesPassado = `${mesPassadoDate.getFullYear()}-${String(
      mesPassadoDate.getMonth() + 1,
    ).padStart(2, "0")}-15`;

    for (const [m, data] of [
      [marca, `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-15`],
      [outra, mesPassado],
    ] as const) {
      const pedido = await dexieRepository.criarPedido({
        clienteId: cliente.id,
        marca: m.nome,
        marcaId: m.id,
      });
      await dexieRepository.salvarPedido({
        ...pedido,
        status: "enviado",
        dataPedido: data,
        itens: [{ item: 1, qtd: 1, embalagem: "Galão", descricaoProduto: "Item", valorUnit: 100 }],
      });
    }

    abrir("/relatorios");
    // Filtra por uma marca que só tem pedido no mês passado: o mês atual esvazia.
    await userEvent.click(await screen.findByRole("button", { name: /ARARA AZUL/ }));
    expect(await screen.findByText("Nenhum pedido enviado neste filtro")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByText("Total vendido")).toBeDefined();
  });
});

describe("ambiente de teste → relatório (fiação da tela nova)", () => {
  it("criar os dados de Relatório pela lista do Ambiente de teste enche o Relatório de teste", async () => {
    abrir("/config/teste");
    await userEvent.click(await screen.findByRole("button", { name: /Dados de Relatório/ }));

    await waitFor(async () => {
      const pedidos = await dexieRepository.listarPedidos({ status: "enviado" });
      expect(pedidos.filter((p) => p.teste).length).toBeGreaterThan(0);
    });
    cleanup();

    abrir("/relatorios/teste");
    expect(await screen.findByText("Total vendido")).toBeDefined();
  });
});

describe("relatório de teste sem dados", () => {
  it("oferece criar o conjunto fictício na própria tela, em vez de dar tela vazia", async () => {
    abrir("/relatorios/teste");

    // Antes aparecia "Pedidos enviados aparecem aqui assim que você exportar o
    // primeiro" — mensagem do relatório real, sem saída no modo Teste.
    expect(await screen.findByText("Nenhum dado fictício ainda")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Criar dados de teste" }));

    expect(await screen.findByText("Total vendido")).toBeDefined();
    await waitFor(async () => {
      const pedidos = await dexieRepository.listarPedidos({ status: "enviado" });
      expect(pedidos.filter((p) => p.teste).length).toBeGreaterThan(0);
    });

    // E o relatório real continua limpo desses números.
    cleanup();
    abrir("/relatorios");
    await userEvent.click(await screen.findByRole("button", { name: "Tudo" }));
    expect(await screen.findByText("Nenhum pedido enviado neste filtro")).toBeDefined();
  });
});
