import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/schema";
import { dexieRepository } from "./dexieRepository";
import type { EntradaCliente } from "./repository";

const CPF_VALIDO = "52998224725";
const CNPJ_VALIDO = "11222333000181";

describe("dexieRepository.importarClientes", () => {
  beforeEach(async () => {
    await db.clientes.clear();
  });

  it("cria clientes novos e conta certo", async () => {
    const entradas: EntradaCliente[] = [
      { nome: "Cliente A", cpfCnpj: CPF_VALIDO },
      { nome: "Cliente B", cpfCnpj: CNPJ_VALIDO },
    ];
    const info = await dexieRepository.importarClientes(entradas, "base.xlsx");
    expect(info.totalNovos).toBe(2);
    expect(info.totalAtualizados).toBe(0);
    expect(info.totalIgnorados).toBe(0);

    const todos = await db.clientes.toArray();
    expect(todos).toHaveLength(2);
  });

  it("atualiza cliente existente casando por CPF/CNPJ, sem apagar campos ausentes na nova linha", async () => {
    await dexieRepository.salvarCliente({
      nome: "Cliente Antigo",
      cpfCnpj: CPF_VALIDO,
      telefone: "67999998888",
    });

    const info = await dexieRepository.importarClientes(
      [{ nome: "Cliente Atualizado", cpfCnpj: CPF_VALIDO }],
      "base.xlsx",
    );
    expect(info.totalNovos).toBe(0);
    expect(info.totalAtualizados).toBe(1);

    const [cliente] = await db.clientes.toArray();
    expect(cliente.nome).toBe("Cliente Atualizado");
    expect(cliente.telefone).toBe("67999998888"); // preservado, não veio na planilha
  });

  it("no mesmo arquivo, CPF/CNPJ repetido: a última linha prevalece e conta como ignorada", async () => {
    const info = await dexieRepository.importarClientes(
      [
        { nome: "Primeira versão", cpfCnpj: CPF_VALIDO },
        { nome: "Segunda versão", cpfCnpj: CPF_VALIDO },
      ],
      "base.xlsx",
    );
    expect(info.totalNovos).toBe(1);
    expect(info.totalIgnorados).toBe(1);

    const [cliente] = await db.clientes.toArray();
    expect(cliente.nome).toBe("Segunda versão");
  });

  it("não apaga clientes existentes que não aparecem na planilha importada", async () => {
    await dexieRepository.salvarCliente({ nome: "Fica de fora", cpfCnpj: CNPJ_VALIDO });
    await dexieRepository.importarClientes([{ nome: "Novo", cpfCnpj: CPF_VALIDO }], "base.xlsx");

    const todos = await db.clientes.toArray();
    expect(todos.map((c) => c.nome).sort()).toEqual(["Fica de fora", "Novo"]);
  });
});

describe("dexieRepository — backup e restaurar*", () => {
  beforeEach(async () => {
    await Promise.all([db.clientes.clear(), db.produtos.clear(), db.pedidos.clear()]);
  });

  it("exportarBackup traz clientes, produtos, pedidos e representante", async () => {
    await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: CPF_VALIDO });
    await dexieRepository.salvarProduto({ nome: "Produto A", embalagem: "Galão", valorUnit: 10 });
    await dexieRepository.criarPedido({
      clienteId: (await db.clientes.toArray())[0].id,
      marca: "MERKO",
    });
    await dexieRepository.salvarRepresentante({ nome: "Rep", telefone: "", email: "" });

    const backup = await dexieRepository.exportarBackup();
    expect(backup.clientes).toHaveLength(1);
    expect(backup.produtos).toHaveLength(1);
    expect(backup.pedidos).toHaveLength(1);
    expect(backup.representante?.nome).toBe("Rep");
  });

  it("restaurarBackup substitui a base local pelo conteúdo do arquivo", async () => {
    await dexieRepository.salvarCliente({ nome: "Vai sumir", cpfCnpj: CNPJ_VALIDO });

    await dexieRepository.restaurarBackup({
      versao: 1,
      geradoEm: new Date().toISOString(),
      clientes: [
        {
          id: "c1",
          nome: "Restaurado",
          cpfCnpj: CPF_VALIDO,
          criadoEm: "2026-01-01T00:00:00.000Z",
          atualizadoEm: "2026-01-01T00:00:00.000Z",
        },
      ],
      produtos: [],
      pedidos: [],
    });

    const clientes = await db.clientes.toArray();
    expect(clientes.map((c) => c.nome)).toEqual(["Restaurado"]);
  });

  it("removerDadosTeste apaga só clientes/pedidos marcados como teste", async () => {
    const real = await dexieRepository.salvarCliente({ nome: "Cliente Real", cpfCnpj: CPF_VALIDO });
    const teste = await dexieRepository.salvarCliente({
      nome: "Cliente (teste)",
      cpfCnpj: CNPJ_VALIDO,
      teste: true,
    });
    await dexieRepository.criarPedido({ clienteId: real.id, marca: "MERKO" });
    const pedidoTeste = await dexieRepository.criarPedido({ clienteId: teste.id, marca: "MERKO" });
    await dexieRepository.salvarPedido({ ...pedidoTeste, teste: true });

    const resultado = await dexieRepository.removerDadosTeste();
    expect(resultado).toEqual({ clientes: 1, pedidos: 1 });

    const clientesRestantes = await db.clientes.toArray();
    expect(clientesRestantes.map((c) => c.nome)).toEqual(["Cliente Real"]);
    const pedidosRestantes = await db.pedidos.toArray();
    expect(pedidosRestantes).toHaveLength(1);
    expect(pedidosRestantes[0].clienteId).toBe(real.id);
  });

  it("criarPedido pré-preenche condição de pagamento, transportadora e local de entrega do cliente", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Cliente A",
      cpfCnpj: CPF_VALIDO,
      condicaoPagamento: "Pix",
      transportadora: "Rodoviário Sul",
      obsGerais: "Entregar pela manhã",
    });
    const pedido = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    expect(pedido.condicaoPagamento).toBe("Pix");
    expect(pedido.transportadora).toBe("Rodoviário Sul");
    expect(pedido.localEntrega).toBe("Entregar pela manhã");
  });

  it("existeNumeroPedido detecta duplicidade, ignorando o próprio pedido ao editar", async () => {
    const cliente = await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: CPF_VALIDO });
    const p1 = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
    const p2 = await dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });

    // Só p1 tem esse número ainda — excluindo o próprio p1 da checagem, não é duplicidade.
    expect(await dexieRepository.existeNumeroPedido(p1.numero, p1.id)).toBe(false);

    // p2 passa a ter o mesmo número de p1.
    await dexieRepository.salvarPedido({ ...p2, numero: p1.numero });

    // Agora, excluindo qualquer um dos dois, ainda sobra o outro com o mesmo número.
    expect(await dexieRepository.existeNumeroPedido(p1.numero, p1.id)).toBe(true);
    expect(await dexieRepository.existeNumeroPedido(p1.numero, p2.id)).toBe(true);
    // Sem excluir ninguém, qualquer pedido com esse número já conta.
    expect(await dexieRepository.existeNumeroPedido(p1.numero)).toBe(true);
  });

  it("restaurarCliente/restaurarProduto recolocam o registro exatamente como estava", async () => {
    const cliente = await dexieRepository.salvarCliente({
      nome: "Original",
      cpfCnpj: CPF_VALIDO,
    });
    const produto = await dexieRepository.salvarProduto({
      nome: "Produto Original",
      embalagem: "Galão",
      valorUnit: 20,
    });

    await dexieRepository.removerCliente(cliente.id);
    await dexieRepository.removerProduto(produto.id);
    expect(await db.clientes.get(cliente.id)).toBeUndefined();

    await dexieRepository.restaurarCliente(cliente);
    await dexieRepository.restaurarProduto(produto);

    expect(await db.clientes.get(cliente.id)).toEqual(cliente);
    expect(await db.produtos.get(produto.id)).toEqual(produto);
  });
});

describe("dexieRepository — check-in", () => {
  beforeEach(async () => {
    await Promise.all([db.clientes.clear(), db.checkIns.clear()]);
  });

  it("cria, lista, edita e exclui um check-in", async () => {
    const cliente = await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: CPF_VALIDO });

    const criado = await dexieRepository.salvarCheckIn({
      clienteId: cliente.id,
      data: "2026-08-03",
      hora: "09:00",
    });
    expect(await dexieRepository.listarCheckIns()).toHaveLength(1);

    const editado = await dexieRepository.salvarCheckIn({ ...criado, hora: "10:30" });
    expect(editado.id).toBe(criado.id);
    expect((await dexieRepository.obterCheckIn(criado.id))?.hora).toBe("10:30");

    await dexieRepository.removerCheckIn(criado.id);
    expect(await dexieRepository.listarCheckIns()).toHaveLength(0);

    await dexieRepository.restaurarCheckIn(editado);
    expect(await dexieRepository.listarCheckIns()).toHaveLength(1);
  });

  it("filtra por cliente e por busca (nome do cliente)", async () => {
    const a = await dexieRepository.salvarCliente({ nome: "Maria Pereira", cpfCnpj: CPF_VALIDO });
    const b = await dexieRepository.salvarCliente({ nome: "João Silva", cpfCnpj: CNPJ_VALIDO });
    await dexieRepository.salvarCheckIn({ clienteId: a.id, data: "2026-08-03", hora: "09:00" });
    await dexieRepository.salvarCheckIn({ clienteId: b.id, data: "2026-08-03", hora: "10:00" });

    expect(await dexieRepository.listarCheckIns({ clienteId: a.id })).toHaveLength(1);
    expect(await dexieRepository.listarCheckIns({ busca: "maria" })).toHaveLength(1);
    expect(await dexieRepository.listarCheckIns({ busca: "inexistente" })).toHaveLength(0);
  });

  it("exportarBackup/restaurarBackup incluem check-ins", async () => {
    const cliente = await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: CPF_VALIDO });
    await dexieRepository.salvarCheckIn({ clienteId: cliente.id, data: "2026-08-03", hora: "09:00" });

    const backup = await dexieRepository.exportarBackup();
    expect(backup.checkIns).toHaveLength(1);

    await db.checkIns.clear();
    await dexieRepository.restaurarBackup(backup);
    expect(await dexieRepository.listarCheckIns()).toHaveLength(1);
  });
});

describe("dexieRepository — pedidos e código de orçamento", () => {
  beforeEach(async () => {
    await Promise.all([db.clientes.clear(), db.pedidos.clear()]);
  });

  async function novoPedido() {
    const cliente = await dexieRepository.salvarCliente({ nome: "Cliente A", cpfCnpj: CPF_VALIDO });
    return dexieRepository.criarPedido({ clienteId: cliente.id, marca: "MERKO" });
  }

  it("proximoCodigoOrcamento começa em ORC01 e incrementa a cada código já usado", async () => {
    expect(await dexieRepository.proximoCodigoOrcamento()).toBe("ORC01");

    const pedido = await novoPedido();
    await dexieRepository.salvarPedido({
      ...pedido,
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
    });
    expect(await dexieRepository.proximoCodigoOrcamento()).toBe("ORC02");

    const pedido2 = await novoPedido();
    await dexieRepository.salvarPedido({
      ...pedido2,
      somenteOrcamento: true,
      codigoOrcamento: "ORC02",
    });
    expect(await dexieRepository.proximoCodigoOrcamento()).toBe("ORC03");
  });

  it("duplicarPedido nunca carrega o orçamento (nem o código) do original", async () => {
    const pedido = await novoPedido();
    await dexieRepository.salvarPedido({
      ...pedido,
      somenteOrcamento: true,
      codigoOrcamento: "ORC01",
    });

    const copia = await dexieRepository.duplicarPedido(pedido.id);
    expect(copia.somenteOrcamento).toBe(false);
    expect(copia.codigoOrcamento).toBeUndefined();
    expect(copia.numero).not.toBe(pedido.numero);
  });

  it("proximoNumeroPedido com excluirId não conta o próprio pedido — repetir não sobe o número à toa", async () => {
    const pedido = await novoPedido(); // numero 1, único na base
    expect(await dexieRepository.proximoNumeroPedido(pedido.id)).toBe(1);
    expect(await dexieRepository.proximoNumeroPedido(pedido.id)).toBe(1);
    expect(await dexieRepository.proximoNumeroPedido(pedido.id)).toBe(1);

    // Sem excluirId (caso de pedido novo de verdade), conta ele normalmente.
    expect(await dexieRepository.proximoNumeroPedido()).toBe(2);

    // Com um SEGUNDO pedido real na base, excluir o primeiro ainda respeita o segundo.
    const pedido2 = await novoPedido(); // numero 2
    expect(await dexieRepository.proximoNumeroPedido(pedido.id)).toBe(3);
    expect(await dexieRepository.proximoNumeroPedido(pedido2.id)).toBe(2);
  });
});
