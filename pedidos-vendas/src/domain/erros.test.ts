import { describe, expect, it } from "vitest";
import { ehAppDesatualizado, mensagemErro } from "./erros";

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

describe("ehAppDesatualizado", () => {
  it("reconhece as falhas de pedaço do app carregado sob demanda", () => {
    // Mensagens reais do navegador quando a aba está numa versão antiga e pede
    // um chunk cujo hash não existe mais no servidor.
    const casos = [
      new Error(
        "Failed to fetch dynamically imported module: http://192.168.0.27:4173/assets/exceljs.min-BjjhH08z.js",
      ),
      new Error(
        'Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".',
      ),
      new TypeError("error loading dynamically imported module"),
      new Error("Importing a module script failed."),
    ];
    for (const caso of casos) {
      expect(ehAppDesatualizado(caso)).toBe(true);
    }
  });

  it("não confunde com erro comum de gravação/exportação", () => {
    expect(ehAppDesatualizado(new Error("O armazenamento do celular está cheio."))).toBe(false);
    expect(ehAppDesatualizado(new Error("Planilha inválida"))).toBe(false);
    expect(ehAppDesatualizado(undefined)).toBe(false);
  });

  it("não atrapalha a mensagem de cota cheia", () => {
    const quota = new Error("quota exceeded");
    expect(ehAppDesatualizado(quota)).toBe(false);
    expect(mensagemErro(quota, "padrão")).toMatch(/armazenamento do celular/);
  });
});
