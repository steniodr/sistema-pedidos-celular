import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Fora do `include` do tsconfig de propósito: o Vitest embute a própria cópia do
// Vite, e os dois conjuntos de tipos de plugin conflitam na checagem do projeto.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "virtual:pwa-register" só existe com o plugin VitePWA rodando de
      // verdade (build/dev) — nos testes, cai num stub sem efeito nenhum.
      "virtual:pwa-register": fileURLToPath(
        new URL("./src/test/pwaRegisterStub.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Só os testes de tela precisam de DOM; os de domínio rodam em node, que é mais rápido.
    projects: [
      {
        extends: true,
        test: { name: "dominio", environment: "node", include: ["src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "telas", environment: "jsdom", include: ["src/**/*.dom.test.tsx"] },
      },
    ],
  },
});
