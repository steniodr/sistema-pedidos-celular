import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Sheet, Tela } from "../../components/ui/Layout";
import { StatusPedido as StatusPedidoTag } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { baixarArquivo } from "../export/dadosExportacao";
import { formatarData } from "../produtos/statusBase";
import { gerarPdfHistorico, montarLinhasHistorico, montarTextoHistorico } from "./exportarHistorico";
import type { Cliente, StatusPedido } from "../../domain/types";
import css from "./pedidos.module.css";

const FILTROS = ["Todos", "Rascunhos", "Enviados"] as const;
type Filtro = (typeof FILTROS)[number];
const TODAS_MARCAS = "Todas";
const TODOS_CLIENTES = "";

const ORDENS = ["Recentes", "Maior valor"] as const;
type Ordem = (typeof ORDENS)[number];

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
  const [diaFiltro, setDiaFiltro] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("Recentes");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca);
  const [sheetExportarAberto, setSheetExportarAberto] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [copiando, setCopiando] = useState(false);

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

  const pedidos = useMemo(() => {
    if (!pedidosBrutos) return pedidosBrutos;
    const filtrados = diaFiltro
      ? pedidosBrutos.filter((p) => p.dataPedido === diaFiltro)
      : pedidosBrutos;
    if (ordem === "Recentes") return filtrados;
    return [...filtrados].sort((a, b) => totaisPedido(b).total - totaisPedido(a).total);
  }, [pedidosBrutos, diaFiltro, ordem]);

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

  function tituloExportacao(): string {
    if (filtro === "Enviados") return "Histórico — pedidos enviados";
    if (filtro === "Rascunhos") return "Histórico — rascunhos";
    return "Histórico — todos os pedidos";
  }

  function linhas(clientesPorId: Map<string, Cliente>) {
    return montarLinhasHistorico(pedidos ?? [], clientesPorId);
  }

  async function exportarPdf() {
    if (!contexto) return;
    setGerandoPdf(true);
    try {
      const blob = await gerarPdfHistorico(linhas(contexto.clientesPorId), tituloExportacao());
      const hoje = new Date().toISOString().slice(0, 10);
      baixarArquivo(blob, `historico-${hoje}.pdf`);
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
    // Navegadores sem a Clipboard API (ou fora de contexto seguro): campo
    // temporário + comando de copiar do próprio navegador.
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
      const linhasHistorico = linhas(contexto.clientesPorId);
      const texto = montarTextoHistorico(linhasHistorico);
      await copiarParaAreaDeTransferencia(texto);
      toast.sucesso(
        linhasHistorico.length > 0
          ? "Copiado para a área de transferência."
          : "Nenhum pedido neste filtro — copiado vazio.",
      );
      setSheetExportarAberto(false);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível copiar."));
    } finally {
      setCopiando(false);
    }
  }

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  return (
    <Tela titulo="Histórico" voltar="/" comBarraInferior>
      <div className={css.filtros}>
        <Chips opcoes={FILTROS} valor={filtro} onChange={setFiltro} />
      </div>

      {opcoesMarca.length > 1 && (
        <div className={css.filtros}>
          <Chips opcoes={opcoesMarca} valor={marcaFiltro} onChange={setMarcaFiltro} />
        </div>
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

      <Input
        rotulo="Dia"
        type="date"
        value={diaFiltro}
        onChange={(e) => setDiaFiltro(e.target.value)}
      />

      <Input
        rotulo="Buscar"
        placeholder="Número do pedido, marca ou cliente"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      {pedidos && pedidos.length > 1 && (
        <div className={css.filtros}>
          <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />
        </div>
      )}

      {pedidos?.length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido neste filtro" />
      ) : (
        <div className="pilha">
          {pedidos?.map((pedido) => {
            const { total } = totaisPedido(pedido);
            return (
              <Cartao key={pedido.id}>
                <div className="linha linha--entre">
                  <span className="texto-forte">Pedido nº {pedido.numero}</span>
                  <span className="texto-forte">{formatarMoeda(total)}</span>
                </div>
                <div className="texto-suave">
                  {contexto?.clientesPorId.get(pedido.clienteId)?.nome ?? "Cliente removido"} ·{" "}
                  {pedido.marca || "Sem marca"} · {formatarData(pedido.dataPedido)} ·{" "}
                  <StatusPedidoTag status={pedido.status} />
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

      <BarraInferior>
        <Button bloco onClick={() => setSheetExportarAberto(true)} disabled={!pedidos}>
          Exportar
        </Button>
      </BarraInferior>

      <Sheet
        titulo="Exportar histórico"
        aberto={sheetExportarAberto}
        aoFechar={() => setSheetExportarAberto(false)}
      >
        <p className="texto-suave">
          {pedidos?.length ?? 0} pedido(s) no filtro atual. Escolha o formato:
        </p>
        <div className="pilha">
          <Button bloco disabled={gerandoPdf || copiando} onClick={exportarPdf}>
            {gerandoPdf ? "Gerando…" : "PDF"}
          </Button>
          <Button
            variante="secundario"
            bloco
            disabled={gerandoPdf || copiando}
            onClick={copiarTexto}
          >
            {copiando ? "Copiando…" : "Texto simples (copiar)"}
          </Button>
        </div>
      </Sheet>
    </Tela>
  );
}
