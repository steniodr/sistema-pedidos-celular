import { agora, db, novoId } from "../db/schema";
import type {
  Cliente,
  ImportacaoInfo,
  Pedido,
  Produto,
  Representante,
} from "../domain/types";
import { somenteDigitos } from "../domain/cpfCnpj";
import { normalizar } from "../domain/texto";
import type {
  BackupDados,
  EntradaCliente,
  EntradaProduto,
  EntradaProdutoUnico,
  FiltroPedidos,
  ImportacaoClientesInfo,
  NovoPedido,
  Repository,
} from "./repository";

const CHAVE_IMPORTACAO = "ultimaImportacao";
const CHAVE_REPRESENTANTE = "representante";

/** "HH:mm" local a partir de um ISO — usado como horário padrão do pedido. */
function horaDeIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Campos de texto não vazios da entrada — usado para mesclar sem apagar dados existentes. */
function camposPreenchidos(entrada: EntradaCliente): Partial<Cliente> {
  const preenchido: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(entrada)) {
    if (chave === "id") continue;
    if (typeof valor === "string" && valor.trim() !== "") preenchido[chave] = valor;
  }
  return preenchido as Partial<Cliente>;
}

export const dexieRepository: Repository = {
  async listarClientes(busca) {
    const todos = await db.clientes.orderBy("nome").toArray();
    if (!busca?.trim()) return todos;

    const alvo = normalizar(busca);
    const digitos = somenteDigitos(busca);
    return todos.filter(
      (c) =>
        normalizar(c.nome).includes(alvo) ||
        (digitos.length > 0 && somenteDigitos(c.cpfCnpj).includes(digitos)) ||
        normalizar(c.codigoCliente || "").includes(alvo),
    );
  },

  async obterCliente(id) {
    return db.clientes.get(id);
  },

  async salvarCliente(entrada: EntradaCliente) {
    const existente = entrada.id ? await db.clientes.get(entrada.id) : undefined;
    const cliente: Cliente = {
      ...entrada,
      id: existente?.id ?? entrada.id ?? novoId(),
      criadoEm: existente?.criadoEm ?? agora(),
      atualizadoEm: agora(),
    };
    await db.clientes.put(cliente);
    return cliente;
  },

  async removerCliente(id) {
    await db.clientes.delete(id);
  },

  async restaurarCliente(cliente) {
    await db.clientes.put(cliente);
  },

  async importarClientes(entradas: EntradaCliente[], arquivo: string) {
    const quandoEm = agora();
    const existentes = await db.clientes.toArray();
    const existentePorDoc = new Map(existentes.map((c) => [somenteDigitos(c.cpfCnpj), c]));

    const paraGravar = new Map<string, Cliente>();
    let totalNovos = 0;
    let totalAtualizados = 0;
    let totalIgnorados = 0;

    for (const entrada of entradas) {
      const doc = somenteDigitos(entrada.cpfCnpj);
      const jaProcessadoNesteLote = paraGravar.has(doc);
      const base = paraGravar.get(doc) ?? existentePorDoc.get(doc);

      const mesclado: Cliente = base
        ? { ...base, ...camposPreenchidos(entrada), atualizadoEm: quandoEm }
        : { ...entrada, id: novoId(), criadoEm: quandoEm, atualizadoEm: quandoEm };
      paraGravar.set(doc, mesclado);

      if (jaProcessadoNesteLote) {
        // Mesmo CPF/CNPJ apareceu mais de uma vez no arquivo: a última linha prevalece.
        totalIgnorados++;
        continue;
      }
      if (existentePorDoc.has(doc)) totalAtualizados++;
      else totalNovos++;
    }

    await db.transaction("rw", db.clientes, async () => {
      await db.clientes.bulkPut([...paraGravar.values()]);
    });

    const info: ImportacaoClientesInfo = {
      arquivo,
      quandoEm,
      totalNovos,
      totalAtualizados,
      totalIgnorados,
    };
    return info;
  },

  async listarProdutos(busca, limite = 50) {
    if (!busca?.trim()) {
      return db.produtos.orderBy("nome").limit(limite).toArray();
    }
    // Casa todos os termos digitados, em qualquer ordem.
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    return db.produtos
      .orderBy("nome")
      .filter((p) => {
        const alvo = normalizar(`${p.nome} ${p.detalhes ?? ""} ${p.embalagem}`);
        return termos.every((t) => alvo.includes(t));
      })
      .limit(limite)
      .toArray();
  },

  async listarNomesProdutos(busca, limite = 20) {
    const termos = normalizar(busca ?? "").split(/\s+/).filter(Boolean);
    const nomes = new Set<string>();
    await db.produtos
      .orderBy("nome")
      .until(() => nomes.size >= limite)
      .each((p) => {
        if (termos.length === 0 || termos.every((t) => normalizar(p.nome).includes(t))) {
          nomes.add(p.nome);
        }
      });
    return [...nomes].slice(0, limite);
  },

  async listarVariantesPorNome(nome) {
    return db.produtos.where("nome").equals(nome).toArray();
  },

  async obterProduto(id) {
    return db.produtos.get(id);
  },

  async salvarProduto(entrada: EntradaProdutoUnico) {
    const existente = entrada.id ? await db.produtos.get(entrada.id) : undefined;
    const produto: Produto = {
      ...entrada,
      id: existente?.id ?? entrada.id ?? novoId(),
      origemArquivo: existente?.origemArquivo ?? "cadastro manual",
      atualizadoEm: agora(),
    };
    await db.produtos.put(produto);
    return produto;
  },

  async removerProduto(id) {
    await db.produtos.delete(id);
  },

  async restaurarProduto(produto) {
    await db.produtos.put(produto);
  },

  async contarProdutos() {
    return db.produtos.count();
  },

  async substituirBaseProdutos(entradas: EntradaProduto[], arquivo: string) {
    const quandoEm = agora();
    const produtos: Produto[] = entradas.map((e) => ({
      ...e,
      id: novoId(),
      origemArquivo: arquivo,
      atualizadoEm: quandoEm,
    }));

    const info: ImportacaoInfo = {
      arquivo,
      quandoEm,
      totalProdutos: produtos.length,
    };

    await db.transaction("rw", db.produtos, db.meta, async () => {
      await db.produtos.clear();
      await db.produtos.bulkAdd(produtos);
      await db.meta.put({ chave: CHAVE_IMPORTACAO, valor: info });
    });

    return info;
  },

  async obterUltimaImportacao() {
    const registro = await db.meta.get(CHAVE_IMPORTACAO);
    return registro?.valor as ImportacaoInfo | undefined;
  },

  async listarPedidos(filtro: FiltroPedidos = {}) {
    let pedidos = await db.pedidos.orderBy("numero").reverse().toArray();
    if (filtro.status) pedidos = pedidos.filter((p) => p.status === filtro.status);
    if (filtro.marca) pedidos = pedidos.filter((p) => p.marca === filtro.marca);
    if (filtro.clienteId) pedidos = pedidos.filter((p) => p.clienteId === filtro.clienteId);
    if (filtro.busca?.trim()) {
      const alvo = normalizar(filtro.busca);
      const nomePorClienteId = new Map((await db.clientes.toArray()).map((c) => [c.id, c.nome]));
      pedidos = pedidos.filter(
        (p) =>
          String(p.numero).includes(alvo) ||
          normalizar(p.marca).includes(alvo) ||
          normalizar(nomePorClienteId.get(p.clienteId) ?? "").includes(alvo),
      );
    }
    return pedidos;
  },

  async obterPedido(id) {
    return db.pedidos.get(id);
  },

  async salvarPedido(pedido) {
    const atualizado: Pedido = { ...pedido, atualizadoEm: agora() };
    await db.pedidos.put(atualizado);
    return atualizado;
  },

  async removerPedido(id) {
    await db.pedidos.delete(id);
  },

  async restaurarPedido(pedido) {
    await db.pedidos.put(pedido);
  },

  async proximoNumeroPedido() {
    const ultimo = await db.pedidos.orderBy("numero").last();
    return (ultimo?.numero ?? 0) + 1;
  },

  async criarPedido({ clienteId, marca }: NovoPedido) {
    const representante = await this.obterRepresentante();
    const momento = agora();
    const pedido: Pedido = {
      id: novoId(),
      numero: await this.proximoNumeroPedido(),
      marca,
      clienteId,
      dataPedido: momento.slice(0, 10),
      horaPedido: horaDeIso(momento),
      representanteNome: representante?.nome,
      representanteTelefone: representante?.telefone,
      representanteEmail: representante?.email,
      formaSolicitacao: "",
      itens: [],
      descontoTipo: "percentual",
      descontoValor: 0,
      status: "rascunho",
      criadoEm: momento,
      atualizadoEm: momento,
    };
    await db.pedidos.add(pedido);
    return pedido;
  },

  async duplicarPedido(id) {
    const original = await db.pedidos.get(id);
    if (!original) throw new Error("Pedido não encontrado");

    const momento = agora();
    const copia: Pedido = {
      ...original,
      id: novoId(),
      numero: await this.proximoNumeroPedido(),
      dataPedido: momento.slice(0, 10),
      horaPedido: horaDeIso(momento),
      status: "rascunho",
      itens: original.itens.map((item) => ({ ...item })),
      criadoEm: momento,
      atualizadoEm: momento,
    };
    await db.pedidos.add(copia);
    return copia;
  },

  async obterRepresentante() {
    const registro = await db.meta.get(CHAVE_REPRESENTANTE);
    return registro?.valor as Representante | undefined;
  },

  async salvarRepresentante(representante) {
    await db.meta.put({ chave: CHAVE_REPRESENTANTE, valor: representante });
  },

  async exportarBackup() {
    const [clientes, produtos, pedidos, representante, ultimaImportacao] = await Promise.all([
      db.clientes.toArray(),
      db.produtos.toArray(),
      db.pedidos.toArray(),
      this.obterRepresentante(),
      this.obterUltimaImportacao(),
    ]);
    const backup: BackupDados = {
      versao: 1,
      geradoEm: agora(),
      clientes,
      produtos,
      pedidos,
      representante,
      ultimaImportacao,
    };
    return backup;
  },

  async restaurarBackup(dados: BackupDados) {
    await db.transaction("rw", db.clientes, db.produtos, db.pedidos, db.meta, async () => {
      await db.clientes.clear();
      await db.clientes.bulkPut(dados.clientes);
      await db.produtos.clear();
      await db.produtos.bulkPut(dados.produtos);
      await db.pedidos.clear();
      await db.pedidos.bulkPut(dados.pedidos);
      if (dados.representante) {
        await db.meta.put({ chave: CHAVE_REPRESENTANTE, valor: dados.representante });
      }
      if (dados.ultimaImportacao) {
        await db.meta.put({ chave: CHAVE_IMPORTACAO, valor: dados.ultimaImportacao });
      }
    });
  },
};
