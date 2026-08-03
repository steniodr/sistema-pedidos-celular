import { validarCpfCnpj } from "../../domain/cpfCnpj";
import {
  cabecalhoNormalizado,
  encontrarIndice,
  linhaVazia,
  textoDaCelula,
  type LinhaIgnorada,
} from "../../domain/planilha";
import type { EntradaCliente } from "../../data/repository";

/**
 * Leitura de planilhas de base de clientes — sempre uma linha por cliente
 * (ao contrário de produtos, não existe formato "matriz" aqui). Os nomes
 * exatos de coluna variam por planilha; a detecção é por lista de aliases,
 * testada contra o molde real (relatório "BR TINTAS - BASE DE CLIENTES").
 */

export type CampoCliente =
  | "nome"
  | "nomeFantasia"
  | "cpfCnpj"
  | "codigoCliente"
  | "contato"
  | "telefone"
  | "endereco"
  | "bairro"
  | "cidade"
  | "uf"
  | "cep"
  | "situacao"
  | "obsGerais";

export type MapeamentoClientes = Record<CampoCliente, number | null>;

export interface PlanilhaLidaClientes {
  linhas: unknown[][];
  linhaCabecalho: number;
  cabecalho: string[];
  mapeamento: MapeamentoClientes;
}

export interface ResultadoConversaoClientes {
  clientes: EntradaCliente[];
  ignorados: LinhaIgnorada[];
}

const ALIASES: Record<CampoCliente, string[]> = {
  nome: ["razaosocialnome", "razaosocial", "nomecliente", "nome", "cliente"],
  nomeFantasia: ["nomefantasia", "fantasia"],
  cpfCnpj: ["cpfcnpj", "cnpj", "cpf", "documento"],
  codigoCliente: ["codigo", "codigocliente", "cod"],
  contato: ["contato", "responsavel"],
  telefone: ["telefone1", "telefone", "fone", "celular", "whatsapp"],
  endereco: ["endereco", "logradouro"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio"],
  uf: ["uf", "estado"],
  cep: ["cep"],
  situacao: ["situacao", "status"],
  obsGerais: ["observacoesnf", "observacoes", "observacao", "obsgerais", "obs"],
};

export function detectarMapeamentoClientes(cabecalho: string[]): MapeamentoClientes {
  const chaves = cabecalhoNormalizado(cabecalho);
  const mapeamento = {} as MapeamentoClientes;
  for (const campo of Object.keys(ALIASES) as CampoCliente[]) {
    mapeamento[campo] = encontrarIndice(chaves, ALIASES[campo]);
  }
  return mapeamento;
}

/** Procura a linha de cabeçalho nas primeiras linhas do arquivo. */
export function analisarLinhasClientes(linhas: unknown[][], limiteBusca = 15): PlanilhaLidaClientes {
  for (let i = 0; i < Math.min(linhas.length, limiteBusca); i++) {
    const cabecalho = (linhas[i] ?? []).map(textoDaCelula);
    if (cabecalho.filter(Boolean).length < 2) continue;

    const mapeamento = detectarMapeamentoClientes(cabecalho);
    if (mapeamento.nome !== null && mapeamento.cpfCnpj !== null) {
      return { linhas, linhaCabecalho: i, cabecalho, mapeamento };
    }
  }

  const primeira = (linhas[0] ?? []).map(textoDaCelula);
  return {
    linhas,
    linhaCabecalho: -1,
    cabecalho: primeira,
    mapeamento: detectarMapeamentoClientes(primeira),
  };
}

function campo(linha: unknown[], indice: number | null): string | undefined {
  if (indice === null) return undefined;
  const valor = textoDaCelula(linha[indice]);
  return valor || undefined;
}

export function converterClientes(
  planilha: PlanilhaLidaClientes,
  mapeamento: MapeamentoClientes,
): ResultadoConversaoClientes {
  const clientes: EntradaCliente[] = [];
  const ignorados: LinhaIgnorada[] = [];

  const inicio = planilha.linhaCabecalho + 1;
  if (mapeamento.nome === null) return { clientes, ignorados };

  for (let i = inicio; i < planilha.linhas.length; i++) {
    const linha = planilha.linhas[i] ?? [];
    const numeroLinha = i + 1;
    if (linhaVazia(linha)) continue;

    const nome = campo(linha, mapeamento.nome);
    if (!nome) {
      ignorados.push({ linha: numeroLinha, motivo: "Sem nome do cliente" });
      continue;
    }

    const cpfCnpj = campo(linha, mapeamento.cpfCnpj) ?? "";
    if (!validarCpfCnpj(cpfCnpj)) {
      ignorados.push({
        linha: numeroLinha,
        motivo: cpfCnpj ? `CPF/CNPJ inválido (“${cpfCnpj}”)` : "Sem CPF/CNPJ",
      });
      continue;
    }

    const cidade = campo(linha, mapeamento.cidade);
    const uf = campo(linha, mapeamento.uf);
    const cidadeEstado = cidade && uf ? `${cidade} - ${uf}` : cidade ?? uf;

    clientes.push({
      nome,
      nomeFantasia: campo(linha, mapeamento.nomeFantasia),
      cpfCnpj,
      codigoCliente: campo(linha, mapeamento.codigoCliente),
      contato: campo(linha, mapeamento.contato),
      telefone: campo(linha, mapeamento.telefone),
      endereco: campo(linha, mapeamento.endereco),
      bairro: campo(linha, mapeamento.bairro),
      cidadeEstado,
      cep: campo(linha, mapeamento.cep),
      situacao: campo(linha, mapeamento.situacao),
      obsGerais: campo(linha, mapeamento.obsGerais),
    });
  }

  return { clientes, ignorados };
}
