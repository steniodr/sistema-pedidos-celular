import { useEffect, useState } from "react";

/** Só atualiza o valor devolvido depois de `atrasoMs` sem mudanças — usado em buscas. */
export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), atrasoMs);
    return () => clearTimeout(id);
  }, [valor, atrasoMs]);

  return debounced;
}
