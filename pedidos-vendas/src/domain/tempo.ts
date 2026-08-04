/** "HH:mm" local a partir de um ISO — usado como horário padrão de pedidos/check-ins. */
export function horaDeIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:mm" local do instante atual. */
export function horaAgora(): string {
  return horaDeIso(new Date().toISOString());
}
