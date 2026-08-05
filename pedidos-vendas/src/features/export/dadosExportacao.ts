import { totaisPedido, totalItem, type TotaisPedido } from "../../domain/calculos";
import { mascararCep, mascararCpfCnpj, mascararTelefone } from "../../domain/cpfCnpj";
import { normalizar } from "../../domain/texto";
import { formatarData } from "../produtos/statusBase";
import type { Cliente, Pedido } from "../../domain/types";

/** Recorte do pedido pronto para exportar — o Excel e o PDF consomem exatamente isto. */
export interface DadosExportacao {
  numero: number;
  marca: string;
  dataPedido: string;
  formaSolicitacao: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    codigoCliente: string;
    telefone: string;
    endereco: string;
    bairro: string;
    cidadeEstado: string;
    cep: string;
    transportadora: string;
    condicaoPagamento: string;
    obsGerais: string;
  };
  representante: {
    nome: string;
    telefone: string;
    email: string;
  };
  itens: {
    item: number;
    qtd: number;
    embalagem: string;
    descricaoProduto: string;
    cor: string;
    padraoComplemento: string;
    descricao: string;
    valorUnit: number;
    total: number;
  }[];
  totais: TotaisPedido;
  descontoRotulo: string;
  descontoDescricao: string;
}

export function montarDadosExportacao(
  pedido: Pedido,
  cliente: Cliente | undefined,
): DadosExportacao {
  const totais = totaisPedido(pedido);

  return {
    numero: pedido.numero,
    marca: pedido.marca ?? "",
    dataPedido: formatarData(pedido.dataPedido),
    formaSolicitacao: pedido.formaSolicitacao ?? "",
    cliente: {
      nome: cliente?.nome ?? "",
      cpfCnpj: cliente ? mascararCpfCnpj(cliente.cpfCnpj) : "",
      codigoCliente: cliente?.codigoCliente ?? "",
      telefone: cliente?.telefone ? mascararTelefone(cliente.telefone) : "",
      endereco: cliente?.endereco ?? "",
      bairro: cliente?.bairro ?? "",
      cidadeEstado: cliente?.cidadeEstado ?? "",
      cep: cliente?.cep ? mascararCep(cliente.cep) : "",
      transportadora: pedido.transportadora ?? cliente?.transportadora ?? "",
      condicaoPagamento: pedido.condicaoPagamento ?? cliente?.condicaoPagamento ?? "",
      obsGerais: pedido.localEntrega ?? cliente?.obsGerais ?? "",
    },
    representante: {
      nome: pedido.representanteNome ?? "",
      telefone: pedido.representanteTelefone ?? "",
      email: pedido.representanteEmail ?? "",
    },
    itens: pedido.itens.map((item) => ({
      item: item.item,
      qtd: item.qtd,
      embalagem: item.embalagem ?? "",
      // Nome do produto sem os detalhes (cor) — "descricaoProduto" no item guarda
      // o texto combinado "Nome (Detalhes)" usado só para reabrir o fluxo guiado na
      // edição; os arquivos exportados mostram o nome + a variação de tamanho/tipo
      // (quando houver, ex.: "Arenito glitz médio") — detalhes continua fora.
      // "nomeExportado" (opcional) substitui só a parte do nome nesse texto — o
      // vendedor ajustou como o produto aparece no arquivo, sem mexer na base.
      descricaoProduto: [
        item.nomeExportado?.trim() || item.nomeProduto || item.descricaoProduto,
        item.variacaoProduto,
      ]
        .filter(Boolean)
        .join(" "),
      cor: item.cor ?? "",
      padraoComplemento: item.padraoComplemento ?? "",
      descricao: item.descricao ?? "",
      valorUnit: item.valorUnit,
      total: totalItem(item),
    })),
    totais,
    descontoRotulo:
      pedido.descontoTipo === "percentual"
        ? `Desconto (${pedido.descontoValor}%)`
        : "Desconto",
    descontoDescricao: pedido.descontoDescricao ?? "",
  };
}

/** Nome de arquivo seguro: sem acento, sem caractere proibido pelo sistema. */
export function nomeArquivo(dados: DadosExportacao, extensao: string): string {
  const cliente = normalizar(dados.cliente.nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const sufixo = cliente ? `-${cliente}` : "";
  return `pedido-${dados.numero}${sufixo}.${extensao}`;
}

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Espera o download engatar antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
