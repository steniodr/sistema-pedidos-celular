import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { CalendarioMes } from "../../components/ui/CalendarioMes";
import { Input, Select } from "../../components/ui/Field";
import { Cartao, Chips, EstadoVazio, Sheet, Tela } from "../../components/ui/Layout";
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

  return (
    <Tela titulo="Histórico" voltar="/">
      <Input
        rotulo="Buscar"
        placeholder="Número do pedido, marca ou cliente"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      <Button
        variante="secundario"
        bloco
        className={css.botaoFiltros}
        onClick={() => setSheetFiltrosAberto(true)}
      >
        Filtros
        {filtrosAtivos > 0 && <span className={css.badgeFiltros}>{filtrosAtivos}</span>}
      </Button>

      {pedidos?.length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido neste filtro" />
      ) : (
        <div className="pilha">
          {pedidos?.map((pedido) => {
            const { total } = totaisPedido(pedido);
            return (
              <Cartao key={pedido.id}>
                <div className="linha linha--entre">
                  <span className="texto-forte">
                    {pedido.somenteOrcamento ? `Orçamento ${pedido.codigoOrcamento}` : `Pedido nº ${pedido.numero}`}
                  </span>
                  <span className="texto-forte">{formatarMoeda(total)}</span>
                </div>
                <div className="texto-suave">
                  {contexto?.clientesPorId.get(pedido.clienteId)?.nome ?? "Cliente removido"} ·{" "}
                  {pedido.marca || "Sem marca"} · {formatarData(pedido.dataPedido)} ·{" "}
                  <StatusPedidoTag status={pedido.status} />
                  {pedido.teste && <span className={css.tagTeste}>Teste</span>}
                  {pedido.somenteOrcamento && <span className={css.tagTeste}>Orçamento</span>}
                </div>
                <div className={css.acoesItem}>
                  <Button variante="fantasma" onClick={() => duplicar(pedido.id)}>
                    Duplicar
                  </Button>
                  <Button
                    variante="fantasma"
                    onClick={() => navigate(`/pedidos/${pedido.id}/finalizar`)}
                  >
                    Reenviar
                  </Button>
                  <Button
                    variante="secundario"
                    onClick={() => navigate(`/pedidos/${pedido.id}`)}
                  >
                    Abrir
                  </Button>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      <Sheet
        titulo="Filtros"
        aberto={sheetFiltrosAberto}
        aoFechar={() => setSheetFiltrosAberto(false)}
      >
        <Chips opcoes={FILTROS} valor={filtro} onChange={setFiltro} />

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
