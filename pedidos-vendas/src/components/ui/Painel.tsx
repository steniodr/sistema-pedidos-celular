import { useState, type ReactNode } from "react";
import { IconeChevronBaixo } from "./icones";
import css from "./redesenho.module.css";

/**
 * Agrupa campos/linhas relacionados num cartao com cabecalho. Existe porque
 * `.app-conteudo` poe 16px entre TODO elemento e nao havia como agrupar nada —
 * telas longas (Finalizar, cadastro de cliente) viravam uma parede.
 *
 * `colapsavel` fecha o corpo e mostra `resumo` no lugar; `contador` ("3 de 5")
 * deixa visivel quanto ja foi preenchido sem precisar abrir.
 */
export function Painel({
  titulo,
  icone,
  acao,
  contador,
  colapsavel,
  abertoInicial = true,
  aberto: abertoControlado,
  onAlternar,
  resumo,
  children,
}: {
  titulo?: string;
  icone?: ReactNode;
  acao?: ReactNode;
  contador?: ReactNode;
  colapsavel?: boolean;
  abertoInicial?: boolean;
  /** Modo controlado — quando informado, o pai manda no aberto/fechado. */
  aberto?: boolean;
  onAlternar?: () => void;
  /** Mostrado no lugar do corpo quando colapsado. */
  resumo?: ReactNode;
  children: ReactNode;
}) {
  const [abertoInterno, setAbertoInterno] = useState(abertoInicial);
  const aberto = abertoControlado ?? abertoInterno;
  const mostrarCorpo = !colapsavel || aberto;

  const conteudoCabecalho = (
    <>
      {icone && <span className={css.painelIcone}>{icone}</span>}
      <span className={css.painelTitulo}>{titulo}</span>
      {contador && <span className={css.painelContador}>{contador}</span>}
      {colapsavel && (
        <span className={`${css.painelSeta} ${aberto ? css["painelSeta--aberto"] : ""}`}>
          <IconeChevronBaixo size={18} />
        </span>
      )}
    </>
  );

  return (
    <div className={css.painel}>
      {titulo &&
        (colapsavel ? (
          // `acao` fica FORA do botao de dobrar — botao dentro de botao e HTML
          // invalido, e antes a acao era silenciosamente descartada aqui.
          <div className={css.painelCabecalho}>
            <button
              type="button"
              className={`${css.painelCabecalho} ${css["painelCabecalho--clicavel"]}`}
              aria-expanded={aberto}
              onClick={() => (onAlternar ? onAlternar() : setAbertoInterno((v) => !v))}
            >
              {conteudoCabecalho}
            </button>
            {acao}
          </div>
        ) : (
          <div className={css.painelCabecalho}>
            {icone && <span className={css.painelIcone}>{icone}</span>}
            <span className={css.painelTitulo}>{titulo}</span>
            {contador && <span className={css.painelContador}>{contador}</span>}
            {acao}
          </div>
        ))}
      {mostrarCorpo ? children : resumo}
    </div>
  );
}
