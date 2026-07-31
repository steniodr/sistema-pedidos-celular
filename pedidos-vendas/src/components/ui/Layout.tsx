import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import css from "./ui.module.css";

export function Tela({
  titulo,
  voltar,
  acao,
  comBarraInferior,
  children,
}: {
  titulo: string;
  /** Rota de volta; `true` usa o histórico do navegador. */
  voltar?: string | true;
  acao?: ReactNode;
  comBarraInferior?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className={css.barraTopo}>
        {voltar && (
          <button
            type="button"
            className={css.barraVoltar}
            aria-label="Voltar"
            onClick={() => (voltar === true ? navigate(-1) : navigate(voltar))}
          >
            ←
          </button>
        )}
        <h1 className={css.barraTopoTitulo}>{titulo}</h1>
        {acao}
      </header>
      <main
        className={`app-conteudo${comBarraInferior ? " app-conteudo--com-barra" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}

export function BarraInferior({ children }: { children: ReactNode }) {
  return <div className={css.barraBase}>{children}</div>;
}

export function Cartao({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`${css.cartao} ${css["cartao--clicavel"]}`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
  return <div className={css.cartao}>{children}</div>;
}

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className={css.vazio}>
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
}: {
  opcoes: readonly T[];
  valor: T | undefined;
  onChange: (valor: T) => void;
  /** Texto exibido no chip quando difere do valor (ex.: sentinela "outro"). */
  rotulos?: Partial<Record<T, string>>;
}) {
  return (
    <div className={css.chips}>
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={`${css.chip} ${opcao === valor ? css["chip--ativo"] : ""}`}
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
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
