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
