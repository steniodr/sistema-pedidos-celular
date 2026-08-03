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

interface ToastAcao {
  rotulo: string;
  aoClicar: () => void;
}

interface ToastItem {
  id: number;
  mensagem: string;
  tipo: TipoToast;
  acao?: ToastAcao;
}

interface ToastAPI {
  info: (mensagem: string) => void;
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
  /** Toast com botão de ação (ex.: "Desfazer") — some sozinho se não for clicado. */
  acao: (mensagem: string, rotuloAcao: string, aoClicar: () => void) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

const DURACAO_PADRAO_MS = 3500;
const DURACAO_ACAO_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const proximoId = useRef(1);

  const remover = useCallback((id: number) => {
    setItens((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensagem: string, tipo: TipoToast, acaoBase?: ToastAcao) => {
      const id = proximoId.current++;
      const acao = acaoBase
        ? {
            rotulo: acaoBase.rotulo,
            aoClicar: () => {
              acaoBase.aoClicar();
              remover(id);
            },
          }
        : undefined;
      setItens((atuais) => [...atuais, { id, mensagem, tipo, acao }]);
      setTimeout(() => remover(id), acao ? DURACAO_ACAO_MS : DURACAO_PADRAO_MS);
    },
    [remover],
  );

  const api = useMemo<ToastAPI>(
    () => ({
      info: (m) => mostrar(m, "info"),
      sucesso: (m) => mostrar(m, "sucesso"),
      erro: (m) => mostrar(m, "erro"),
      acao: (m, rotuloAcao, aoClicar) => mostrar(m, "info", { rotulo: rotuloAcao, aoClicar }),
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
            <span>{t.mensagem}</span>
            {t.acao && (
              <button type="button" className={css.toastAcao} onClick={t.acao.aoClicar}>
                {t.acao.rotulo}
              </button>
            )}
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
