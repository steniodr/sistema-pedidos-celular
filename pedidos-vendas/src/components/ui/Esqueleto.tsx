import css from "./redesenho.module.css";

/**
 * Placeholder de carregamento. `useDados` devolve `undefined` enquanto busca, e
 * antes disso varias telas ficavam completamente em branco.
 */
export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className={css.esqueletoLista} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={css.esqueletoCartao}>
          <div className={css.esqueletoBarra} style={{ width: "62%" }} />
          <div className={css.esqueletoBarra} style={{ width: "40%", height: 10 }} />
        </div>
      ))}
    </div>
  );
}
