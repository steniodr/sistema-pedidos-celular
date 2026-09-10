import { render, screen, waitFor, within } from "@testing-library/react";
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
  const campo = screen.getByLabelText(rotulo);
  await userEvent.clear(campo);
  await userEvent.type(campo, valor);
}

beforeEach(async () => {
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

    // Novo pedido já com o cliente escolhido, como volta da tela de seleção.
    abrir(`/pedidos/novo?clienteId=${cliente.id}&marca=ARARA%20AZUL`);
    expect(await screen.findByText("Tintas do Vale")).toBeDefined();
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar pedido" }));

    const item = await screen.findByRole("button", { name: "+ Adicionar item" });
    await userEvent.click(item);

    // Busca só pelo nome do produto; a embalagem aparece como chip na etapa seguinte.
    await preencher(/^Produto/, "esmalte");
    const nomeEncontrado = await screen.findByText("Esmalte sintético brilhante");
    await userEvent.click(nomeEncontrado);

    const chipGalao = await screen.findByRole("button", { name: "Galão (3,6 L)" });
    await userEvent.click(chipGalao);

    await preencher(/^Quantidade/, "10");
    expect(await screen.findByText("R$ 956,40")).toBeDefined();

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
    expect(await screen.findByDisplayValue("amarelo, laranja e vermelho")).toBeDefined();
    const chipGalao = await screen.findByRole("button", { name: "Galão (3,6 L)" });
    await userEvent.click(chipGalao);
    await preencher(/^Quantidade/, "2");
    expect(await screen.findByText("R$ 237,60")).toBeDefined();

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

    const botao = await screen.findByRole("button", { name: /Exportar Excel/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("bloqueia a exportação quando o número do pedido é limpo (zero/inválido)", async () => {
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
    const botao = await screen.findByRole("button", { name: /Exportar Excel/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
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
    const botao = await screen.findByRole("button", { name: /Exportar Excel/ });
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
    const botaoExcel = await screen.findByRole("button", { name: /Exportar Excel/ });
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
    const botaoExcel = await screen.findByRole("button", { name: /Exportar Excel/ });
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
    await userEvent.click(await screen.findByRole("button", { name: "+ Adicionar item" }));
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

  it("Somente orçamento: dispensa o número do pedido, usa um código ORC e não bloqueia exportar", async () => {
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

    await userEvent.click(screen.getByRole("checkbox", { name: "Somente orçamento" }));

    // Campo de número some, entra o código do orçamento (somente leitura).
    expect(screen.queryByLabelText(/^Número do pedido/)).toBeNull();
    const campoCodigo = (await screen.findByLabelText(/Código do orçamento/)) as HTMLInputElement;
    expect(campoCodigo.value).toBe("ORC01");
    expect(campoCodigo).toHaveProperty("disabled", true);
    expect(await screen.findByText("Orçamento ORC01")).toBeDefined();

    // Exporta normalmente — não é bloqueado por falta de número de pedido.
    const botaoExcel = await screen.findByRole("button", { name: /Exportar Excel/ });
    expect(botaoExcel.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("O número do pedido é obrigatório.")).toBeNull();

    await waitFor(async () => {
      const salvo = await dexieRepository.obterPedido(pedido.id);
      expect(salvo?.somenteOrcamento).toBe(true);
      expect(salvo?.codigoOrcamento).toBe("ORC01");
    });

    // Desmarca — volta a pedir número, com o próximo disponível já sugerido.
    // Esse pedido é o único na base, então o "próximo disponível" (excluindo
    // ele mesmo do cálculo) é o número que ele já tinha antes: 1.
    await userEvent.click(screen.getByRole("checkbox", { name: "Somente orçamento" }));
    expect(screen.queryByLabelText(/Código do orçamento/)).toBeNull();
    const campoNumero = (await screen.findByLabelText(/^Número do pedido/)) as HTMLInputElement;
    await waitFor(() => expect(campoNumero.value).toBe("1"));

    const salvoFinal = await dexieRepository.obterPedido(pedido.id);
    expect(salvoFinal?.somenteOrcamento).toBe(false);
    expect(salvoFinal?.numero).toBe(1);
  });

  it("Somente orçamento: marcar e desmarcar várias vezes não fica subindo o número sem motivo", async () => {
    // Regressão: proximoNumeroPedido() contava o próprio pedido (ainda com o
    // número antigo gravado) como "já existente", então cada ida-e-volta sem
    // nenhum pedido novo criado subia o número — 1, depois 2, depois 3...
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
    const checkbox = screen.getByRole("checkbox", { name: "Somente orçamento" });

    for (let volta = 0; volta < 3; volta++) {
      await userEvent.click(checkbox); // marca (orçamento)
      await screen.findByLabelText(/Código do orçamento/);
      await userEvent.click(checkbox); // desmarca (volta a ser pedido)
      const campoNumero = (await screen.findByLabelText(/^Número do pedido/)) as HTMLInputElement;
      await waitFor(() => expect(campoNumero.value).toBe("1"));
    }

    const salvoFinal = await dexieRepository.obterPedido(pedido.id);
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
    const pedido = await dexieRepository.criarPedido({ clienteId: clienteA.id, marca: "MERKO" });

    abrir(`/pedidos/${pedido.id}`);
    await screen.findByText("Cliente A");
    expect(screen.getByText("MERKO")).toBeDefined();
    expect(screen.queryByLabelText(/^Marca/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Editar cliente ou marca" }));

    const campoMarca = (await screen.findByLabelText(/^Marca/)) as HTMLInputElement;
    expect(campoMarca.value).toBe("MERKO");
    await userEvent.clear(campoMarca);
    await userEvent.type(campoMarca, "ARARA AZUL");
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
    expect(screen.getByRole("button", { name: "Editar cliente ou marca" })).toBeDefined();
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
    expect(await screen.findByText("Pedido nº 1")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    await userEvent.click(screen.getByRole("button", { name: "Rascunhos" }));
    expect(await screen.findByText("Nenhum pedido neste filtro")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    const cartao = (await screen.findByText("Pedido nº 1")).closest("div")!;
    await userEvent.click(within(cartao.parentElement!).getByRole("button", { name: "Duplicar" }));

    await waitFor(async () => {
      expect((await dexieRepository.listarPedidos()).length).toBe(2);
    });
    const numeros = (await dexieRepository.listarPedidos()).map((p) => p.numero);
    expect(numeros).toEqual([2, 1]);
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
});

describe("clientes de teste", () => {
  it("cria pelo botão em Configurações e depois exclui pela tela do cliente", async () => {
    abrir("/config");
    await userEvent.click(await screen.findByRole("button", { name: "Criar clientes de teste" }));

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
    await screen.findByText("Toque para trocar de cliente");
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
