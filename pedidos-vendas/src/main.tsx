import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RepositoryProvider } from "./data/RepositoryContext";
import { ConfirmProvider } from "./components/ui/Confirm";
import { ToastProvider } from "./components/ui/Toast";
import { iniciarServiceWorker } from "./pwa";
import "./styles/global.css";

iniciarServiceWorker();

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
