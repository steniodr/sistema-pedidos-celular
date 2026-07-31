import type { StatusPedido as StatusPedidoTipo } from "../../domain/types";
import css from "./ui.module.css";

const ROTULOS: Record<StatusPedidoTipo, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
};

/** Rascunho em amarelo, Enviado em verde — usado onde quer que o status apareça. */
export function StatusPedido({ status }: { status: StatusPedidoTipo }) {
  return <span className={css[`status--${status}`]}>{ROTULOS[status]}</span>;
}
