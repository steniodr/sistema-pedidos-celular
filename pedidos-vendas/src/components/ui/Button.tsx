import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import css from "./ui.module.css";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

interface Comum {
  variante?: Variante;
  bloco?: boolean;
  grande?: boolean;
  children: ReactNode;
}

function classes({ variante = "primario", bloco, grande }: Comum): string {
  return [
    css.botao,
    css[`botao--${variante}`],
    bloco ? css["botao--bloco"] : "",
    grande ? css["botao--grande"] : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variante,
  bloco,
  grande,
  children,
  className,
  ...props
}: Comum & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[classes({ variante, bloco, grande, children }), className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  variante,
  bloco,
  grande,
  children,
  className,
}: Comum & { to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={[classes({ variante, bloco, grande, children }), className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Link>
  );
}
