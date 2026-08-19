import { useMemo, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { Select } from "../../components/ui/Field";
import { formatarMoeda } from "../../domain/calculos";
import {
  categoriasMaisVendidas,
  clientesMaisVendidos,
  filtrarPedidos,
  granularidadePara,
  intervaloPeriodo,
  produtosMaisVendidos,
  resumoVendas,
  serieTemporalItens,
  serieTemporalPedidos,
  SEM_CATEGORIA,
  type Periodo,
} from "../../domain/relatorios";
import { GraficoRosca } from "./GraficoRosca";
import { GraficoLinha } from "./GraficoLinha";
import css from "./relatorios.module.css";

const PERIODOS = ["semana", "mes", "tudo"] as const satisfies readonly Periodo[];
const ROTULOS_PERIODO: Record<Periodo, string> = {
  semana: "Semana",
  mes: "Mês",
  tudo: "Tudo",
};
const TODAS_MARCAS = "Todas";
const TODOS_CLIENTES = "";

const VISOES = ["produto", "cliente"] as const;
type Visao = (typeof VISOES)[number];
const ROTULOS_VISAO: Record<Visao, string> = {
  produto: "Por produto",
  cliente: "Por cliente",
};

export function RelatoriosPage() {
  const repo = useRepository();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [marcaFiltro, setMarcaFiltro] = useState(TODAS_MARCAS);
  const [clienteFiltro, setClienteFiltro] = useState(TODOS_CLIENTES);
  const [visao, setVisao] = useState<Visao>("produto");

  // Drill-down: no modo produto, categoria → produto (dois níveis); no modo
  // cliente, só cliente (já é o nível-folha). Persistem entre trocas de
  // período/marca/cliente-filtro — só reseta ao trocar de visão.
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [clienteDetalhe, setClienteDetalhe] = useState<{ id: string; nome: string } | null>(null);

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    setCategoriaSelecionada(null);
    setProdutoSelecionado(null);
    setClienteDetalhe(null);
  }

  const { dados: contexto } = useDados(async () => {
    const [enviadosBrutos, clientes, produtos] = await Promise.all([
      repo.listarPedidos({ status: "enviado" }),
      repo.listarClientes(),
      // Catálogo inteiro (não só os primeiros 50) — precisa de todo mundo pro
      // mapa nome→categoria usado no agrupamento por categoria. Limite bem
      // acima de qualquer base real, mas dentro do que o IndexedDB aceita em
      // cursor (Number.MAX_SAFE_INTEGER estoura o unsigned de 32 bits e o
      // Dexie rejeita a consulta inteira).
      repo.listarProdutos(undefined, 1_000_000),
    ]);
    // Pedidos gerados em Configurações → "Criar pedidos de teste" e orçamentos
    // (ainda sem número de pedido de verdade) não são vendas reais — nunca
    // entram nos números de Relatórios.
    const enviados = enviadosBrutos.filter((p) => !p.teste && !p.somenteOrcamento);
    const nomePorClienteId = new Map(clientes.map((c) => [c.id, c.nome]));
    const categoriaPorNome = new Map(produtos.map((p) => [p.nome, p.categoria]));
    const marcas = [...new Set(enviados.map((p) => p.marca).filter(Boolean))];
    const clientesComPedido = [...new Set(enviados.map((p) => p.clienteId))]
      .map((id) => ({ id, nome: nomePorClienteId.get(id) ?? "Cliente removido" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { enviados, marcas, clientesComPedido, nomePorClienteId, categoriaPorNome };
  }, [repo]);

  const { inicio, fim } = intervaloPeriodo(periodo);

  const filtrados = useMemo(() => {
    if (!contexto) return [];
    return filtrarPedidos(contexto.enviados, {
      inicio,
      fim,
      marca: marcaFiltro === TODAS_MARCAS ? undefined : marcaFiltro,
      clienteId: clienteFiltro || undefined,
    });
  }, [contexto, inicio, fim, marcaFiltro, clienteFiltro]);

  const resumo = resumoVendas(filtrados);
  const granularidade = granularidadePara(periodo);

  // Visão "por produto": nível 1 = categorias; nível 2 (categoria escolhida) = produtos dela.
  const produtosCompletos = useMemo(() => produtosMaisVendidos(filtrados, Infinity), [filtrados]);
  const categorias = useMemo(
    () => categoriasMaisVendidas(produtosCompletos, contexto?.categoriaPorNome ?? new Map()),
    [produtosCompletos, contexto],
  );
  const produtosDaCategoria = useMemo(() => {
    if (!categoriaSelecionada) return [];
    const categoriaPorNome = contexto?.categoriaPorNome ?? new Map();
    return produtosCompletos.filter(
      (p) => (categoriaPorNome.get(p.nome) || SEM_CATEGORIA) === categoriaSelecionada,
    );
  }, [produtosCompletos, contexto, categoriaSelecionada]);

  // Visão "por cliente": nível único.
  const clientesRanking = useMemo(
    () => (contexto ? clientesMaisVendidos(filtrados, contexto.nomePorClienteId, Infinity) : []),
    [filtrados, contexto],
  );

  const emCategoria = visao === "produto" && categoriaSelecionada !== null;
  const fatiasRosca =
    visao === "cliente"
      ? clientesRanking.map((c) => ({ rotulo: c.nome, valor: c.valorTotal }))
      : emCategoria
        ? produtosDaCategoria.map((p) => ({ rotulo: p.nome, valor: p.valorTotal }))
        : categorias.map((c) => ({ rotulo: c.categoria, valor: c.valorTotal }));

  const rotuloCentroRosca =
    visao === "cliente" ? "Clientes" : (categoriaSelecionada ?? "Categorias");
  const itemSelecionado =
    visao === "cliente" ? clienteDetalhe?.nome : (produtoSelecionado ?? categoriaSelecionada);

  function selecionarItem(rotulo: string) {
    if (visao === "cliente") {
      const cliente = clientesRanking.find((c) => c.nome === rotulo);
      if (cliente) setClienteDetalhe({ id: cliente.clienteId, nome: cliente.nome });
      return;
    }
    if (categoriaSelecionada) {
      setProdutoSelecionado(rotulo);
    } else {
      setCategoriaSelecionada(rotulo);
      setProdutoSelecionado(null);
    }
  }

  const serieTempo = useMemo(() => {
    if (visao === "cliente" && clienteDetalhe) {
      const pedidosDoCliente = filtrarPedidos(filtrados, { clienteId: clienteDetalhe.id });
      return serieTemporalPedidos(pedidosDoCliente, granularidade);
    }
    if (visao === "produto" && categoriaSelecionada) {
      const nomes = new Set(
        produtoSelecionado ? [produtoSelecionado] : produtosDaCategoria.map((p) => p.nome),
      );
      return serieTemporalItens(filtrados, nomes, granularidade);
    }
    return null;
  }, [visao, clienteDetalhe, categoriaSelecionada, produtoSelecionado, produtosDaCategoria, filtrados, granularidade]);

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  return (
    <Tela titulo="Relatórios" voltar="/">
      <Chips
        opcoes={PERIODOS}
        valor={periodo}
        onChange={setPeriodo}
        rotulos={ROTULOS_PERIODO}
      />

      {opcoesMarca.length > 1 && (
        <Chips opcoes={opcoesMarca} valor={marcaFiltro} onChange={setMarcaFiltro} />
      )}

      {contexto && contexto.clientesComPedido.length > 1 && (
        <Select
          rotulo="Cliente"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        >
          <option value={TODOS_CLIENTES}>Todos os clientes</option>
          {contexto.clientesComPedido.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      )}

      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido enviado neste filtro" />
      ) : (
        <>
          <Cartao>
            <div className={css.stats}>
              <div className={css.statItem}>
                <span className={css.statValor}>{formatarMoeda(resumo.totalVendido)}</span>
                <span className="texto-suave">Total vendido</span>
              </div>
              <div className={css.statItem}>
                <span className={css.statValor}>{resumo.numeroPedidos}</span>
                <span className="texto-suave">Pedidos</span>
              </div>
              <div className={css.statItem}>
                <span className={css.statValor}>{formatarMoeda(resumo.ticketMedio)}</span>
                <span className="texto-suave">Ticket médio</span>
              </div>
            </div>
          </Cartao>

          <div className={css.visaoToggle}>
            <Chips opcoes={VISOES} valor={visao} onChange={trocarVisao} rotulos={ROTULOS_VISAO} />
          </div>

          {(categoriaSelecionada || clienteDetalhe) && (
            <div className="linha" style={{ gap: 8, flexWrap: "wrap" }}>
              {visao === "produto" && categoriaSelecionada && (
                <button
                  type="button"
                  className={css.selecaoChip}
                  onClick={() => {
                    setCategoriaSelecionada(null);
                    setProdutoSelecionado(null);
                  }}
                >
                  Categoria: {categoriaSelecionada} ✕
                </button>
              )}
              {visao === "produto" && produtoSelecionado && (
                <button
                  type="button"
                  className={css.selecaoChip}
                  onClick={() => setProdutoSelecionado(null)}
                >
                  Produto: {produtoSelecionado} ✕
                </button>
              )}
              {visao === "cliente" && clienteDetalhe && (
                <button
                  type="button"
                  className={css.selecaoChip}
                  onClick={() => setClienteDetalhe(null)}
                >
                  Cliente: {clienteDetalhe.nome} ✕
                </button>
              )}
            </div>
          )}

          <h2 className="secao-titulo">Visão geral</h2>
          <Cartao>
            <GraficoRosca
              fatias={fatiasRosca}
              rotuloCentro={rotuloCentroRosca}
              selecionado={itemSelecionado ?? null}
              onSelecionar={selecionarItem}
            />
          </Cartao>

          {serieTempo && (
            <>
              <h2 className="secao-titulo">Evolução no período</h2>
              <Cartao>
                <GraficoLinha pontos={serieTempo} />
              </Cartao>
            </>
          )}
        </>
      )}
    </Tela>
  );
}
