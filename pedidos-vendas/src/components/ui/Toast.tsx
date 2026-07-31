import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import css from "./ui.module.css";

type TipoToast = "info" | "sucesso" | "erro";

interface ToastItem {
  id: number;
  mensagem: string;
  tipo: TipoToast;
}

interface ToastAPI {
  info: (mensagem: string) => void;
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const proximoId = useRef(1);

  const mostrar = useCallback((mensagem: string, tipo: TipoToast) => {
    const id = proximoId.current++;
    setItens((atuais) => [...atuais, { id, mensagem, tipo }]);
    setTimeout(() => {
      setItens((atuais) => atuais.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const api = useMemo<ToastAPI>(
    () => ({
      info: (m) => mostrar(m, "info"),
      sucesso: (m) => mostrar(m, "sucesso"),
      erro: (m) => mostrar(m, "erro"),
    }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={css.toasts} role="status" aria-live="polite">
        {itens.map((t) => (
          <div
            key={t.id}
            className={`${css.toast} ${t.tipo !== "info" ? css[`toast--${t.tipo}`] : ""}`}
          >
            {t.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return contexto;
}
