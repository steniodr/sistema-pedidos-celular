import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Layout";

interface OpcoesConfirmacao {
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Usa o botão "perigo" para ações destrutivas (excluir, substituir dados). */
  perigo?: boolean;
}

type ConfirmarFn = (opcoes: OpcoesConfirmacao) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmarFn | null>(null);

interface PendingConfirmacao extends OpcoesConfirmacao {
  resolver: (valor: boolean) => void;
}

/**
 * Substitui `window.confirm()` (popup nativo, fora do design system) por um
 * diálogo dentro do `Sheet` já usado no resto do app. `confirmar()` funciona
 * como o `window.confirm` original — resolve `true`/`false` — mas com o
 * mesmo visual de qualquer outra tela.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<PendingConfirmacao | null>(null);
  const resolverAtual = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback<ConfirmarFn>((opcoes) => {
    return new Promise<boolean>((resolve) => {
      resolverAtual.current = resolve;
      setPendente({ ...opcoes, resolver: resolve });
    });
  }, []);

  function responder(valor: boolean) {
    resolverAtual.current?.(valor);
    resolverAtual.current = null;
    setPendente(null);
  }

  const api = useMemo(() => confirmar, [confirmar]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Sheet titulo="Confirmar" aberto={pendente !== null} aoFechar={() => responder(false)}>
        {pendente && (
          <>
            <p>{pendente.mensagem}</p>
            <div className="pilha pilha--apertada">
              <Button
                variante={pendente.perigo ? "perigo" : "primario"}
                bloco
                onClick={() => responder(true)}
              >
                {pendente.textoConfirmar ?? "Confirmar"}
              </Button>
              <Button variante="secundario" bloco onClick={() => responder(false)}>
                {pendente.textoCancelar ?? "Cancelar"}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmarFn {
  const contexto = useContext(ConfirmContext);
  if (!contexto) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>");
  return contexto;
}
