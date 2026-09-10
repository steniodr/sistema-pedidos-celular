import { beforeEach, describe, expect, it } from "vitest";
import { dexieRepository } from "../../data/dexieRepository";
import { db } from "../../db/schema";
import { chavePeriodo } from "../../domain/relatorios";
import { gerarRelatorioTeste } from "./relatoriosTeste";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("gerarRelatorioTeste", () => {
  it("cria 3 marcas de teste (fora dos relatórios) e pedidos marcados como teste", async () => {
    const criados = await gerarRelatorioTeste(dexieRepository);
    expect(criados).toBeGreaterThan(0);

    const marcasTeste = await dexieRepository.listarMarcas({ incluirTeste: true });
    const teste = marcasTeste.filter((m) => m.teste);
    expect(teste.map((m) => m.nome).sort()).toEqual(["Teste 1", "Teste 2", "Teste 3"]);
    expect(teste.every((m) => m.visivelEmRelatorios === false)).toBe(true);
    // listarMarcas() (sem incluirTeste) não devolve nenhuma delas.
    expect((await dexieRepository.listarMarcas()).some((m) => m.teste)).toBe(false);

    const pedidos = await dexieRepository.listarPedidos();
    expect(pedidos.length).toBe(criados);
    expect(pedidos.every((p) => p.teste === true && p.status === "enviado")).toBe(true);
  });

  it("cobre várias semanas e vários meses, e traz pedidos com desconto", async () => {
    await gerarRelatorioTeste(dexieRepository);
    const pedidos = await dexieRepository.listarPedidos();

    const meses = new Set(pedidos.map((p) => chavePeriodo("mes", new Date(p.dataPedido + "T00:00:00"))));
    const semanas = new Set(
      pedidos.map((p) => chavePeriodo("semana", new Date(p.dataPedido + "T00:00:00"))),
    );
    expect(meses.size).toBeGreaterThanOrEqual(3);
    expect(semanas.size).toBeGreaterThanOrEqual(5);
    expect(pedidos.some((p) => p.descontoValor > 0)).toBe(true);
  });

  it("rodar de novo não duplica as marcas de teste", async () => {
    await gerarRelatorioTeste(dexieRepository);
    await gerarRelatorioTeste(dexieRepository);
    const marcas = (await dexieRepository.listarMarcas({ incluirTeste: true })).filter((m) => m.teste);
    expect(marcas).toHaveLength(3);
  });
});
