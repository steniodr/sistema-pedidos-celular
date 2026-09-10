import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, EstadoVazio, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido, totalItem } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

export function PedidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const repo = useRepository();
  const toast = useToast();
  const confirmar = useConfirm();
  const { pedido, cliente, carregando, atualizar } = usePedido(id);
  const [excluindo, setExcluindo] = useState(false);
  const [editandoCabecalho, setEditandoCabecalho] = useState(false);

  // Volta de /clientes?selecionar=1&retorno=/pedidos/:id com ?clienteId= na
  // URL — troca o cliente do pedido e limpa a query string.
  const trocaClienteProcessada = useRef(false);
  useEffect(() => {
    if (trocaClienteProcessada.current) return;
    const novoClienteId = params.get("clienteId");
    if (!novoClienteId || !pedido) return;
    trocaClienteProcessada.current = true;
    navigate(`/pedidos/${pedido.id}`, { replace: true });
    if (novoClienteId !== pedido.clienteId) {
      void atualizar({ clienteId: novoClienteId });
    }
  }, [params, pedido, atualizar, navigate]);

  if (carregando) {
    return (
      <Tela titulo="Pedido" voltar="/">
        <p className="texto-suave">Carregando…</p>
      </Tela>
    );
  }
  if (!pedido) {
    return (
      <Tela titulo="Pedido" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  const { total } = totaisPedido(pedido);
  const identificador = pedido.somenteOrcamento
    ? `Orçamento ${pedido.codigoOrcamento}`
    : `Pedido nº ${pedido.numero}`;

  async function removerItem(indice: number) {
    if (!pedido) return;
    const itens = pedido.itens
      .filter((_, i) => i !== indice)
      .map((item, i) => ({ ...item, item: i + 1 }));
    await atualizar({ itens });
  }

  async function excluirPedido() {
    if (!pedido) return;
    const rotulo = pedido.somenteOrcamento
      ? `orçamento ${pedido.codigoOrcamento}`
      : `pedido nº ${pedido.numero}`;
    const ok = await confirmar({
      mensagem: `Excluir o ${rotulo}? Esta ação não pode ser desfeita.`,
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setExcluindo(true);
    try {
      await repo.removerPedido(pedido.id);
      const pedidoApagado = pedido;
      toast.acao("Pedido excluído.", "Desfazer", () => {
        void repo.restaurarPedido(pedidoApagado);
      });
      navigate("/pedidos", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir o pedido."));
      setExcluindo(false);
    }
  }

  return (
    <Tela titulo={identificador} voltar="/" comBarraInferior>
      <Cartao>
        {editandoCabecalho ? (
          <>
            <Input
              rotulo="Marca"
              placeholder="Ex.: MERKO, ARARA AZUL"
              value={pedido.marca}
              onChange={(e) => atualizar({ marca: e.target.value })}
            />
            <div className="texto-suave">{cliente?.nome ?? "Cliente removido"}</div>
            <div className="linha linha--entre">
              <Button
                variante="secundario"
                onClick={() =>
                  navigate(
                    `/clientes?selecionar=1&retorno=${encodeURIComponent(`/pedidos/${pedido.id}`)}`,
                  )
                }
              >
                Trocar cliente
              </Button>
              <Button variante="fantasma" onClick={() => setEditandoCabecalho(false)}>
                Concluir
              </Button>
            </div>
          </>
        ) : (
          <div className={css.linhaCabecalho}>
            <div className={css.linhaCabecalhoInfo}>
              <div className="texto-forte">{cliente?.nome ?? "Cliente removido"}</div>
              <div className="texto-suave">{pedido.marca || "Sem marca"}</div>
            </div>
            <Button
              variante="fantasma"
              className={css.botaoEditar}
              aria-label="Editar cliente ou marca"
              onClick={() => setEditandoCabecalho(true)}
            >
              ✎
            </Button>
          </div>
        )}
      </Cartao>

      <Button variante="perigo" onClick={excluirPedido} disabled={excluindo}>
        {excluindo ? "Excluindo…" : "Excluir pedido"}
      </Button>

      <div className="linha linha--entre">
        <h2 className="secao-titulo">Itens ({pedido.itens.length})</h2>
        <Button variante="secundario" onClick={() => navigate(`/pedidos/${pedido.id}/item/novo`)}>
          + Adicionar item
        </Button>
      </div>

      {pedido.itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum item"
          descricao="Adicione o primeiro produto do pedido."
        />
      ) : (
        <div className="pilha">
          {pedido.itens.map((item, indice) => (
            <Cartao key={indice}>
              <div className="linha linha--entre">
                <span className="texto-forte">
                  {item.item}. {item.descricaoProduto}
                  {item.comDesconto && <span className={css.tagPromocional}>Promocional</span>}
                </span>
                <span className="texto-forte">{formatarMoeda(totalItem(item))}</span>
              </div>
              <div className="texto-suave">
                {item.qtd} × {formatarMoeda(item.valorUnit)}
                {item.embalagem ? ` · ${item.embalagem}` : ""}
                {item.cor ? ` · ${item.cor}` : ""}
                {item.padraoComplemento ? ` · ${item.padraoComplemento}` : ""}
              </div>
              {item.descricao && <div className="texto-suave">{item.descricao}</div>}
              <div className={css.acoesItem}>
                <Button
                  variante="fantasma"
                  onClick={() => navigate(`/pedidos/${pedido.id}/item/${indice}`)}
                >
                  Editar
                </Button>
                <Button variante="perigo" onClick={() => removerItem(indice)}>
                  Remover
                </Button>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <BarraInferior>
        <div className={css.totalBarra}>
          <span className="texto-suave">Total</span>
          <span className={css.totalValor}>{formatarMoeda(total)}</span>
        </div>
        <Button
          onClick={() => navigate(`/pedidos/${pedido.id}/resumo`)}
          disabled={pedido.itens.length === 0}
        >
          Resumo
        </Button>
      </BarraInferior>
    </Tela>
  );
}
