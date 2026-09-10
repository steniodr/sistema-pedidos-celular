import type { ReactNode } from "react";
import css from "./redesenho.module.css";

export type VarianteEtiqueta = "neutro" | "info" | "sucesso" | "alerta" | "erro";

/**
 * Pilula curta de status/rotulo. Substitui as copias que existiam em
 * clientes/produtos/marcas/pedidos/checkin (tagSituacao, tagTeste,
 * tagPromocional, tagOculta, badgeFiltros).
 */
export function Etiqueta({
  variante = "neutro",
  children,
}: {
  variante?: VarianteEtiqueta;
  children: ReactNode;
}) {
  return <span className={`${css.etiqueta} ${css[`etiqueta--${variante}`]}`}>{children}</span>;
}
