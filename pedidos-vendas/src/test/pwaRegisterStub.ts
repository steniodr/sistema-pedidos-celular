/**
 * Substitui "virtual:pwa-register" nos testes (vitest.config.ts, resolve.alias) —
 * esse módulo virtual só existe quando o plugin VitePWA roda de verdade
 * (`vite build`/`vite dev`), o que não é o caso do ambiente de testes.
 */
export function registerSW() {
  return async () => {};
}
