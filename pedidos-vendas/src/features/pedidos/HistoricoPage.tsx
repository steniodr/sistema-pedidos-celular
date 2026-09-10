import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { CalendarioMes } from "../../components/ui/CalendarioMes";
import { Select } from "../../components/ui/Field";
import { BotaoCapa, Chips, EstadoVazio, Sheet, Tela } from "../../components/ui/Layout";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { Etiqueta } from "../../components/ui/Etiqueta";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { IconeBuscar, IconeFechar, IconeFiltros, IconeMaisAcoes } from "../../components/ui/icones";
import capaCss from "../../components/ui/redesenho.module.css";
import { StatusPedido as StatusPedidoTag } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { formatarData } from "../produtos/statusBase";
import {
  dataLocalDoISO,
  intervaloFiltroPeriodo,
  rotuloFiltroPeriodo,
  type FiltroPeriodo,
  type TipoPeriodo,
} from "./filtroPeriodoHistorico";
import type { StatusPedido } from "../../domain/types";
import css from "./pedidos.module.css";

const FILTROS = ["Todos", "Rascunhos", "Enviados"] as const;
type Filtro = (typeof FILTROS)[number];
const TODAS_MARCAS = "Todas";
const TODOS_CLIENTES = "";

const ORDENS = ["Recentes", "Maior valor"] as const;
type Ordem = (typeof ORDENS)[number];

const TIPOS_PERIODO = ["dia", "semana", "mes"] as const satisfies readonly TipoPeriodo[];
const ROTULOS_TIPO_PERIODO: Record<TipoPeriodo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

const STATUS_POR_FILTRO: Record<Filtro, StatusPedido | undefined> = {
  Todos: undefined,
  Rascunhos: "rascunho",
  Enviados: "enviado",
};

export function HistoricoPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [marcaFiltro, setMarcaFiltro] = useState(TODAS_MARCAS);
  const [clienteFiltro, setClienteFiltro] = useState(TODOS_CLIENTES);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo | null>(null);
  const [sheetFiltrosAberto, setSheetFiltrosAberto] = useState(false);
  const [sheetPeriodoAberto, setSheetPeriodoAberto] = useState(false);
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("dia");
  const [mesCalendario, setMesCalendario] = useState(() => new Date());
  const [ordem, setOrdem] = useState<Ordem>("Recentes");
  const [busca, setBusca] = useState("");
  const [menuPedidoId, setMenuPedidoId] = useState<string | null>(null);
  const buscaDebounced = useDebounce(busca);

  const { dados: contexto } = useDados(async () => {
    const [todosPedidos, clientes] = await Promise.all([
      repo.listarPedidos(),
      repo.listarClientes(),
    ]);
    const clientesPorId = new Map(clientes.map((c) => [c.id, c]));
    const marcas = [...new Set(todosPedidos.map((p) => p.marca).filter(Boolean))];
    const clientesComPedido = [...new Set(todosPedidos.map((p) => p.clienteId))]
      .map((id) => ({ id, nome: clientesPorId.get(id)?.nome ?? "Cliente removido" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { marcas, clientesPorId, clientesComPedido };
  }, [repo]);

  const { dados: pedidosBrutos, recarregar } = useDados(
    () =>
      repo.listarPedidos({
        status: STATUS_POR_FILTRO[filtro],
        marca: marcaFiltro === TODAS_MARCAS ? undefined : marcaFiltro,
        clienteId: clienteFiltro || undefined,
        busca: buscaDebounced,
      }),
    [repo, filtro, marcaFiltro, clienteFiltro, buscaDebounced],
  );

  const diasComDados = useMemo(
    () => new Set((pedidosBrutos ?? []).map((p) => p.dataPedido)),
    [pedidosBrutos],
  );

  const pedidos = useMemo(() => {
    if (!pedidosBrutos) return pedidosBrutos;
    let filtrados = pedidosBrutos;
    if (filtroPeriodo) {
      const { inicio, fim } = intervaloFiltroPeriodo(filtroPeriodo);
      filtrados = filtrados.filter((p) => p.dataPedido >= inicio && p.dataPedido <= fim);
    }
    if (ordem === "Recentes") return filtrados;
    return [...filtrados].sort((a, b) => totaisPedido(b).total - totaisPedido(a).total);
  }, [pedidosBrutos, filtroPeriodo, ordem]);

  function abrirSheetPeriodo() {
    if (filtroPeriodo) {
      setTipoPeriodo(filtroPeriodo.tipo);
      setMesCalendario(dataLocalDoISO(filtroPeriodo.referencia));
    }
    setSheetFiltrosAberto(false);
    setSheetPeriodoAberto(true);
  }

  function limparFiltros() {
    setFiltro("Todos");
    setMarcaFiltro(TODAS_MARCAS);
    setClienteFiltro(TODOS_CLIENTES);
    setFiltroPeriodo(null);
  }

  async function duplicar(id: string) {
    try {
      const copia = await repo.duplicarPedido(id);
      toast.sucesso(`Pedido nº ${copia.numero} criado.`);
      navigate(`/pedidos/${copia.id}`);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível duplicar."));
      recarregar();
    }
  }

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  const filtrosAtivos = [
    filtro !== "Todos",
    marcaFiltro !== TODAS_MARCAS,
    clienteFiltro !== TODOS_CLIENTES,
    filtroPeriodo !== null,
  ].filter(Boolean).length;

  // Orçamento é cotação, não venda fechada — fica de fora do total do topo
  // (continua na lista, com etiqueta). O mesmo vale pro pedido de teste.
  const contaNoTotal = (p: { somenteOrcamento?: boolean; teste?: boolean }) =>
    !p.somenteOrcamento && !p.teste;
  const totalFiltrado = (pedidos ?? [])
    .filter(contaNoTotal)
    .reduce((soma, p) => soma + totaisPedido(p).total, 0);

  /** Etiquetas removiveis do que esta filtrado — antes so havia um numero num badge. */
  const chipsFiltro: { chave: string; rotulo: string; limpar: () => void }[] = [];
  if (filtro !== "Todos") {
    chipsFiltro.push({ chave: "status", rotulo: filtro, limpar: () => setFiltro("Todos") });
  }
  if (marcaFiltro !== TODAS_MARCAS) {
    chipsFiltro.push({
      chave: "marca",
      rotulo: marcaFiltro,
      limpar: () => setMarcaFiltro(TODAS_MARCAS),
    });
  }
  if (clienteFiltro !== TODOS_CLIENTES) {
    chipsFiltro.push({
      chave: "cliente",
      rotulo:
        contexto?.clientesComPedido.find((c) => c.id === clienteFiltro)?.nome ?? "Cliente",
      limpar: () => setClienteFiltro(TODOS_CLIENTES),
    });
  }
  if (filtroPeriodo) {
    chipsFiltro.push({
      chave: "periodo",
      rotulo: rotuloFiltroPeriodo(filtroPeriodo),
      limpar: () => setFiltroPeriodo(null),
    });
  }

  const pedidoDoMenu = pedidos?.find((p) => p.id === menuPedidoId);

  function identificadorDe(p: { somenteOrcamento?: boolean; codigoOrcamento?: string; numero: number }) {
    return p.somenteOrcamento ? `Orçamento ${p.codigoOrcamento}` : `nº ${p.numero}`;
  }

  return (
    <Tela
      titulo="Histórico"
      voltar="/"
      capa
      acao={
        <BotaoCapa rotulo="Filtros" onClick={() => setSheetFiltrosAberto(true)}>
          <IconeFiltros size={19} />
        </BotaoCapa>
      }
      abaixoDoTitulo={
        <>
          <div className={capaCss.capaBusca}>
            <span className={capaCss.capaBuscaIcone}>
              <IconeBuscar size={16} />
            </span>
            <input
              className={capaCss.capaBuscaCampo}
              placeholder="Número, marca ou cliente"
              aria-label="Buscar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className={capaCss.capaResumo}>
            <div className={capaCss.capaResumoItem}>
              <div className={capaCss.capaResumoValor}>{formatarMoeda(totalFiltrado)}</div>
              <div className={capaCss.capaResumoRotulo}>no filtro</div>
            </div>
            <div className={capaCss.capaResumoItem}>
              <div className={capaCss.capaResumoValor}>{pedidos?.length ?? 0}</div>
              <div className={capaCss.capaResumoRotulo}>
                {pedidos?.length === 1 ? "pedido" : "pedidos"}
              </div>
            </div>
          </div>
        </>
      }
    >
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

      {!pedidos ? (
        <Esqueleto linhas={4} />
      ) : pedidos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido neste filtro"
          descricao={
            chipsFiltro.length > 0
              ? "Tente limpar os filtros para ver mais pedidos."
              : "Os pedidos que você criar aparecem aqui."
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
        <div className="pilha">
          {pedidos.map((pedido) => {
            const { total } = totaisPedido(pedido);
            return (
              <LinhaLista
                key={pedido.id}
                acento={pedido.status === "enviado" ? "sucesso" : "alerta"}
                titulo={
                  <>
                    {contexto?.clientesPorId.get(pedido.clienteId)?.nome ?? "Cliente removido"}
                    {pedido.teste && <Etiqueta>Teste</Etiqueta>}
                    {pedido.somenteOrcamento && <Etiqueta variante="info">Orçamento</Etiqueta>}
                  </>
                }
                meta={
                  <>
                    {identificadorDe(pedido)} · {pedido.marca || "Sem marca"} ·{" "}
                    {formatarData(pedido.dataPedido)}
                    <StatusPedidoTag
                      status={pedido.status}
                      somenteOrcamento={pedido.somenteOrcamento}
                    />
                  </>
                }
                valor={formatarMoeda(total)}
                onClick={() => navigate(`/pedidos/${pedido.id}`)}
                acaoFim={
                  <Button
                    variante="fantasma"
                    className={css.botaoLinhaAcao}
                    aria-label={`Ações do pedido ${identificadorDe(pedido)}`}
                    onClick={() => setMenuPedidoId(pedido.id)}
                  >
                    <IconeMaisAcoes size={18} />
                  </Button>
                }
              />
            );
          })}
        </div>
      )}

      <Sheet
        titulo={pedidoDoMenu ? `Pedido ${identificadorDe(pedidoDoMenu)}` : "Ações"}
        aberto={!!pedidoDoMenu}
        aoFechar={() => setMenuPedidoId(null)}
      >
        <Button
          variante="secundario"
          bloco
          onClick={() => {
            const alvo = pedidoDoMenu;
            setMenuPedidoId(null);
            if (alvo) navigate(`/pedidos/${alvo.id}`);
          }}
        >
          Abrir
        </Button>
        <Button
          variante="secundario"
          bloco
          onClick={() => {
            const alvo = pedidoDoMenu;
            setMenuPedidoId(null);
            if (alvo) void duplicar(alvo.id);
          }}
        >
          Duplicar
        </Button>
        <Button
          variante="secundario"
          bloco
          onClick={() => {
            const alvo = pedidoDoMenu;
            setMenuPedidoId(null);
            if (alvo) navigate(`/pedidos/${alvo.id}/finalizar`);
          }}
        >
          Reenviar
        </Button>
      </Sheet>

      <Sheet
        titulo="Filtros"
        aberto={sheetFiltrosAberto}
        aoFechar={() => setSheetFiltrosAberto(false)}
      >
        <span className="secao-titulo">Situação</span>
        <Chips opcoes={FILTROS} valor={filtro} onChange={setFiltro} />

        {opcoesMarca.length > 1 && (
          <>
            <span className="secao-titulo">Marca</span>
            <Chips opcoes={opcoesMarca} valor={marcaFiltro} onChange={setMarcaFiltro} />
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

        <span className="secao-titulo">Período</span>
        <Button variante="secundario" bloco onClick={abrirSheetPeriodo}>
          {filtroPeriodo ? rotuloFiltroPeriodo(filtroPeriodo) : "Filtrar por período"}
        </Button>

        {pedidos && pedidos.length > 1 && (
          <>
            <span className="secao-titulo">Ordenar</span>
            <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />
          </>
        )}

        {filtrosAtivos > 0 && (
          <Button variante="fantasma" bloco onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}
      </Sheet>

      <Sheet
        titulo="Filtrar por período"
        aberto={sheetPeriodoAberto}
        aoFechar={() => setSheetPeriodoAberto(false)}
      >
        <Chips
          opcoes={TIPOS_PERIODO}
          valor={tipoPeriodo}
          onChange={setTipoPeriodo}
          rotulos={ROTULOS_TIPO_PERIODO}
        />
        <CalendarioMes
          mesExibido={mesCalendario}
          diasComDados={diasComDados}
          intervaloSelecionado={filtroPeriodo ? intervaloFiltroPeriodo(filtroPeriodo) : null}
          onSelecionarDia={(dia) => {
            setFiltroPeriodo({ tipo: tipoPeriodo, referencia: dia });
            setSheetPeriodoAberto(false);
          }}
          onMudarMes={setMesCalendario}
        />
        {filtroPeriodo && (
          <Button
            variante="fantasma"
            bloco
            onClick={() => {
              setFiltroPeriodo(null);
              setSheetPeriodoAberto(false);
            }}
          >
            Limpar filtro de período
          </Button>
        )}
      </Sheet>
    </Tela>
  );
}
