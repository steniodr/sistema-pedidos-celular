import { useMemo, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { Button } from "../../components/ui/Button";
import { Painel } from "../../components/ui/Painel";
import {
  IconeCalendario,
  IconeFechar,
  IconeFiltros,
  IconeOk,
  IconeRelatorios,
  IconeSeta,
  IconeVoltar,
} from "../../components/ui/icones";
import ui from "../../components/ui/ui.module.css";
import capaCss from "../../components/ui/redesenho.module.css";
import { Select } from "../../components/ui/Field";
import { formatarMoeda } from "../../domain/calculos";
import { normalizar } from "../../domain/texto";
import {
  categoriasMaisVendidas,
  chavePeriodo,
  clientesMaisVendidos,
  filtrarPedidos,
  granularidadeParaSelecao,
  intervaloDaChave,
  marcasMaisVendidas,
  periodosDisponiveis,
  produtosMaisVendidos,
  resumoVendas,
  rotuloPeriodo,
  serieTemporalItens,
  serieTemporalPedidos,
  SEM_CATEGORIA,
  type IntervaloData,
  type Periodo,
  type TipoPeriodo,
} from "../../domain/relatorios";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
// ⚠️ TEMPORÁRIO — junto com o Ambiente de teste.
import { gerarRelatorioTeste } from "./relatoriosTeste";
import { GraficoRosca } from "./GraficoRosca";
import { GraficoLinha } from "./GraficoLinha";
import css from "./relatorios.module.css";

const PERIODOS = ["semana", "mes", "tudo"] as const satisfies readonly Periodo[];
const ROTULOS_PERIODO: Record<Periodo, string> = {
  semana: "Semana",
  mes: "Mês",
  tudo: "Tudo",
};
const TODOS_CLIENTES = "";

const VISOES = ["produto", "cliente", "marca"] as const;
type Visao = (typeof VISOES)[number];
const ROTULOS_VISAO: Record<Visao, string> = {
  produto: "Por produto",
  cliente: "Por cliente",
  marca: "Por marca",
};

// Três recortes que nunca se misturam:
//  • "real"   — só vendas fechadas (nem teste, nem orçamento, nem marca oculta);
//  • "orcado" — só orçamentos ("somente orçamento"), que são cotação, não venda;
//  • "teste"  — ⚠️ TEMPORÁRIO, só o Ambiente de teste (dados fictícios).
// "Orçados" e "Teste" ficam fora dos números reais até em "Tudo".
const MODOS = ["real", "orcado", "teste"] as const;
type Modo = (typeof MODOS)[number];
const ROTULOS_MODO: Record<Modo, string> = { real: "Reais", orcado: "Orçados", teste: "Teste" };

interface RelatoriosPageProps {
  /** Modo inicial; "teste" ao abrir por `/relatorios/teste`. Também alternável na tela. */
  modo?: Modo;
}

export function RelatoriosPage({ modo: modoInicial = "real" }: RelatoriosPageProps) {
  const repo = useRepository();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [tipo, setTipo] = useState<Periodo>(modoInicial === "teste" ? "tudo" : "mes");
  const [periodosSelecionados, setPeriodosSelecionados] = useState<string[]>(() => [
    chavePeriodo("mes"),
  ]);
  const [marcasSelecionadas, setMarcasSelecionadas] = useState<string[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState(TODOS_CLIENTES);
  const [visao, setVisao] = useState<Visao>("produto");
  const [semeando, setSemeando] = useState(false);

  // Drill-down: produto → categoria → produto; cliente e marca são nível-folha.
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [clienteDetalhe, setClienteDetalhe] = useState<{ id: string; nome: string } | null>(null);
  const [marcaDetalhe, setMarcaDetalhe] = useState<string | null>(null);

  function resetDrill() {
    setCategoriaSelecionada(null);
    setProdutoSelecionado(null);
    setClienteDetalhe(null);
    setMarcaDetalhe(null);
  }

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    resetDrill();
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    resetDrill();
    setMarcasSelecionadas([]);
    setGrupoSelecionado("");
    setClienteFiltro(TODOS_CLIENTES);
    // "tudo" no teste para os dados fictícios aparecerem sem precisar navegar período.
    const t: Periodo = novo === "teste" ? "tudo" : "mes";
    setTipo(t);
    setPeriodosSelecionados([chavePeriodo("mes")]);
  }

  function trocarTipo(novo: Periodo) {
    setTipo(novo);
    resetDrill();
    if (novo !== "tudo") setPeriodosSelecionados([chavePeriodo(novo)]);
  }

  const toast = useToast();

  /**
   * ⚠️ TEMPORÁRIO — o conjunto fictício só existia atrás de um botão em
   * Configurações > Ambiente de teste, então quem abria "Teste" direto via uma
   * tela vazia sem pista do que fazer. Aqui a própria tela semeia.
   */
  async function semearDadosDeTeste() {
    setSemeando(true);
    try {
      const criados = await gerarRelatorioTeste(repo);
      toast.sucesso(`${criados} pedido(s) fictícios criados em 3 marcas.`);
      recarregarContexto();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível criar os dados de teste."));
    } finally {
      setSemeando(false);
    }
  }

  const { dados: contexto, recarregar: recarregarContexto } = useDados(async () => {
    const [enviadosBrutos, clientes, produtos, marcas, grupos] = await Promise.all([
      repo.listarPedidos({ status: "enviado" }),
      repo.listarClientes(),
      // Catálogo inteiro para o mapa nome→categoria (limite bem acima de qualquer base real).
      repo.listarProdutos(undefined, 1_000_000),
      repo.listarMarcas({ incluirTeste: true }),
      repo.listarGruposMarca(),
    ]);
    const marcaPorNome = new Map(marcas.map((m) => [normalizar(m.nome), m]));
    const temDadosTeste = enviadosBrutos.some((p) => p.teste === true);
    const temOrcamentos = enviadosBrutos.some((p) => p.somenteOrcamento === true && !p.teste);
    // Cada modo é um recorte fechado. "real" tira teste, orçamento e marca
    // oculta/de teste; "orcado" mostra só orçamento (fora do teste); "teste"
    // mostra só o Ambiente de teste.
    const enviados = enviadosBrutos.filter((p) => {
      if (modo === "teste") return p.teste === true;
      if (p.teste) return false;
      if (modo === "orcado") return p.somenteOrcamento === true;
      if (p.somenteOrcamento) return false;
      const m = marcaPorNome.get(normalizar(p.marca));
      if (m && (m.teste || !m.visivelEmRelatorios)) return false;
      return true;
    });
    const nomePorClienteId = new Map(clientes.map((c) => [c.id, c.nome]));
    const categoriaPorNome = new Map(produtos.map((p) => [p.nome, p.categoria]));
    const nomePorMarcaId = new Map(marcas.map((m) => [m.id, m.nome]));
    const marcasPresentes = [...new Set(enviados.map((p) => p.marca).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    const gruposComNomes = grupos
      .map((g) => ({
        id: g.id,
        nome: g.nome,
        marcas: g.marcaIds
          .map((id) => nomePorMarcaId.get(id))
          .filter((n): n is string => !!n && marcasPresentes.includes(n)),
      }))
      .filter((g) => g.marcas.length > 0);
    const clientesComPedido = [...new Set(enviados.map((p) => p.clienteId))]
      .map((id) => ({ id, nome: nomePorClienteId.get(id) ?? "Cliente removido" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return {
      enviados,
      temDadosTeste,
      temOrcamentos,
      marcasPresentes,
      grupos: gruposComNomes,
      clientesComPedido,
      nomePorClienteId,
      categoriaPorNome,
    };
  }, [repo, modo]);

  const opcoesPeriodo = useMemo(() => {
    if (tipo === "tudo" || !contexto) return [];
    return periodosDisponiveis(contexto.enviados, tipo as TipoPeriodo);
  }, [contexto, tipo]);

  const intervalos: IntervaloData[] = useMemo(() => {
    if (tipo === "tudo") return [{ inicio: null, fim: null }];
    return periodosSelecionados.map((c) => intervaloDaChave(tipo as TipoPeriodo, c));
  }, [tipo, periodosSelecionados]);

  const marcasAtivas = marcasSelecionadas.length > 0 ? marcasSelecionadas : undefined;

  const filtrados = useMemo(() => {
    if (!contexto) return [];
    return filtrarPedidos(contexto.enviados, {
      intervalos,
      marcasIn: marcasAtivas,
      clienteId: clienteFiltro || undefined,
    });
  }, [contexto, intervalos, marcasAtivas, clienteFiltro]);

  const resumo = resumoVendas(filtrados);
  const granularidade = granularidadeParaSelecao(tipo, periodosSelecionados.length);

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

  const clientesRanking = useMemo(
    () => (contexto ? clientesMaisVendidos(filtrados, contexto.nomePorClienteId, Infinity) : []),
    [filtrados, contexto],
  );
  const marcasRanking = useMemo(() => marcasMaisVendidas(filtrados, Infinity), [filtrados]);

  const emCategoria = visao === "produto" && categoriaSelecionada !== null;
  const fatiasRosca =
    visao === "cliente"
      ? clientesRanking.map((c) => ({ rotulo: c.nome, valor: c.valorTotal }))
      : visao === "marca"
        ? marcasRanking.map((m) => ({ rotulo: m.marca, valor: m.valorTotal }))
        : emCategoria
          ? produtosDaCategoria.map((p) => ({ rotulo: p.nome, valor: p.valorTotal }))
          : categorias.map((c) => ({ rotulo: c.categoria, valor: c.valorTotal }));

  const rotuloCentroRosca =
    visao === "cliente"
      ? "Clientes"
      : visao === "marca"
        ? "Marcas"
        : (categoriaSelecionada ?? "Categorias");
  const itemSelecionado =
    visao === "cliente"
      ? clienteDetalhe?.nome
      : visao === "marca"
        ? marcaDetalhe
        : (produtoSelecionado ?? categoriaSelecionada);

  function selecionarItem(rotulo: string) {
    if (visao === "cliente") {
      const cliente = clientesRanking.find((c) => c.nome === rotulo);
      if (cliente) setClienteDetalhe({ id: cliente.clienteId, nome: cliente.nome });
      return;
    }
    if (visao === "marca") {
      setMarcaDetalhe((atual) => (atual === rotulo ? null : rotulo));
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
    if (visao === "marca" && marcaDetalhe) {
      const pedidosDaMarca = filtrarPedidos(filtrados, { marca: marcaDetalhe });
      return serieTemporalPedidos(pedidosDaMarca, granularidade);
    }
    if (visao === "produto" && categoriaSelecionada) {
      const nomes = new Set(
        produtoSelecionado ? [produtoSelecionado] : produtosDaCategoria.map((p) => p.nome),
      );
      return serieTemporalItens(filtrados, nomes, granularidade);
    }
    return null;
  }, [
    visao,
    clienteDetalhe,
    marcaDetalhe,
    categoriaSelecionada,
    produtoSelecionado,
    produtosDaCategoria,
    filtrados,
    granularidade,
  ]);

  // ── Navegação de período ──
  // Índices (em opcoesPeriodo, que vai do mais recente ao mais antigo) dos
  // períodos escolhidos. `delta > 0` = mais antigo; `delta < 0` = mais recente.
  const idxSelecionados = periodosSelecionados
    .map((c) => opcoesPeriodo.findIndex((o) => o.chave === c))
    .filter((i) => i >= 0);

  function podeMover(delta: number): boolean {
    if (idxSelecionados.length === 0) return false;
    return idxSelecionados.every((i) => i + delta >= 0 && i + delta < opcoesPeriodo.length);
  }

  /** Desliza TODOS os períodos escolhidos um passo — janela móvel na comparação. */
  function moverJanela(delta: number) {
    if (!podeMover(delta)) return;
    setPeriodosSelecionados(idxSelecionados.map((i) => opcoesPeriodo[i + delta].chave));
    resetDrill();
  }

  function escolherPeriodoUnico(chave: string) {
    setPeriodosSelecionados([chave]);
    resetDrill();
  }

  function removerPeriodo(chave: string) {
    setPeriodosSelecionados((atual) =>
      atual.length > 1 ? atual.filter((c) => c !== chave) : atual,
    );
    resetDrill();
  }

  const idxMaisAntigo = idxSelecionados.length ? Math.max(...idxSelecionados) : -1;
  const podeComparar = idxMaisAntigo >= 0 && idxMaisAntigo + 1 < opcoesPeriodo.length;

  /** Estende a janela um período mais para trás (comparação contígua). */
  function compararAnterior() {
    const prox = opcoesPeriodo[idxMaisAntigo + 1];
    if (prox) {
      setPeriodosSelecionados((atual) => [...atual, prox.chave]);
      resetDrill();
    }
  }

  function voltarPeriodoUnico() {
    if (!idxSelecionados.length) return;
    setPeriodosSelecionados([opcoesPeriodo[Math.min(...idxSelecionados)].chave]);
    resetDrill();
  }

  const rotuloJanela =
    tipo === "tudo"
      ? ""
      : `${periodosSelecionados.length} ${tipo === "mes" ? "meses" : "semanas"}`;

  // ── Filtro de marcas ──
  function alternarMarca(nome: string) {
    setGrupoSelecionado("");
    setMarcasSelecionadas((atual) =>
      atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome],
    );
    resetDrill();
  }

  function escolherGrupo(id: string) {
    setGrupoSelecionado(id);
    const grupo = contexto?.grupos.find((g) => g.id === id);
    setMarcasSelecionadas(grupo ? [...grupo.marcas] : []);
    resetDrill();
  }

  const mostrarFiltroMarcas =
    !!contexto && (contexto.marcasPresentes.length > 1 || contexto.grupos.length > 0);

  // O seletor de recorte só mostra os modos que fazem sentido: "Reais" sempre,
  // "Orçados" quando há orçamento na base, "Teste" quando há Ambiente de teste
  // (⚠️ TEMPORÁRIO). O modo aberto entra na lista mesmo sem dados, pra não sumir
  // debaixo do usuário.
  const modosDisponiveis = MODOS.filter(
    (m) =>
      m === "real" ||
      m === modo ||
      (m === "orcado" && contexto?.temOrcamentos) ||
      (m === "teste" && contexto?.temDadosTeste),
  );
  const mostrarModo = modosDisponiveis.length > 1;

  /**
   * O que está filtrado, como etiquetas removíveis. Antes o estado do filtro só
   * dava pra deduzir olhando seis controles diferentes.
   */
  const chipsFiltro: { chave: string; rotulo: string; limpar: () => void }[] = [];
  if (marcasSelecionadas.length > 0) {
    const grupo = contexto?.grupos.find((g) => g.id === grupoSelecionado);
    chipsFiltro.push({
      chave: "marcas",
      rotulo: grupo
        ? `Grupo: ${grupo.nome}`
        : marcasSelecionadas.length === 1
          ? marcasSelecionadas[0]
          : `${marcasSelecionadas.length} marcas`,
      limpar: () => {
        setMarcasSelecionadas([]);
        setGrupoSelecionado("");
        resetDrill();
      },
    });
  }
  if (clienteFiltro !== TODOS_CLIENTES) {
    chipsFiltro.push({
      chave: "cliente",
      rotulo: contexto?.clientesComPedido.find((c) => c.id === clienteFiltro)?.nome ?? "Cliente",
      limpar: () => {
        setClienteFiltro(TODOS_CLIENTES);
        resetDrill();
      },
    });
  }
  if (visao === "produto" && categoriaSelecionada) {
    chipsFiltro.push({
      chave: "categoria",
      rotulo: `Categoria: ${categoriaSelecionada}`,
      limpar: () => {
        setCategoriaSelecionada(null);
        setProdutoSelecionado(null);
      },
    });
  }
  if (visao === "produto" && produtoSelecionado) {
    chipsFiltro.push({
      chave: "produto",
      rotulo: `Produto: ${produtoSelecionado}`,
      limpar: () => setProdutoSelecionado(null),
    });
  }
  if (visao === "cliente" && clienteDetalhe) {
    chipsFiltro.push({
      chave: "clienteDetalhe",
      rotulo: `Cliente: ${clienteDetalhe.nome}`,
      limpar: () => setClienteDetalhe(null),
    });
  }
  if (visao === "marca" && marcaDetalhe) {
    chipsFiltro.push({
      chave: "marcaDetalhe",
      rotulo: `Marca: ${marcaDetalhe}`,
      limpar: () => setMarcaDetalhe(null),
    });
  }

  function limparFiltros() {
    setMarcasSelecionadas([]);
    setGrupoSelecionado("");
    setClienteFiltro(TODOS_CLIENTES);
    resetDrill();
  }

  /** Subtítulo da capa: o período que está sendo somado, em português. */
  const rotuloPeriodoAtual =
    tipo === "tudo"
      ? "Todo o histórico"
      : periodosSelecionados.length === 1
        ? rotuloPeriodo(tipo as TipoPeriodo, periodosSelecionados[0])
        : rotuloJanela;

  return (
    <Tela
      titulo={
        modo === "teste"
          ? "Relatório de teste"
          : modo === "orcado"
            ? "Relatório de orçamentos"
            : "Relatórios"
      }
      subtitulo={rotuloPeriodoAtual}
      voltar="/"
      capa
      // Os números sobem para a capa: antes vinham depois de até seis blocos de
      // controle, então a tela abria sem responder "quanto eu vendi?".
      abaixoDoTitulo={
        filtrados.length > 0 ? (
          <div className={capaCss.capaResumo}>
            <div className={capaCss.capaResumoItem}>
              <div className={capaCss.capaResumoValor}>{formatarMoeda(resumo.totalVendido)}</div>
              <div className={capaCss.capaResumoRotulo}>Total vendido</div>
            </div>
            <div className={capaCss.capaResumoItem}>
              <div className={capaCss.capaResumoValor}>{resumo.numeroPedidos}</div>
              <div className={capaCss.capaResumoRotulo}>Pedidos</div>
            </div>
            <div className={capaCss.capaResumoItem}>
              <div className={capaCss.capaResumoValor}>{formatarMoeda(resumo.ticketMedio)}</div>
              <div className={capaCss.capaResumoRotulo}>Ticket médio</div>
            </div>
          </div>
        ) : undefined
      }
    >
      {mostrarModo && (
        <Chips
          opcoes={modosDisponiveis}
          valor={modo}
          onChange={trocarModo}
          rotulos={ROTULOS_MODO}
        />
      )}
      {modo === "teste" && (
        <p className={css.aviso}>Dados fictícios do Ambiente de teste — fora dos números reais.</p>
      )}
      {modo === "orcado" && (
        <p className={css.aviso}>
          Só orçamentos — cotações em aberto, fora dos totais de vendas reais.
        </p>
      )}

      {chipsFiltro.length > 0 && (
        <div className={css.filtrosAtivos}>
          {chipsFiltro.map((c) => (
            <button key={c.chave} type="button" className={css.chipToken} onClick={c.limpar}>
              {c.rotulo}
              <IconeFechar size={13} />
            </button>
          ))}
          <button type="button" className={css.linkLimpar} onClick={limparFiltros}>
            Limpar
          </button>
        </div>
      )}

      {/* Um cartão de filtros no lugar de seis blocos soltos entre o título e o
          primeiro número. */}
      <Painel titulo="Período" icone={<IconeCalendario size={17} />}>
        <Chips opcoes={PERIODOS} valor={tipo} onChange={trocarTipo} rotulos={ROTULOS_PERIODO} />

        {tipo !== "tudo" && (
          <>
            <div className={css.navPeriodo}>
              <button
                type="button"
                className={css.navSeta}
                aria-label={tipo === "mes" ? "Mês anterior" : "Semana anterior"}
                onClick={() => moverJanela(1)}
                disabled={!podeMover(1)}
              >
                <IconeVoltar size={18} />
              </button>
              {periodosSelecionados.length === 1 ? (
                <select
                  className={css.navSelect}
                  aria-label="Escolher período"
                  value={periodosSelecionados[0]}
                  onChange={(e) => escolherPeriodoUnico(e.target.value)}
                >
                  {opcoesPeriodo.map((o) => (
                    <option key={o.chave} value={o.chave}>
                      {o.rotulo}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={css.navAtual}>{rotuloJanela}</span>
              )}
              <button
                type="button"
                className={css.navSeta}
                aria-label={tipo === "mes" ? "Próximo mês" : "Próxima semana"}
                onClick={() => moverJanela(-1)}
                disabled={!podeMover(-1)}
              >
                <IconeSeta size={18} />
              </button>
            </div>

            {periodosSelecionados.length > 1 && (
              <div className={css.filtrosAtivos}>
                {[...periodosSelecionados]
                  .sort((a, b) => (a < b ? 1 : -1))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={css.chipToken}
                      onClick={() => removerPeriodo(c)}
                    >
                      {rotuloPeriodo(tipo as TipoPeriodo, c)}
                      <IconeFechar size={13} />
                    </button>
                  ))}
              </div>
            )}

            {(podeComparar || periodosSelecionados.length > 1) && (
              <div className={css.periodoAcoes}>
                {podeComparar && (
                  <button type="button" className={css.periodoLink} onClick={compararAnterior}>
                    + Comparar com {tipo === "mes" ? "mês" : "semana"} anterior
                  </button>
                )}
                {periodosSelecionados.length > 1 && (
                  <button type="button" className={css.periodoLink} onClick={voltarPeriodoUnico}>
                    Ver um {tipo === "mes" ? "mês" : "período"} só
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Painel>

      {(mostrarFiltroMarcas || (contexto && contexto.clientesComPedido.length > 1)) && (
        <Painel titulo="Filtros" icone={<IconeFiltros size={17} />}>
          {mostrarFiltroMarcas && contexto.grupos.length > 0 && (
            <Select
              rotulo="Grupo de marcas"
              value={grupoSelecionado}
              onChange={(e) => escolherGrupo(e.target.value)}
            >
              <option value="">Sem grupo</option>
              {contexto.grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Select>
          )}

          {mostrarFiltroMarcas && (
            <>
              {/* Mesmo chip "multi" do resto do app (contorno + visto) — antes
                  esta tela tinha um terceiro estilo próprio de chip. */}
              <div className={ui.chips}>
                {contexto.marcasPresentes.map((nome) => {
                  const ativo = marcasSelecionadas.includes(nome);
                  return (
                    <button
                      key={nome}
                      type="button"
                      className={[ui.chip, ui["chip--multi"], ativo ? ui["chip--ativo"] : ""]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={ativo}
                      onClick={() => alternarMarca(nome)}
                    >
                      {ativo && <IconeOk size={13} />}
                      {nome}
                    </button>
                  );
                })}
              </div>
              {marcasSelecionadas.length === 0 && (
                <p className={css.dica}>Sem seleção = todas as marcas.</p>
              )}
            </>
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
        </Painel>
      )}

      {filtrados.length === 0 && modo === "teste" && !contexto?.temDadosTeste ? (
        // Sem nenhum pedido fictício na base, o problema não é o filtro: é que o
        // conjunto de teste ainda não foi criado neste aparelho.
        <EstadoVazio
          titulo="Nenhum dado fictício ainda"
          descricao="O Relatório de teste usa um conjunto próprio: 3 marcas (“Teste 1/2/3”), várias semanas e meses. Nada disso encosta nos seus números reais."
          acao={
            <Button onClick={semearDadosDeTeste} disabled={semeando}>
              {semeando ? "Criando…" : "Criar dados de teste"}
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <EstadoVazio
          titulo={
            modo === "orcado"
              ? "Nenhum orçamento neste filtro"
              : "Nenhum pedido enviado neste filtro"
          }
          descricao={
            chipsFiltro.length > 0
              ? "Tente limpar os filtros ou escolher outro período."
              : modo === "orcado"
                ? "Orçamentos aparecem aqui assim que você exportar o primeiro."
                : "Pedidos enviados aparecem aqui assim que você exportar o primeiro."
          }
          acao={
            chipsFiltro.length > 0 ? (
              <Button variante="secundario" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Painel titulo="Visão geral" icone={<IconeRelatorios size={17} />}>
            <div className={css.visaoToggle}>
              <Chips opcoes={VISOES} valor={visao} onChange={trocarVisao} rotulos={ROTULOS_VISAO} />
            </div>
            <GraficoRosca
              fatias={fatiasRosca}
              rotuloCentro={rotuloCentroRosca}
              selecionado={itemSelecionado ?? null}
              onSelecionar={selecionarItem}
            />
          </Painel>

          {serieTempo && (
            <Painel titulo="Evolução no período" icone={<IconeCalendario size={17} />}>
              <GraficoLinha pontos={serieTempo} />
            </Painel>
          )}
        </>
      )}
    </Tela>
  );
}
