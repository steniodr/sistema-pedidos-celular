import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { StatusPedido as StatusPedidoTag } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { baixarArquivo } from "../export/dadosExportacao";
import { formatarData } from "../produtos/statusBase";
import { gerarPdfHistorico, montarLinhasHistorico, montarTextoHistorico } from "./exportarHistorico";
import type { StatusPedido } from "../../domain/types";
import css from "./pedidos.module.css";

const FILTROS = ["Todos", "Rascunhos", "Enviados"] as const;
type Filtro = (typeof FILTROS)[number];
const TODAS_MARCAS = "Todas";

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
  const [ordem, setOrdem] = useState<Ordem>("Recentes");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca);
  const [exportando, setExportando] = useState<"todos" | "enviados" | null>(null);
  const [copiando, setCopiando] = useState<"todos" | "enviados" | null>(null);

  const { dados: contexto } = useDados(async () => {
    const [todosPedidos, clientes] = await Promise.all([
      repo.listarPedidos(),
      repo.listarClientes(),
    ]);
    return {
      marcas: [...new Set(todosPedidos.map((p) => p.marca).filter(Boolean))],
      nomePorClienteId: new Map(clientes.map((c) => [c.id, c.nome])),
    };
  }, [repo]);

  const { dados: pedidosBrutos, recarregar } = useDados(
    () =>
      repo.listarPedidos({
        status: STATUS_POR_FILTRO[filtro],
        marca: marcaFiltro === TODAS_MARCAS ? undefined : marcaFiltro,
        busca: buscaDebounced,
      }),
    [repo, filtro, marcaFiltro, buscaDebounced],
  );

  const pedidos = useMemo(() => {
    if (!pedidosBrutos) return pedidosBrutos;
    if (ordem === "Recentes") return pedidosBrutos;
    return [...pedidosBrutos].sort(
      (a, b) => totaisPedido(b).total - totaisPedido(a).total,
    );
  }, [pedidosBrutos, ordem]);

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

  async function linhasParaExportar(apenasEnviados: boolean) {
    const [pedidosParaExportar, clientes] = await Promise.all([
      repo.listarPedidos(apenasEnviados ? { status: "enviado" } : {}),
      repo.listarClientes(),
    ]);
    const clientesPorId = new Map(clientes.map((c) => [c.id, c]));
    return montarLinhasHistorico(pedidosParaExportar, clientesPorId);
  }

  async function exportarPdf(apenasEnviados: boolean) {
    setExportando(apenasEnviados ? "enviados" : "todos");
    try {
      const linhas = await linhasParaExportar(apenasEnviados);
      const titulo = apenasEnviados
        ? "Histórico — pedidos enviados"
        : "Histórico — todos os pedidos";
      const blob = await gerarPdfHistorico(linhas, titulo);
      const hoje = new Date().toISOString().slice(0, 10);
      baixarArquivo(blob, `historico-${apenasEnviados ? "enviados" : "todos"}-${hoje}.pdf`);
      toast.sucesso("PDF gerado.");
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível gerar o PDF."));
    } finally {
      setExportando(null);
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

  async function copiarTexto(apenasEnviados: boolean) {
    setCopiando(apenasEnviados ? "enviados" : "todos");
    try {
      const linhas = await linhasParaExportar(apenasEnviados);
      const texto = montarTextoHistorico(linhas);
      await copiarParaAreaDeTransferencia(texto);
      toast.sucesso(
        linhas.length > 0
          ? "Copiado para a área de transferência."
          : "Nenhum pedido neste filtro — copiado vazio.",
      );
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível copiar."));
    } finally {
      setCopiando(null);
    }
  }

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  return (
    <Tela titulo="Histórico" voltar="/" comBarraInferior="grande">
      <div className={css.filtros}>
        <Chips opcoes={FILTROS} valor={filtro} onChange={setFiltro} />
      </div>

      {opcoesMarca.length > 1 && (
        <div className={css.filtros}>
          <Chips opcoes={opcoesMarca} valor={marcaFiltro} onChange={setMarcaFiltro} />
        </div>
      )}

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
                  {contexto?.nomePorClienteId.get(pedido.clienteId) ?? "Cliente removido"} ·{" "}
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
        <div className={css.rodapeExportar}>
          <div className={css.botoesRodape}>
            <Button
              variante="secundario"
              bloco
              disabled={exportando !== null}
              onClick={() => exportarPdf(false)}
            >
              {exportando === "todos" ? "Gerando…" : "Exportar todos (PDF)"}
            </Button>
            <Button
              variante="secundario"
              bloco
              disabled={exportando !== null}
              onClick={() => exportarPdf(true)}
            >
              {exportando === "enviados" ? "Gerando…" : "Exportar enviados (PDF)"}
            </Button>
          </div>
          <div className={css.botoesRodape}>
            <Button
              variante="secundario"
              bloco
              disabled={copiando !== null}
              onClick={() => copiarTexto(false)}
            >
              {copiando === "todos" ? "Copiando…" : "Copiar todos (Texto Simples)"}
            </Button>
            <Button
              variante="secundario"
              bloco
              disabled={copiando !== null}
              onClick={() => copiarTexto(true)}
            >
              {copiando === "enviados" ? "Copiando…" : "Copiar enviados (Texto Simples)"}
            </Button>
          </div>
        </div>
      </BarraInferior>
    </Tela>
  );
}
