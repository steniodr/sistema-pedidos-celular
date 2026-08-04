import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { formatarMoeda, lerNumeroBR, totaisPedido, totalItem } from "../../domain/calculos";
import type { DescontoTipo } from "../../domain/types";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

const TIPOS: Record<string, DescontoTipo> = {
  "%": "percentual",
  "R$": "valor",
};

export function ResumoPedidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pedido, carregando, atualizar } = usePedido(id);
  const [descontoTexto, setDescontoTexto] = useState("");

  useEffect(() => {
    if (pedido) setDescontoTexto(pedido.descontoValor ? String(pedido.descontoValor).replace(".", ",") : "");
  }, [pedido?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando) {
    return (
      <Tela titulo="Resumo" voltar={true}>
        <p className="texto-suave">Carregando…</p>
      </Tela>
    );
  }
  if (!pedido) {
    return (
      <Tela titulo="Resumo" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  const rotuloTipo = pedido.descontoTipo === "percentual" ? "%" : "R$";
  const totais = totaisPedido(pedido);

  return (
    <Tela titulo="Resumo do pedido" voltar={`/pedidos/${pedido.id}`} comBarraInferior>
      <Cartao>
        <div className="pilha pilha--apertada">
          {pedido.itens.map((item) => (
            <div key={item.item} className="linha linha--entre">
              <span>
                {item.item}. {item.descricaoProduto}
                <span className="texto-suave">
                  {" "}
                  ({item.qtd} × {formatarMoeda(item.valorUnit)})
                </span>
                {item.comDesconto && <span className={css.tagPromocional}>Promocional</span>}
              </span>
              <span>{formatarMoeda(totalItem(item))}</span>
            </div>
          ))}
        </div>
      </Cartao>

      <h2 className="secao-titulo">Desconto</h2>
      <div className={css.descontoEntrada}>
        <Chips
          opcoes={["%", "R$"] as const}
          valor={rotuloTipo}
          onChange={(rotulo) => atualizar({ descontoTipo: TIPOS[rotulo] })}
        />
        <Input
          rotulo={pedido.descontoTipo === "percentual" ? "Percentual" : "Valor (R$)"}
          inputMode="decimal"
          value={descontoTexto}
          onChange={(e) => {
            setDescontoTexto(e.target.value);
            atualizar({ descontoValor: lerNumeroBR(e.target.value) ?? 0 });
          }}
        />
      </div>

      {pedido.descontoValor > 0 && (
        <Textarea
          rotulo="Motivo do desconto"
          value={pedido.descontoDescricao ?? ""}
          onChange={(e) => atualizar({ descontoDescricao: e.target.value })}
          ajuda="Quem autorizou e/ou o motivo do desconto."
        />
      )}

      <Cartao>
        <div className={css.linhaTotais}>
          <span>Subtotal</span>
          <span>{formatarMoeda(totais.subtotal)}</span>
        </div>
        <div className={css.linhaTotais}>
          <span>Desconto</span>
          <span>− {formatarMoeda(totais.desconto)}</span>
        </div>
        <div className={`${css.linhaTotais} ${css["linhaTotais--destaque"]}`}>
          <span>Total</span>
          <span>{formatarMoeda(totais.total)}</span>
        </div>
      </Cartao>

      <BarraInferior>
        <Button bloco onClick={() => navigate(`/pedidos/${pedido.id}/finalizar`)}>
          Finalizar pedido
        </Button>
      </BarraInferior>
    </Tela>
  );
}
