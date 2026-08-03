import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Escuta em todas as interfaces (não só localhost), para abrir pelo IP do PC
  // no celular durante o teste em campo — sem depender de passar --host toda vez.
  server: { host: true },
  preview: { host: true },
  build: {
    // exceljs/xlsx/jspdf (import/export) já são carregados sob demanda via
    // import() dinâmico — o aviso de chunk grande é sobre o tamanho deles,
    // não sobre bloquear o carregamento inicial do app.
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" em vez de "autoUpdate": o app instalado na tela inicial fica
      // muito tempo aberto sem navegar de verdade, então a atualização
      // silenciosa nem sempre chega a ser aplicada. Com "prompt" o app checa
      // periodicamente (ver src/pwa.ts) e mostra um aviso com "Atualizar
      // agora" — e Configurações ganha um botão pra forçar a checagem.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "Pedidos de Venda",
        short_name: "Pedidos",
        description: "Aplicativo de pedidos para vendedores em campo",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#1d4ed8",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // O app é 100% client-side: basta precachear o bundle do próprio app.
        // O molde .xlsx FICA FORA do precache de propósito (ver runtimeCaching
        // abaixo) — precache é fixado na build e só atualiza depois de um ciclo
        // completo de troca de service worker (normalmente 2 reloads), o que
        // fazia o app continuar servindo uma versão antiga do molde sempre que
        // o arquivo era trocado sem rebuildar/reinstalar o app.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /\/templates\/.*\.xlsx$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "modelo-pedido",
              // Sempre tenta a rede primeiro (pega a versão mais nova do molde);
              // só usa a cópia em cache quando estiver genuinamente offline.
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
    }),
  ],
});
