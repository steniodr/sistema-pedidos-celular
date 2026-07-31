import { Link } from "react-router-dom";
import type { StatusBase } from "./statusBase";
import css from "./produtos.module.css";

/** Faixa de alerta sobre a idade da base de produtos. Some quando está tudo em dia. */
export function AvisoBase({
  status,
  sempreVisivel,
}: {
  status: StatusBase;
  sempreVisivel?: boolean;
}) {
  if (status.nivel === "ok" && !sempreVisivel) return null;

  return (
    <div className={`${css.aviso} ${css[`aviso--${status.nivel}`]}`}>
      <span>{status.mensagem}</span>
      {status.nivel !== "ok" && (
        <Link to="/produtos/importar" className={css.avisoAcao}>
          Importar base
        </Link>
      )}
    </div>
  );
}
