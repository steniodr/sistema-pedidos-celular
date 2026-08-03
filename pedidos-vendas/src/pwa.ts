import { registerSW } from "virtual:pwa-register";

/**
 * Controle manual do service worker (registro feito à mão — ver
 * `injectRegister: false` em vite.config.ts). Existe porque o app instalado
 * na tela inicial costuma ficar aberto muito tempo sem uma navegação de
 * verdade, e o navegador só checa atualização do service worker em certas
 * navegações — então a atualização silenciosa às vezes nunca chega a
 * acontecer. Aqui: checagem periódica em segundo plano + um jeito de forçar
 * a checagem na hora (botão em Configurações).
 */

const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000; // 1 hora

let aplicar: ((recarregarPagina?: boolean) => Promise<void>) | undefined;
let registro: ServiceWorkerRegistration | undefined;
let atualizacaoDisponivel = false;
let ouvintes: Array<() => void> = [];

export function iniciarServiceWorker() {
  aplicar = registerSW({
    immediate: true,
    onNeedRefresh() {
      atualizacaoDisponivel = true;
      ouvintes.forEach((f) => f());
    },
    onRegisteredSW(_url, registration) {
      registro = registration;
      if (!registration) return;
      setInterval(() => void registration.update(), INTERVALO_CHECAGEM_MS);
    },
  });
}

export function haAtualizacaoDisponivel(): boolean {
  return atualizacaoDisponivel;
}

/** Chama `callback` sempre que uma atualização for detectada; devolve como cancelar. */
export function aoAtualizarDisponivel(callback: () => void): () => void {
  ouvintes.push(callback);
  return () => {
    ouvintes = ouvintes.filter((f) => f !== callback);
  };
}

/** Ativa a versão nova e recarrega a página. */
export async function aplicarAtualizacao(): Promise<void> {
  await aplicar?.(true);
}

/** Botão "Verificar atualizações" em Configurações — força checar agora. */
export async function verificarAtualizacoesAgora(): Promise<boolean> {
  if (!registro) return false;
  await registro.update();
  // Dá um instante pro service worker novo (se houver) terminar de instalar
  // e disparar onNeedRefresh antes de decidir que não há nada novo.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (atualizacaoDisponivel) {
    await aplicarAtualizacao();
    return true;
  }
  return false;
}
