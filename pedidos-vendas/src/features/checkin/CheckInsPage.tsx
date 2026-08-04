import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { CalendarioMes } from "../../components/ui/CalendarioMes";
import { Input, Select } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Sheet, Tela } from "../../components/ui/Layout";
import { useConfirm } from "../../components/ui/Confirm";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
import { baixarArquivo } from "../export/dadosExportacao";
import { formatarData } from "../produtos/statusBase";
import {
  dataLocalDoISO,
  intervaloFiltroPeriodo,
  rotuloFiltroPeriodo,
  type FiltroPeriodo,
  type TipoPeriodo,
} from "../pedidos/filtroPeriodoHistorico";
import { gerarPdfCheckIns, linhasDeCheckIns, montarTextoCheckIns } from "./exportarCheckIns";
import css from "./checkin.module.css";

const TODOS_CLIENTES = "";

const TIPOS_PERIODO = ["dia", "semana", "mes"] as const satisfies readonly TipoPeriodo[];
const ROTULOS_TIPO_PERIODO: Record<TipoPeriodo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

export function CheckInsPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca);
  const [clienteFiltro, setClienteFiltro] = useState(TODOS_CLIENTES);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo | null>(null);
  const [sheetFiltrosAberto, setSheetFiltrosAberto] = useState(false);
  const [sheetPeriodoAberto, setSheetPeriodoAberto] = useState(false);
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("dia");
  const [mesCalendario, setMesCalendario] = useState(() => new Date());
  const [sheetExportarAberto, setSheetExportarAberto] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [copiando, setCopiando] = useState(false);

  const { dados: contexto } = useDados(async () => {
    const [todos, clientes] = await Promise.all([repo.listarCheckIns(), repo.listarClientes()]);
    const clientesPorId = new Map(clientes.map((c) => [c.id, c]));
    const clientesComCheckIn = [...new Set(todos.map((c) => c.clienteId))]
      .map((id) => ({ id, nome: clientesPorId.get(id)?.nome ?? "Cliente removido" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { clientesPorId, clientesComCheckIn };
  }, [repo]);

  const { dados: checkInsBrutos, recarregar } = useDados(
    () => repo.listarCheckIns({ clienteId: clienteFiltro || undefined, busca: buscaDebounced }),
    [repo, clienteFiltro, buscaDebounced],
  );

  const diasComDados = useMemo(
    () => new Set((checkInsBrutos ?? []).map((c) => c.data)),
    [checkInsBrutos],
  );

  const checkIns = useMemo(() => {
    if (!checkInsBrutos) return checkInsBrutos;
    if (!filtroPeriodo) return checkInsBrutos;
    const { inicio, fim } = intervaloFiltroPeriodo(filtroPeriodo);
    return checkInsBrutos.filter((c) => c.data >= inicio && c.data <= fim);
  }, [checkInsBrutos, filtroPeriodo]);

  function abrirSheetPeriodo() {
    if (filtroPeriodo) {
      setTipoPeriodo(filtroPeriodo.tipo);
      setMesCalendario(dataLocalDoISO(filtroPeriodo.referencia));
    }
    setSheetFiltrosAberto(false);
    setSheetPeriodoAberto(true);
  }

  function limparFiltros() {
    setClienteFiltro(TODOS_CLIENTES);
    setFiltroPeriodo(null);
  }

  async function excluir(id: string) {
    const checkInApagado = await repo.obterCheckIn(id);
    if (!checkInApagado) return;
    const ok = await confirmar({
      mensagem: "Excluir este check-in? Esta ação não pode ser desfeita.",
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    try {
      await repo.removerCheckIn(id);
      toast.acao("Check-in excluído.", "Desfazer", () => {
        void repo.restaurarCheckIn(checkInApagado);
      });
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir o check-in."));
    }
  }

  async function exportarPdf() {
    if (!contexto) return;
    setGerandoPdf(true);
    try {
      const blob = await gerarPdfCheckIns(
        linhasDeCheckIns(checkIns ?? [], contexto.clientesPorId),
        "Check-in",
      );
      const hoje = new Date().toISOString().slice(0, 10);
      baixarArquivo(blob, `checkin-${hoje}.pdf`);
      toast.sucesso("PDF gerado.");
      setSheetExportarAberto(false);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível gerar o PDF."));
    } finally {
      setGerandoPdf(false);
    }
  }

  async function copiarParaAreaDeTransferencia(texto: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.focus();
    campo.select();
    const copiou = document.execCommand("copy");
    campo.remove();
    if (!copiou) throw new Error("Não foi possível copiar.");
  }

  async function copiarTexto() {
    if (!contexto) return;
    setCopiando(true);
    try {
      const linhasCheckIn = linhasDeCheckIns(checkIns ?? [], contexto.clientesPorId);
      const texto = montarTextoCheckIns(linhasCheckIn);
      await copiarParaAreaDeTransferencia(texto);
      toast.sucesso(
        linhasCheckIn.length > 0
          ? "Copiado para a área de transferência."
          : "Nenhum check-in neste filtro — copiado vazio.",
      );
      setSheetExportarAberto(false);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível copiar."));
    } finally {
      setCopiando(false);
    }
  }

  const filtrosAtivos = [clienteFiltro !== TODOS_CLIENTES, filtroPeriodo !== null].filter(
    Boolean,
  ).length;

  return (
    <Tela titulo="Check-in" voltar="/" comBarraInferior>
      <Input
        rotulo="Buscar"
        placeholder="Nome do cliente"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      <Button variante="secundario" bloco onClick={() => setSheetFiltrosAberto(true)}>
        Filtros
        {filtrosAtivos > 0 && <span className={css.badgeFiltros}>{filtrosAtivos}</span>}
      </Button>

      {checkIns?.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum check-in neste filtro"
          descricao="Toque em “Novo check-in” para começar."
        />
      ) : (
        <div className="pilha">
          {checkIns?.map((checkIn) => (
            <Cartao key={checkIn.id}>
              <div className="linha linha--entre">
                <span className="texto-forte">
                  {contexto?.clientesPorId.get(checkIn.clienteId)?.nome ?? "Cliente removido"}
                </span>
                <span className="texto-forte">{checkIn.hora}</span>
              </div>
              <div className="texto-suave">{formatarData(checkIn.data)}</div>
              <div className={css.acoesItem}>
                <Button variante="fantasma" onClick={() => navigate(`/checkins/${checkIn.id}`)}>
                  Editar
                </Button>
                <Button variante="perigo" onClick={() => excluir(checkIn.id)}>
                  Excluir
                </Button>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <BarraInferior>
        <div className={css.botoesRodape}>
          <Button variante="secundario" bloco onClick={() => setSheetExportarAberto(true)} disabled={!checkIns}>
            Exportar
          </Button>
          <Button bloco onClick={() => navigate("/checkins/novo")}>
            Novo check-in
          </Button>
        </div>
      </BarraInferior>

      <Sheet titulo="Filtros" aberto={sheetFiltrosAberto} aoFechar={() => setSheetFiltrosAberto(false)}>
        {contexto && contexto.clientesComCheckIn.length > 1 && (
          <Select
            rotulo="Cliente"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          >
            <option value={TODOS_CLIENTES}>Todos os clientes</option>
            {contexto.clientesComCheckIn.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}

        <Button variante="secundario" bloco onClick={abrirSheetPeriodo}>
          {filtroPeriodo ? rotuloFiltroPeriodo(filtroPeriodo) : "Filtrar por período"}
        </Button>

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

      <Sheet
        titulo="Exportar check-in"
        aberto={sheetExportarAberto}
        aoFechar={() => setSheetExportarAberto(false)}
      >
        <p className="texto-suave">
          {checkIns?.length ?? 0} check-in(s) no filtro atual. Escolha o formato:
        </p>
        <div className="pilha">
          <Button bloco disabled={gerandoPdf || copiando} onClick={exportarPdf}>
            {gerandoPdf ? "Gerando…" : "PDF"}
          </Button>
          <Button variante="secundario" bloco disabled={gerandoPdf || copiando} onClick={copiarTexto}>
            {copiando ? "Copiando…" : "Texto simples (copiar)"}
          </Button>
        </div>
      </Sheet>
    </Tela>
  );
}
