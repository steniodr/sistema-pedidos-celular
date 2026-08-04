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
