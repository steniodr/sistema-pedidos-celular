import type { StatusPedido as StatusPedidoTipo } from "../../domain/types";
import css from "./ui.module.css";

const ROTULOS: Record<StatusPedidoTipo, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
};

/**
 * Rascunho em amarelo, Enviado em verde — usado onde quer que o status apareça.
 * Orçamento enviado vira "Orçado" no tom do rascunho: "Enviado" verde passava a
 * ideia de venda fechada, o que um orçamento não é.
 */
export function StatusPedido({
  status,
  somenteOrcamento,
}: {
  status: StatusPedidoTipo;
  somenteOrcamento?: boolean;
}) {
  if (somenteOrcamento && status === "enviado") {
    return <span className={css["status--orcado"]}>Orçado</span>;
  }
  return <span className={css[`status--${status}`]}>{ROTULOS[status]}</span>;
}
