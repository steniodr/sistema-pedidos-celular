/**
 * Marca do app: PNG fornecido pelo cliente (moldura do pedido + visto + pincel),
 * recortado sem o card externo e com fundo transparente, servido de `public/`.
 * Há duas variantes por tema — como o cabeçalho do app é sempre navy, aqui
 * usamos a de tema escuro (moldura branca). A de tema claro fica em
 * `public/logo-tema-claro.png` para favicon / PDF / uso futuro.
 * (A arte é baixa resolução; renderiza pequena de propósito para não borrar.)
 */
export function Logo({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <img
      src="/logo-tema-escuro.png"
      alt={title ?? ""}
      height={size}
      style={{ height: size, width: "auto", display: "block" }}
      draggable={false}
    />
  );
}
