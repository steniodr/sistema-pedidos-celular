import Dexie, { type EntityTable } from "dexie";
import type { Cliente, Pedido, Produto } from "../domain/types";

/** Linha genérica de configuração/estado do app (chave → valor). */
export interface MetaRegistro {
  chave: string;
  valor: unknown;
}

export class PedidosDB extends Dexie {
  clientes!: EntityTable<Cliente, "id">;
  produtos!: EntityTable<Produto, "id">;
  pedidos!: EntityTable<Pedido, "id">;
  meta!: EntityTable<MetaRegistro, "chave">;

  constructor() {
    super("pedidos-vendas");
    this.version(1).stores({
      clientes: "id, nome, cpfCnpj, atualizadoEm",
      produtos: "id, descricaoProduto, embalagem",
      pedidos: "id, numero, status, criadoEm, clienteId",
      meta: "chave",
    });
    // v2: Produto separa "nome" e "detalhes" (antes concatenados em descricaoProduto),
    // para permitir mostrar os detalhes como campo de leitura na tela de item.
    this.version(2)
      .stores({
        clientes: "id, nome, cpfCnpj, atualizadoEm",
        produtos: "id, nome, embalagem",
        pedidos: "id, numero, status, criadoEm, clienteId",
        meta: "chave",
      })
      .upgrade(async (tx) => {
        await tx
          .table("produtos")
          .toCollection()
          .modify((produto: Record<string, unknown>) => {
            const bruto = String(produto.descricaoProduto ?? "");
            const casado = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(bruto);
            if (casado) {
              produto.nome = casado[1];
              produto.detalhes = casado[2];
            } else {
              produto.nome = bruto;
            }
            delete produto.descricaoProduto;
          });
      });
  }
}

export const db = new PedidosDB();

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function agora(): string {
  return new Date().toISOString();
}
