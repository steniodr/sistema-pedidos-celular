import { useCallback, useEffect, useState } from "react";

interface EstadoDados<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: Error | undefined;
  recarregar: () => void;
}

/**
 * Executa uma consulta assíncrona ao repositório e devolve o resultado.
 * `recarregar()` refaz a consulta depois de uma gravação.
 */
export function useDados<T>(consulta: () => Promise<T>, deps: unknown[]): EstadoDados<T> {
  const [dados, setDados] = useState<T | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<Error | undefined>(undefined);
  const [versao, setVersao] = useState(0);

  // A consulta é recriada a cada render; as dependências declaradas pelo chamador
  // é que definem quando refazer a busca.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(consulta, deps);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    executar()
      .then((resultado) => {
        if (cancelado) return;
        setDados(resultado);
        setErro(undefined);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErro(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [executar, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { dados, carregando, erro, recarregar };
}
