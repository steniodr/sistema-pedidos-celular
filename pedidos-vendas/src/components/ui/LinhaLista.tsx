import type { ReactNode } from "react";
import { IconeSeta } from "./icones";
import css from "./redesenho.module.css";

export type AcentoLinha = "sucesso" | "alerta" | "erro" | "info";

const CORES_ACENTO: Record<AcentoLinha, string> = {
  sucesso: "var(--cor-sucesso)",
  alerta: "var(--cor-alerta)",
  erro: "var(--cor-erro)",
  info: "var(--cor-primaria)",
};

/**
 * Linha de lista tocavel por inteiro. Antes, em Clientes/Produtos/Marcas, o
 * cartao era inerte e o unico acesso era um glifo "✎" cinza de 44px — com o
 * mesmo CSS copiado em tres modulos.
 */
export function LinhaLista({
  titulo,
  meta,
  valor,
  icone,
  iniciais,
  acento,
  fim,
  acaoFim,
  onClick,
}: {
  titulo: ReactNode;
  meta?: ReactNode;
  valor?: ReactNode;
  icone?: ReactNode;
  /** Duas letras como ancora visual quando nao ha icone (ex.: "TV"). */
  iniciais?: string;
  acento?: AcentoLinha;
  /** Substitui a seta final. */
  fim?: ReactNode;
  /**
   * Acao propria renderizada FORA do botao da linha (ex.: menu "..."), para nao
   * aninhar um botao dentro de outro.
   */
  acaoFim?: ReactNode;
  onClick?: () => void;
}) {
  const linha = (
    <button type="button" className={css.linhaLista} onClick={onClick}>
      {acento && (
        <span
          className={css.linhaListaAcento}
          style={{ background: CORES_ACENTO[acento] }}
          aria-hidden="true"
        />
      )}
      {(icone || iniciais) && (
        <span className={css.linhaListaIcone} aria-hidden="true">
          {icone ?? iniciais}
        </span>
      )}
      <span className={css.linhaListaInfo}>
        <span className={css.linhaListaTitulo}>{titulo}</span>
        {meta && <span className={css.linhaListaMeta}>{meta}</span>}
      </span>
      <span className={css.linhaListaFim}>
        {valor && <span className={css.linhaListaValor}>{valor}</span>}
        {fim ?? (
          <span className={css.linhaListaSeta} aria-hidden="true">
            <IconeSeta size={18} />
          </span>
        )}
      </span>
    </button>
  );

  if (!acaoFim) return linha;
  return (
    <div className={css.linhaListaComAcao}>
      {linha}
      <span className={css.linhaListaAcao}>{acaoFim}</span>
    </div>
  );
}
