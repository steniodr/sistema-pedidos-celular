import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IconeFechar, IconeVoltar } from "./icones";
import css from "./ui.module.css";
import capaCss from "./redesenho.module.css";

export function Tela({
  titulo,
  subtitulo,
  voltar,
  aoVoltar,
  acao,
  capa,
  abaixoDoTitulo,
  comBarraInferior,
  barraInferiorAlta,
  children,
}: {
  titulo: string;
  /** Linha de contexto sob o titulo — so aparece no cabecalho `capa`. */
  subtitulo?: string;
  /** Rota de volta; `true` usa o historico do navegador. */
  voltar?: string | true;
  /**
   * Intercepta o botao voltar (ex.: confirmar alteracoes nao salvas). Quando
   * informado, a navegacao padrao so acontece se o handler chamar `seguir()`.
   */
  aoVoltar?: (seguir: () => void) => void;
  acao?: ReactNode;
  /**
   * Cabecalho com a capa navy da marca, igual a tela inicial. Opcional para as
   * telas migrarem uma a uma; sem ele o cabecalho branco antigo continua valendo.
   */
  capa?: boolean;
  /** Conteudo extra dentro da capa (busca, resumo, passos). */
  abaixoDoTitulo?: ReactNode;
  comBarraInferior?: boolean;
  /** Reserva mais espaco embaixo — para uma `BarraInferior` com dois botoes empilhados. */
  barraInferiorAlta?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  const classeBarra = comBarraInferior
    ? barraInferiorAlta
      ? " app-conteudo--com-barra-alta"
      : " app-conteudo--com-barra"
    : "";

  function irParaTras() {
    const seguir = () => {
      if (voltar === true) navigate(-1);
      else if (voltar) navigate(voltar);
    };
    if (aoVoltar) aoVoltar(seguir);
    else seguir();
  }

  return (
    <div className="app-shell">
      {capa ? (
        <header className={capaCss.capa}>
          <div className={capaCss.capaLinha}>
            {voltar && (
              <button
                type="button"
                className={capaCss.capaBotao}
                aria-label="Voltar"
                onClick={irParaTras}
              >
                <IconeVoltar size={19} />
              </button>
            )}
            <div className={capaCss.capaTexto}>
              <h1 className={capaCss.capaTitulo}>{titulo}</h1>
              {subtitulo && <div className={capaCss.capaSubtitulo}>{subtitulo}</div>}
            </div>
            {acao}
          </div>
          {abaixoDoTitulo}
        </header>
      ) : (
        <header className={css.barraTopo}>
          {voltar && (
            <button
              type="button"
              className={css.barraVoltar}
              aria-label="Voltar"
              onClick={irParaTras}
            >
              <IconeVoltar size={22} />
            </button>
          )}
          <h1 className={css.barraTopoTitulo}>{titulo}</h1>
          {acao}
        </header>
      )}
      <main className={`app-conteudo${classeBarra}${capa ? ` ${capaCss.conteudoCapa}` : ""}`}>
        {children}
      </main>
    </div>
  );
}

/** Botao redondo sobre a capa navy (menu de acoes, filtros...). */
export function BotaoCapa({
  children,
  rotulo,
  onClick,
}: {
  children: ReactNode;
  rotulo: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={capaCss.capaBotao} aria-label={rotulo} onClick={onClick}>
      {children}
    </button>
  );
}

export function BarraInferior({ children }: { children: ReactNode }) {
  return <div className={css.barraBase}>{children}</div>;
}

export function Cartao({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const classe = [css.cartao, onClick ? css["cartao--clicavel"] : "", className]
    .filter(Boolean)
    .join(" ");
  if (onClick) {
    return (
      <button type="button" className={classe} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={classe}>{children}</div>;
}

export function EstadoVazio({
  titulo,
  descricao,
  ilustracao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  /** SVG pequeno; da personalidade ao vazio em vez de so texto cinza. */
  ilustracao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className={css.vazio}>
      {ilustracao}
      <span className={css.vazioTitulo}>{titulo}</span>
      {descricao && <span>{descricao}</span>}
      {acao}
    </div>
  );
}

export function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulos,
  modo = "unico",
}: {
  opcoes: readonly T[];
  valor: T | undefined;
  onChange: (valor: T) => void;
  /** Texto exibido no chip quando difere do valor (ex.: sentinela "outro"). */
  rotulos?: Partial<Record<T, string>>;
  /**
   * "unico" = escolha unica (preenchido);
   * "multi" = varias podem estar ativas (contorno + visto).
   */
  modo?: "unico" | "multi";
}) {
  return (
    <div className={css.chips}>
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={[
            css.chip,
            modo === "multi" ? css["chip--multi"] : "",
            opcao === valor ? css["chip--ativo"] : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(opcao)}
        >
          {rotulos?.[opcao] ?? opcao}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  titulo,
  aberto,
  aoFechar,
  children,
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
}) {
  if (!aberto) return null;
  return (
    <div
      className={css.sheetFundo}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={aoFechar}
    >
      <div className={css.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={css.sheetCabecalho}>
          <h2>{titulo}</h2>
          <button
            type="button"
            className={css.barraVoltar}
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <IconeFechar size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
