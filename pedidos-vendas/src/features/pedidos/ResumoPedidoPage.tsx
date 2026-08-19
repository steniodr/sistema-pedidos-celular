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
  const [erroDesconto, setErroDesconto] = useState<string | undefined>();

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
          onChange={(rotulo) => {
            // Limpa o valor ao trocar de tipo — "10" como percentual e "10"
            // como R$ são coisas bem diferentes; reaproveitar o número digitado
            // sob a unidade errada é o bug que motivou isso (ver histórico).
            atualizar({ descontoTipo: TIPOS[rotulo], descontoValor: 0 });
            setDescontoTexto("");
            setErroDesconto(undefined);
          }}
        />
        <Input
          rotulo={pedido.descontoTipo === "percentual" ? "Percentual" : "Valor (R$)"}
          inputMode="decimal"
          value={descontoTexto}
          erro={erroDesconto}
          onChange={(e) => {
            const texto = e.target.value;
            setDescontoTexto(texto);
            setErroDesconto(undefined);
            if (texto.trim() === "") {
              atualizar({ descontoValor: 0 });
              return;
            }
            const numero = lerNumeroBR(texto);
            // Só sincroniza com o pedido quando o texto já é um número válido —
            // evita zerar o desconto a cada tecla enquanto o vendedor ainda
            // está no meio de digitar um decimal (ex.: "1," antes de "1,5").
            if (numero !== null) atualizar({ descontoValor: numero });
          }}
          onBlur={() => {
            if (descontoTexto.trim() !== "" && lerNumeroBR(descontoTexto) === null) {
              setErroDesconto("Informe um número válido.");
            }
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
