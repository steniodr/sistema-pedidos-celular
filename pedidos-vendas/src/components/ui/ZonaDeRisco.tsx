import type { ReactNode } from "react";
import css from "./redesenho.module.css";

/**
 * Bloco isolado para acoes destrutivas, no fim da tela. Antes, "Excluir
 * cliente/produto/marca" ficava a 44px do "Salvar" na barra fixa — bem onde o
 * polegar descansa.
 */
export function ZonaDeRisco({
  titulo = "Zona de risco",
  descricao,
  children,
}: {
  titulo?: string;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={css.zonaRisco}>
      <span className={css.zonaRiscoTitulo}>{titulo}</span>
      {descricao && <span className={css.zonaRiscoTexto}>{descricao}</span>}
      {children}
    </div>
  );
}
