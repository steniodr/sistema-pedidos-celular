import { describe, expect, it } from "vitest";
import { mensagemErro } from "./erros";

describe("mensagemErro", () => {
  it("devolve mensagem específica para erro de armazenamento cheio", () => {
    const erro = new DOMException("boom", "QuotaExceededError");
    expect(mensagemErro(erro, "padrão")).toMatch(/armazenamento do celular está cheio/i);
  });

  it("devolve a mensagem do erro quando não é de quota", () => {
    expect(mensagemErro(new Error("Falha específica"), "padrão")).toBe("Falha específica");
  });

  it("devolve o padrão quando não é um Error", () => {
    expect(mensagemErro("qualquer coisa", "padrão")).toBe("padrão");
  });
});
