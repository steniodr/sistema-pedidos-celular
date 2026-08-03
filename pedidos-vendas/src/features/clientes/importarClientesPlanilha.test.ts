import { describe, expect, it } from "vitest";
import {
  analisarLinhasClientes,
  converterClientes,
  detectarMapeamentoClientes,
} from "./importarClientesPlanilha";

const CPF_VALIDO = "52998224725";
const CNPJ_VALIDO = "11222333000181";

describe("detectarMapeamentoClientes", () => {
  it("casa os nomes canônicos do relatório real (BR TINTAS - BASE DE CLIENTES)", () => {
    const cabecalho = [
      "Codigo",
      "Carteira",
      "Razao Social / Nome",
      "Nome Fantasia",
      "Endereco",
      "Bairro",
      "Cidade",
      "UF",
      "CEP",
      "Contato",
      "Telefone 1",
      "Telefone 2",
      "Fax",
      "Ultima Compra",
      "Dias sem Compra",
      "Situacao",
      "Rota",
      "CNPJ",
      "Inscricao Estadual",
      "Observacoes NF",
      "Conferir no PDF",
    ];
    const mapa = detectarMapeamentoClientes(cabecalho);
    expect(mapa.codigoCliente).toBe(0);
    expect(mapa.nome).toBe(2);
    expect(mapa.nomeFantasia).toBe(3);
    expect(mapa.endereco).toBe(4);
    expect(mapa.bairro).toBe(5);
    expect(mapa.cidade).toBe(6);
    expect(mapa.uf).toBe(7);
    expect(mapa.cep).toBe(8);
    expect(mapa.contato).toBe(9);
    expect(mapa.telefone).toBe(10);
    expect(mapa.situacao).toBe(15);
    expect(mapa.cpfCnpj).toBe(17);
    expect(mapa.obsGerais).toBe(19);
  });

  it("devolve null para coluna ausente", () => {
    const mapa = detectarMapeamentoClientes(["Nome", "CNPJ"]);
    expect(mapa.nome).toBe(0);
    expect(mapa.cpfCnpj).toBe(1);
    expect(mapa.telefone).toBeNull();
  });
});

describe("analisarLinhasClientes", () => {
  it("acha o cabeçalho depois de linhas de título", () => {
    const planilha = analisarLinhasClientes([
      ["BR TINTAS - BASE DE CLIENTES | Relatorio de 29/01/2026"],
      [],
      ["Codigo", "Razao Social / Nome", "CNPJ"],
      ["001", "Cliente Teste", CNPJ_VALIDO],
    ]);
    expect(planilha.linhaCabecalho).toBe(2);
    expect(planilha.mapeamento.nome).toBe(1);
    expect(planilha.mapeamento.cpfCnpj).toBe(2);
  });

  it("marca -1 quando não encontra nome e CPF/CNPJ juntos", () => {
    const planilha = analisarLinhasClientes([
      ["coluna a", "coluna b"],
      ["x", "y"],
    ]);
    expect(planilha.linhaCabecalho).toBe(-1);
  });
});

describe("converterClientes", () => {
  const planilha = analisarLinhasClientes([
    ["Codigo", "Razao Social / Nome", "Cidade", "UF", "CNPJ", "Situacao", "Observacoes NF"],
    ["001", "Multimix Materiais", "Campo Grande", "MS", CNPJ_VALIDO, "Ativo", "Recebe até 15h"],
    ["002", "Cliente pessoa física", "Campo Grande", "MS", CPF_VALIDO, "Ativo", ""],
    ["", "", "", "", "", "", ""],
    ["003", "", "Campo Grande", "MS", CNPJ_VALIDO, "Ativo", ""],
    ["004", "CNPJ inválido", "Campo Grande", "MS", "11111111000199", "Ativo", ""],
    ["005", "Sem documento", "Campo Grande", "MS", "", "Inativo", ""],
  ]);

  it("converte as linhas válidas, combinando cidade e UF", () => {
    const { clientes } = converterClientes(planilha, planilha.mapeamento);
    expect(clientes).toEqual([
      {
        nome: "Multimix Materiais",
        nomeFantasia: undefined,
        cpfCnpj: CNPJ_VALIDO,
        codigoCliente: "001",
        contato: undefined,
        telefone: undefined,
        endereco: undefined,
        bairro: undefined,
        cidadeEstado: "Campo Grande - MS",
        cep: undefined,
        situacao: "Ativo",
        obsGerais: "Recebe até 15h",
      },
      {
        nome: "Cliente pessoa física",
        nomeFantasia: undefined,
        cpfCnpj: CPF_VALIDO,
        codigoCliente: "002",
        contato: undefined,
        telefone: undefined,
        endereco: undefined,
        bairro: undefined,
        cidadeEstado: "Campo Grande - MS",
        cep: undefined,
        situacao: "Ativo",
        obsGerais: undefined,
      },
    ]);
  });

  it("ignora linha em branco, sem nome, com CPF/CNPJ inválido ou ausente", () => {
    const { ignorados } = converterClientes(planilha, planilha.mapeamento);
    expect(ignorados.map((i) => i.linha)).toEqual([5, 6, 7]);
    expect(ignorados[0].motivo).toMatch(/nome/i);
    expect(ignorados[1].motivo).toMatch(/inválido/i);
    expect(ignorados[2].motivo).toMatch(/sem cpf\/cnpj/i);
  });

  it("não converte nada sem a coluna de nome mapeada", () => {
    const { clientes } = converterClientes(planilha, { ...planilha.mapeamento, nome: null });
    expect(clientes).toEqual([]);
  });
});
