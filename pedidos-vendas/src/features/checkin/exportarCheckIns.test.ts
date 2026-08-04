import { describe, expect, it } from "vitest";
import { gerarPdfCheckIns, linhasDeCheckIns, montarTextoCheckIns } from "./exportarCheckIns";
import type { CheckIn, Cliente } from "../../domain/types";

function cliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: "c1",
    nome: "Cliente Teste",
    cpfCnpj: "11222333000181",
    codigoCliente: "4521",
    criadoEm: "2026-07-01T10:00:00.000Z",
    atualizadoEm: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function checkIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: "ck1",
    clienteId: "c1",
    data: "2026-08-01",
    hora: "09:30",
    criadoEm: "2026-08-01T09:30:00.000Z",
    atualizadoEm: "2026-08-01T09:30:00.000Z",
    ...overrides,
  };
}

describe("linhasDeCheckIns", () => {
  it("junta nome e código do cliente ao check-in", () => {
    const clientesPorId = new Map([["c1", cliente()]]);
    const linhas = linhasDeCheckIns([checkIn()], clientesPorId);
    expect(linhas).toEqual([
      { data: "2026-08-01", hora: "09:30", clienteNome: "Cliente Teste", clienteCodigo: "4521" },
    ]);
  });

  it("marca 'Cliente removido' quando o cliente não existe mais", () => {
    const [linha] = linhasDeCheckIns([checkIn({ clienteId: "inexistente" })], new Map());
    expect(linha.clienteNome).toBe("Cliente removido");
    expect(linha.clienteCodigo).toBe("");
  });
});

describe("montarTextoCheckIns", () => {
  it("agrupa por data (DD/MM), ordena por horário e junta nome + código", () => {
    const clientesPorId = new Map([
      ["c1", cliente({ nome: "CAF", codigoCliente: "14539" })],
      ["c2", cliente({ id: "c2", nome: "El shaday", codigoCliente: "9497" })],
    ]);
    const linhas = linhasDeCheckIns(
      [
        checkIn({ id: "ck1", clienteId: "c2", data: "2026-07-16", hora: "08:28" }),
        checkIn({ id: "ck2", clienteId: "c1", data: "2026-07-16", hora: "07:37" }),
      ],
      clientesPorId,
    );
    expect(montarTextoCheckIns(linhas)).toBe("16/07\n07:37 CAF 14539\n08:28 El shaday 9497");
  });

  it("separa datas diferentes com linha em branco, mais recente primeiro", () => {
    const clientesPorId = new Map([["c1", cliente({ nome: "CAF", codigoCliente: "14539" })]]);
    const linhas = linhasDeCheckIns(
      [
        checkIn({ id: "ck1", clienteId: "c1", data: "2026-07-15", hora: "10:00" }),
        checkIn({ id: "ck2", clienteId: "c1", data: "2026-07-16", hora: "09:00" }),
      ],
      clientesPorId,
    );
    expect(montarTextoCheckIns(linhas)).toBe("16/07\n09:00 CAF 14539\n\n15/07\n10:00 CAF 14539");
  });

  it("omite o código quando o cliente não tem um cadastrado", () => {
    const clientesPorId = new Map([["c1", cliente({ nome: "CAF", codigoCliente: undefined })]]);
    const linhas = linhasDeCheckIns([checkIn()], clientesPorId);
    expect(montarTextoCheckIns(linhas)).toBe("01/08\n09:30 CAF");
  });

  it("devolve string vazia sem check-ins", () => {
    expect(montarTextoCheckIns([])).toBe("");
  });
});

describe("gerarPdfCheckIns", () => {
  it("gera um PDF válido agrupando por data, sem lançar exceção", async () => {
    const clientesPorId = new Map([
      ["c1", cliente({ nome: "Multimix" })],
      ["c2", cliente({ id: "c2", nome: "Renove", codigoCliente: "1001" })],
    ]);
    const linhas = linhasDeCheckIns(
      [
        checkIn({ id: "ck1", clienteId: "c1", data: "2026-08-01", hora: "09:00" }),
        checkIn({ id: "ck2", clienteId: "c2", data: "2026-08-01", hora: "08:00" }),
        checkIn({ id: "ck3", clienteId: "c1", data: "2026-07-30", hora: "11:00" }),
      ],
      clientesPorId,
    );
    const blob = await gerarPdfCheckIns(linhas, "Check-in — todos");
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/pdf");
  });

  it("gera sem lançar exceção quando não há check-ins", async () => {
    const blob = await gerarPdfCheckIns([], "Check-in — todos");
    expect(blob.size).toBeGreaterThan(0);
  });
});
