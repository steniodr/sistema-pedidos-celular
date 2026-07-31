import { beforeEach, describe, expect, it } from "vitest";
import { dexieRepository } from "../../data/dexieRepository";
import { db } from "../../db/schema";
import { validarCpfCnpj } from "../../domain/cpfCnpj";
import { semearClientesTeste } from "./clientesTeste";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("semearClientesTeste", () => {
  it("cria os 2 clientes de teste com documento válido", async () => {
    const criados = await semearClientesTeste(dexieRepository);
    expect(criados).toBe(2);

    const clientes = await dexieRepository.listarClientes();
    expect(clientes).toHaveLength(2);
    for (const cliente of clientes) {
      expect(cliente.nome).toContain("(teste)");
      expect(validarCpfCnpj(cliente.cpfCnpj)).toBe(true);
    }
  });

  it("não duplica ao rodar de novo", async () => {
    await semearClientesTeste(dexieRepository);
    const criadosSegundaVez = await semearClientesTeste(dexieRepository);

    expect(criadosSegundaVez).toBe(0);
    expect(await dexieRepository.listarClientes()).toHaveLength(2);
  });

  it("preserva clientes já cadastrados pelo vendedor", async () => {
    await dexieRepository.salvarCliente({ nome: "Cliente Real", cpfCnpj: "39053344705" });
    await semearClientesTeste(dexieRepository);

    const clientes = await dexieRepository.listarClientes();
    expect(clientes).toHaveLength(3);
    expect(clientes.some((c) => c.nome === "Cliente Real")).toBe(true);
  });

  it("fica removível depois: apagar os 2 clientes de teste não afeta os demais", async () => {
    await dexieRepository.salvarCliente({ nome: "Cliente Real", cpfCnpj: "39053344705" });
    await semearClientesTeste(dexieRepository);

    const teste = (await dexieRepository.listarClientes()).filter((c) =>
      c.nome.includes("(teste)"),
    );
    for (const cliente of teste) {
      await dexieRepository.removerCliente(cliente.id);
    }

    const restantes = await dexieRepository.listarClientes();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].nome).toBe("Cliente Real");
  });
});
