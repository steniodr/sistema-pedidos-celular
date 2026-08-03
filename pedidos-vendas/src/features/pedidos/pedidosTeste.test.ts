import { beforeEach, describe, expect, it } from "vitest";
import { dexieRepository } from "../../data/dexieRepository";
import { db } from "../../db/schema";
import { gerarPedidosTeste } from "./pedidosTeste";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("gerarPedidosTeste", () => {
  it("cria os pedidos marcados como teste, vinculados só a clientes de teste", async () => {
    await dexieRepository.salvarCliente({ nome: "Cliente Real", cpfCnpj: "52998224725" });

    const criados = await gerarPedidosTeste(dexieRepository);
    expect(criados).toBeGreaterThan(0);

    const pedidos = await dexieRepository.listarPedidos();
    expect(pedidos.length).toBe(criados);
    expect(pedidos.every((p) => p.teste === true)).toBe(true);

    const clientes = await dexieRepository.listarClientes();
    const idsClientesTeste = new Set(clientes.filter((c) => c.teste).map((c) => c.id));
    expect(pedidos.every((p) => idsClientesTeste.has(p.clienteId))).toBe(true);
  });

  it("nenhum pedido de teste fica vinculado a um cliente real", async () => {
    const real = await dexieRepository.salvarCliente({
      nome: "Cliente Real",
      cpfCnpj: "52998224725",
    });

    await gerarPedidosTeste(dexieRepository);

    const pedidos = await dexieRepository.listarPedidos();
    expect(pedidos.some((p) => p.clienteId === real.id)).toBe(false);
  });
});
