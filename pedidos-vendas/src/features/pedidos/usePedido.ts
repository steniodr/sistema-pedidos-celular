import { useCallback, useEffect, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import type { Cliente, Pedido } from "../../domain/types";

/**
 * Carrega o pedido e o cliente e grava toda alteração imediatamente no IndexedDB
 * (o app pode ser fechado a qualquer momento, sem botão de salvar rascunho).
 */
export function usePedido(id: string | undefined) {
  const repo = useRepository();
  const [pedido, setPedido] = useState<Pedido | undefined>();
  const [cliente, setCliente] = useState<Cliente | undefined>();
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    (async () => {
      const encontrado = id ? await repo.obterPedido(id) : undefined;
      const dono = encontrado ? await repo.obterCliente(encontrado.clienteId) : undefined;
      if (cancelado) return;
      setPedido(encontrado);
      setCliente(dono);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [repo, id]);

  const atualizar = useCallback(
    async (mudancas: Partial<Pedido>) => {
      if (!pedido) return;
      const atualizado = { ...pedido, ...mudancas };
      setPedido(atualizado);
      // Trocou de cliente (ex.: "Trocar cliente" na tela do pedido) — recarrega
      // `cliente` junto, na mesma chamada, pra não deixar o nome antigo exibido
      // até o próximo efeito.
      if (mudancas.clienteId && mudancas.clienteId !== pedido.clienteId) {
        setCliente(await repo.obterCliente(mudancas.clienteId));
      }
      await repo.salvarPedido(atualizado);
    },
    [pedido, repo],
  );

  return { pedido, cliente, carregando, atualizar };
}
