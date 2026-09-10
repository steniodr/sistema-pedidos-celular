import Dexie, { type EntityTable } from "dexie";
import type { CheckIn, Cliente, Marca, Pedido, Produto } from "../domain/types";
import { normalizar } from "../domain/texto";

/** Linha genérica de configuração/estado do app (chave → valor). */
export interface MetaRegistro {
  chave: string;
  valor: unknown;
}

export class PedidosDB extends Dexie {
  clientes!: EntityTable<Cliente, "id">;
  produtos!: EntityTable<Produto, "id">;
  pedidos!: EntityTable<Pedido, "id">;
  checkIns!: EntityTable<CheckIn, "id">;
  marcas!: EntityTable<Marca, "id">;
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
    // v3: nova entidade CheckIn (visita ao cliente, desacoplada do pedido) — o
    // horário deixa de ser gravado no pedido (ver Pedido em domain/types.ts).
    this.version(3).stores({
      clientes: "id, nome, cpfCnpj, atualizadoEm",
      produtos: "id, nome, embalagem",
      pedidos: "id, numero, status, criadoEm, clienteId",
      checkIns: "id, clienteId, data",
      meta: "chave",
    });
    // v4: marca vira cadastro (entidade Marca). Pedidos antigos não são
    // alterados a não ser por ganhar `marcaId`: cada texto distinto de
    // `pedido.marca` já existente vira uma Marca, e o pedido é religado a ela.
    this.version(4)
      .stores({
        clientes: "id, nome, cpfCnpj, atualizadoEm",
        produtos: "id, nome, embalagem",
        pedidos: "id, numero, status, criadoEm, clienteId",
        checkIns: "id, clienteId, data",
        marcas: "id, nome",
        meta: "chave",
      })
      .upgrade(async (tx) => {
        const agora = new Date().toISOString();
        const pedidos = (await tx.table("pedidos").toArray()) as Pedido[];
        // chave normalizada → { id, nome exibido }
        const marcasPorChave = new Map<string, { id: string; nome: string }>();
        for (const pedido of pedidos) {
          const nome = (pedido.marca ?? "").trim();
          if (!nome) continue;
          const chave = normalizar(nome);
          if (!marcasPorChave.has(chave)) {
            marcasPorChave.set(chave, { id: novoId(), nome });
          }
        }
        if (marcasPorChave.size > 0) {
          await tx.table("marcas").bulkAdd(
            [...marcasPorChave.values()].map((m) => ({
              id: m.id,
              nome: m.nome,
              visivelEmRelatorios: true,
              criadoEm: agora,
              atualizadoEm: agora,
            })),
          );
          await tx
            .table("pedidos")
            .toCollection()
            .modify((pedido: Record<string, unknown>) => {
              const nome = String(pedido.marca ?? "").trim();
              if (!nome) return;
              const marca = marcasPorChave.get(normalizar(nome));
              if (marca) pedido.marcaId = marca.id;
            });
        }
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
