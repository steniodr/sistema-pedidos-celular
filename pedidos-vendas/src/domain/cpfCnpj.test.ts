import { describe, expect, it } from "vitest";
import {
  mascararCpfCnpj,
  mascararTelefone,
  validarCNPJ,
  validarCPF,
  validarCpfCnpj,
} from "./cpfCnpj";

describe("validarCPF", () => {
  it("aceita CPF válido com e sem máscara", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarCPF("529.982.247-26")).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(validarCPF("111.111.111-11")).toBe(false);
    expect(validarCPF("00000000000")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(validarCPF("5299822472")).toBe(false);
    expect(validarCPF("")).toBe(false);
  });
});

describe("validarCNPJ", () => {
  it("aceita CNPJ válido com e sem máscara", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarCNPJ("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(validarCNPJ("11111111111111")).toBe(false);
  });
});

describe("validarCpfCnpj", () => {
  it("escolhe a validação pelo tamanho", () => {
    expect(validarCpfCnpj("529.982.247-25")).toBe(true);
    expect(validarCpfCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita tamanho que não é nem CPF nem CNPJ", () => {
    expect(validarCpfCnpj("123456789012")).toBe(false);
  });
});

describe("mascararCpfCnpj", () => {
  it("formata CPF completo", () => {
    expect(mascararCpfCnpj("52998224725")).toBe("529.982.247-25");
  });

  it("formata CNPJ completo", () => {
    expect(mascararCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formata parcialmente enquanto o usuário digita", () => {
    expect(mascararCpfCnpj("529")).toBe("529");
    expect(mascararCpfCnpj("529982")).toBe("529.982");
  });

  it("descarta dígitos além do CNPJ", () => {
    expect(mascararCpfCnpj("112223330001819999")).toBe("11.222.333/0001-81");
  });
});

describe("mascararTelefone", () => {
  it("formata celular (11 dígitos) com 5 dígitos antes do hífen", () => {
    expect(mascararTelefone("11978319643")).toBe("(11) 97831-9643");
  });

  it("formata fixo (10 dígitos) com 4 dígitos antes do hífen", () => {
    expect(mascararTelefone("1133334444")).toBe("(11) 3333-4444");
  });

  it("conserta um valor que ficou meio formatado enquanto o vendedor digitava", () => {
    // Regressão do export: o formulário guardava o TEXTO exibido, e ao digitar
    // o 11º número o texto ainda estava no formato de fixo — virava
    // "(11) 9783-19643", que ia cru para o Excel/PDF.
    expect(mascararTelefone("(11) 9783-19643")).toBe("(11) 97831-9643");
  });

  it("é idempotente: mascarar de novo não estraga", () => {
    const uma = mascararTelefone("11978319643");
    expect(mascararTelefone(uma)).toBe(uma);
  });

  it("aguenta valor parcial e vazio", () => {
    expect(mascararTelefone("")).toBe("");
    expect(mascararTelefone("11")).toBe("11");
    expect(mascararTelefone("119")).toBe("(11) 9");
  });
});
