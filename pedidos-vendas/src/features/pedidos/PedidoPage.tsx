import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { Button } from "../../components/ui/Button";
import { BarraInferior, Cartao, EstadoVazio, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido, totalItem } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

export function PedidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  const toast = useToast();
  const { pedido, cliente, carregando, atualizar } = usePedido(id);
  const [excluindo, setExcluindo] = useState(false);

  if (carregando) return <Tela titulo="Pedido" voltar="/">{null}</Tela>;
  if (!pedido) {
    return (
      <Tela titulo="Pedido" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  const { total } = totaisPedido(pedido);

  async function removerItem(indice: number) {
    if (!pedido) return;
    const itens = pedido.itens
      .filter((_, i) => i !== indice)
      .map((item, i) => ({ ...item, item: i + 1 }));
    await atualizar({ itens });
  }

  async function excluirPedido() {
    if (!pedido) return;
    if (!window.confirm(`Excluir o pedido nº ${pedido.numero}? Esta ação não pode ser desfeita.`)) {
      return;
    }
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
    <Tela titulo={`Pedido nº ${pedido.numero}`} voltar="/" comBarraInferior>
      <Cartao>
        <div className="texto-forte">{cliente?.nome ?? "Cliente removido"}</div>
        <div className="texto-suave">{pedido.marca || "Sem marca"}</div>
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
