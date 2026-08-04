import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RepositoryProvider } from "./data/RepositoryContext";
import { ConfirmProvider } from "./components/ui/Confirm";
import { ToastProvider } from "./components/ui/Toast";
import { iniciarServiceWorker } from "./pwa";
import { modeloDisponivel } from "./features/export/excel";
import "./styles/global.css";

iniciarServiceWorker();

// Aquece o cache do molde de Excel assim que o app abre (não só ao chegar em
// Finalizar) — maximiza a chance de já estar disponível offline em campo.
// Ver "Excel saindo no molde padrão sem aviso" em versaoApp.ts/README.
void modeloDisponivel();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RepositoryProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </RepositoryProvider>
    </BrowserRouter>
  </StrictMode>,
);
