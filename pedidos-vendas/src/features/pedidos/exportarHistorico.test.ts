import { describe, expect, it } from "vitest";
import { gerarPdfHistorico, montarLinhasHistorico, montarTextoHistorico } from "./exportarHistorico";
import type { Cliente, Pedido } from "../../domain/types";

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

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: "p1",
    numero: 1,
    marca: "MERKO",
    clienteId: "c1",
    dataPedido: "2026-08-01",
    horaPedido: "09:30",
    itens: [],
    descontoTipo: "percentual",
    descontoValor: 0,
    status: "enviado",
    criadoEm: "2026-08-01T09:30:00.000Z",
    atualizadoEm: "2026-08-01T09:30:00.000Z",
    ...overrides,
  };
}

describe("montarLinhasHistorico", () => {
  it("junta nome e código do cliente ao pedido", () => {
    const clientesPorId = new Map([["c1", cliente()]]);
    const linhas = montarLinhasHistorico([pedido()], clientesPorId);
    expect(linhas).toEqual([
      { dataPedido: "2026-08-01", horaPedido: "09:30", clienteNome: "Cliente Teste", clienteCodigo: "4521" },
    ]);
  });

  it("usa a hora de criadoEm quando o pedido não tem horaPedido (dados antigos)", () => {
    const clientesPorId = new Map([["c1", cliente()]]);
    const antigo = pedido({ horaPedido: undefined, criadoEm: "2026-08-01T14:05:00.000Z" });
    const [linha] = montarLinhasHistorico([antigo], clientesPorId);
    expect(linha.horaPedido).toBe(
      `${String(new Date(antigo.criadoEm).getHours()).padStart(2, "0")}:${String(
        new Date(antigo.criadoEm).getMinutes(),
      ).padStart(2, "0")}`,
    );
  });

  it("marca 'Cliente removido' quando o cliente não existe mais", () => {
    const [linha] = montarLinhasHistorico([pedido({ clienteId: "inexistente" })], new Map());
    expect(linha.clienteNome).toBe("Cliente removido");
    expect(linha.clienteCodigo).toBe("");
  });
});

describe("montarTextoHistorico", () => {
  it("agrupa por data (DD/MM), ordena por horário e junta nome + código", () => {
    const clientesPorId = new Map([
      ["c1", cliente({ nome: "CAF", codigoCliente: "14539" })],
      ["c2", cliente({ id: "c2", nome: "El shaday", codigoCliente: "9497" })],
    ]);
    const linhas = montarLinhasHistorico(
      [
        pedido({ id: "p1", clienteId: "c2", dataPedido: "2026-07-16", horaPedido: "08:28" }),
        pedido({ id: "p2", clienteId: "c1", dataPedido: "2026-07-16", horaPedido: "07:37" }),
      ],
      clientesPorId,
    );
    expect(montarTextoHistorico(linhas)).toBe(
      "16/07\n07:37 CAF 14539\n08:28 El shaday 9497",
    );
  });

  it("separa datas diferentes com linha em branco, mais recente primeiro", () => {
    const clientesPorId = new Map([["c1", cliente({ nome: "CAF", codigoCliente: "14539" })]]);
    const linhas = montarLinhasHistorico(
      [
        pedido({ id: "p1", clienteId: "c1", dataPedido: "2026-07-15", horaPedido: "10:00" }),
        pedido({ id: "p2", clienteId: "c1", dataPedido: "2026-07-16", horaPedido: "09:00" }),
      ],
      clientesPorId,
    );
    expect(montarTextoHistorico(linhas)).toBe(
      "16/07\n09:00 CAF 14539\n\n15/07\n10:00 CAF 14539",
    );
  });

  it("omite o código quando o cliente não tem um cadastrado", () => {
    const clientesPorId = new Map([["c1", cliente({ nome: "CAF", codigoCliente: undefined })]]);
    const linhas = montarLinhasHistorico([pedido()], clientesPorId);
    expect(montarTextoHistorico(linhas)).toBe("01/08\n09:30 CAF");
  });

  it("devolve string vazia sem pedidos", () => {
    expect(montarTextoHistorico([])).toBe("");
  });
});

describe("gerarPdfHistorico", () => {
  it("gera um PDF válido agrupando por data, sem lançar exceção", async () => {
    const clientesPorId = new Map([
      ["c1", cliente({ nome: "Multimix" })],
      ["c2", cliente({ id: "c2", nome: "Renove", codigoCliente: "1001" })],
    ]);
    const linhas = montarLinhasHistorico(
      [
        pedido({ id: "p1", clienteId: "c1", dataPedido: "2026-08-01", horaPedido: "09:00" }),
        pedido({ id: "p2", clienteId: "c2", dataPedido: "2026-08-01", horaPedido: "08:00" }),
        pedido({ id: "p3", clienteId: "c1", dataPedido: "2026-07-30", horaPedido: "11:00" }),
      ],
      clientesPorId,
    );
    const blob = await gerarPdfHistorico(linhas, "Histórico — todos os pedidos");
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/pdf");
  });

  it("gera sem lançar exceção quando não há pedidos", async () => {
    const blob = await gerarPdfHistorico([], "Histórico — pedidos enviados");
    expect(blob.size).toBeGreaterThan(0);
  });
});
