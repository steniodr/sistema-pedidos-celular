import { createContext, useContext, type ReactNode } from "react";
import { dexieRepository } from "./dexieRepository";
import type { Repository } from "./repository";

const RepositoryContext = createContext<Repository>(dexieRepository);

/**
 * Injeta a implementação do repositório na árvore. Hoje é sempre o Dexie;
 * quando a sincronização entrar, basta trocar o valor aqui.
 */
export function RepositoryProvider({
  children,
  repository = dexieRepository,
}: {
  children: ReactNode;
  repository?: Repository;
}) {
  return (
    <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
  );
}

export function useRepository(): Repository {
  return useContext(RepositoryContext);
}
