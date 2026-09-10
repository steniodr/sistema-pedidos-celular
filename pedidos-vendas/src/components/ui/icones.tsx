import type { ReactNode } from "react";

/**
 * Ícones de traço, `currentColor`, grade 24 px — desenhados à mão, sem lib.
 * Herdam a cor do texto do elemento pai. Reutilizáveis em todas as telas.
 */
function Icone({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type Props = { size?: number };

export function IconeNovoPedido({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </Icone>
  );
}

export function IconeCheckin({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </Icone>
  );
}

export function IconeBases({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M12 3v10" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </Icone>
  );
}

export function IconeHistorico({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </Icone>
  );
}

export function IconeRelatorios({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </Icone>
  );
}

export function IconeConfig({ size }: Props) {
  return (
    <Icone size={size}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </Icone>
  );
}

export function IconeNovidades({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    </Icone>
  );
}

export function IconeSeta({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M9 6l6 6-6 6" />
    </Icone>
  );
}

// ── Ícones do redesenho — substituem os glifos de teclado (← × ✎ − + ‹ › ▾ ▴). ──

export function IconeVoltar({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M15 6l-6 6 6 6" />
    </Icone>
  );
}

export function IconeFechar({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icone>
  );
}

export function IconeChevronBaixo({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M6 9l6 6 6-6" />
    </Icone>
  );
}

export function IconeBuscar({ size }: Props) {
  return (
    <Icone size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </Icone>
  );
}

export function IconeFiltros({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </Icone>
  );
}

export function IconeCalendario({ size }: Props) {
  return (
    <Icone size={size}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Icone>
  );
}

export function IconeEditar({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Icone>
  );
}

export function IconeExcluir({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Icone>
  );
}

export function IconeSomar({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icone>
  );
}

export function IconeSubtrair({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M5 12h14" />
    </Icone>
  );
}

export function IconeMaisAcoes({ size }: Props) {
  return (
    <Icone size={size}>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </Icone>
  );
}

export function IconePlanilha({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 17h4" />
    </Icone>
  );
}

export function IconeExportar({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M12 3v11" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </Icone>
  );
}

export function IconeOk({ size }: Props) {
  return (
    <Icone size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.6 2.6L16 9.5" />
    </Icone>
  );
}

export function IconeAtencao({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.2v.1" />
    </Icone>
  );
}

export function IconeCliente({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icone>
  );
}

export function IconeProduto({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M3 8l9-4 9 4v8l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4M12 12v8" />
    </Icone>
  );
}

export function IconeMarca({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M3 11V5a2 2 0 0 1 2-2h6l10 10-8 8z" />
      <circle cx="8" cy="8" r="1.4" />
    </Icone>
  );
}

export function IconeBackup({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6" />
      <path d="M2 6h20v3H2z" />
      <path d="M10 13h4" />
    </Icone>
  );
}

export function IconeEntrega({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </Icone>
  );
}

export function IconeLista({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </Icone>
  );
}

export function IconeEndereco({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </Icone>
  );
}

export function IconeTeste({ size }: Props) {
  return (
    <Icone size={size}>
      <path d="M9 3h6M10 3v6L5.5 17A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9V3" />
      <path d="M7.5 14h9" />
    </Icone>
  );
}
