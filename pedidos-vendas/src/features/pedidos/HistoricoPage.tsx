import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { StatusPedido as StatusPedidoTag } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { formatarData } from "../produtos/statusBase";
import type { StatusPedido } from "../../domain/types";
import css from "./pedidos.module.css";

const FILTROS = ["Todos", "Rascunhos", "Enviados"] as const;
type Filtro = (typeof FILTROS)[number];
const TODAS_MARCAS = "Todas";

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
  const [busca, setBusca] = useState("");

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

  const { dados: pedidos, recarregar } = useDados(
    () =>
      repo.listarPedidos({
        status: STATUS_POR_FILTRO[filtro],
        marca: marcaFiltro === TODAS_MARCAS ? undefined : marcaFiltro,
        busca,
      }),
    [repo, filtro, marcaFiltro, busca],
  );

  async function duplicar(id: string) {
    try {
      const copia = await repo.duplicarPedido(id);
      toast.sucesso(`Pedido nº ${copia.numero} criado.`);
      navigate(`/pedidos/${copia.id}`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível duplicar.");
      recarregar();
    }
  }

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  return (
    <Tela titulo="Histórico" voltar="/">
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
    </Tela>
  );
}
