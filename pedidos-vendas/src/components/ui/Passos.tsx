import { IconeOk } from "./icones";
import css from "./redesenho.module.css";

/**
 * Indicador 1-2-3 dos assistentes de importacao. Vive dentro da capa (fundo
 * navy), por isso as cores sao sobre transparencia branca.
 */
export function Passos({ rotulos, atual }: { rotulos: string[]; atual: number }) {
  return (
    <div className={css.passos}>
      {rotulos.map((rotulo, i) => {
        const feito = i < atual;
        const ativo = i === atual;
        return (
          <div key={rotulo} className={css.passo} style={{ flex: i < rotulos.length - 1 ? "0 0 auto" : undefined }}>
            <div className={css.passo}>
              <span
                className={`${css.passoNumero} ${ativo ? css["passoNumero--ativo"] : ""} ${
                  feito ? css["passoNumero--feito"] : ""
                }`}
              >
                {feito ? <IconeOk size={13} /> : i + 1}
              </span>
              <span className={`${css.passoRotulo} ${ativo ? css["passoRotulo--ativo"] : ""}`}>
                {rotulo}
              </span>
            </div>
            {i < rotulos.length - 1 && <span className={css.passoLinha} />}
          </div>
        );
      })}
    </div>
  );
}
