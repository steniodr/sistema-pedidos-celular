import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RepositoryProvider } from "./data/RepositoryContext";
import { ToastProvider } from "./components/ui/Toast";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RepositoryProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </RepositoryProvider>
    </BrowserRouter>
  </StrictMode>,
);
