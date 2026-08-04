import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";

/**
 * Passo 1 do pedido: marca (texto livre do cabeçalho) + cliente.
 * O cliente é escolhido em /clientes?selecionar=1, que volta para cá pela query string.
 */
export function NovoPedidoPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const clienteId = params.get("clienteId") ?? "";
  const [marca, setMarca] = useState(params.get("marca") ?? "");
  const [criando, setCriando] = useState(false);

  const { dados: cliente } = useDados(
    async () => (clienteId ? repo.obterCliente(clienteId) : undefined),
    [repo, clienteId],
  );

  const { dados: contexto } = useDados(
    async () => ({
      numero: await repo.proximoNumeroPedido(),
      marcas: [
        ...new Set((await repo.listarPedidos()).map((p) => p.marca).filter(Boolean)),
      ],
    }),
    [repo],
  );

  // Sem marca digitada ainda, herda a do último pedido para poupar digitação —
  // só na primeira vez que a lista chega, para não reescrever se o vendedor apagar
  // o campo de propósito.
  const marcaJaInicializada = useRef(false);
  useEffect(() => {
    if (marcaJaInicializada.current) return;
    if (marca) {
      marcaJaInicializada.current = true;
      return;
    }
    if (contexto?.marcas.length) {
      setMarca(contexto.marcas[0]);
      marcaJaInicializada.current = true;
    }
  }, [contexto, marca]);

  async function criar() {
    if (!clienteId) return;
    setCriando(true);
    try {
      const pedido = await repo.criarPedido({ clienteId, marca: marca.trim() });
      navigate(`/pedidos/${pedido.id}`, { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível criar o pedido."));
      setCriando(false);
    }
  }

  return (
    <Tela titulo="Novo pedido" voltar="/" comBarraInferior>
      <p className="texto-suave">Pedido nº {contexto?.numero ?? "…"}</p>

      <Input
        rotulo="Marca"
        placeholder="Ex.: MERKO, ARARA AZUL"
        value={marca}
        sugestoes={contexto?.marcas}
        onChange={(e) => setMarca(e.target.value)}
        ajuda="Aparece no cabeçalho da planilha."
      />

      <h2 className="secao-titulo">Cliente</h2>
      {cliente ? (
        <Cartao
          onClick={() =>
            navigate(
              `/clientes?selecionar=1&retorno=${encodeURIComponent(`/pedidos/novo?marca=${encodeURIComponent(marca)}`)}`,
            )
          }
        >
          <div className="texto-forte">{cliente.nome}</div>
          <div className="texto-suave">
            {mascararCpfCnpj(cliente.cpfCnpj)}
            {cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""}
          </div>
          <div className="texto-suave">Toque para trocar de cliente</div>
        </Cartao>
      ) : (
        <Button
          variante="secundario"
          bloco
          onClick={() =>
            navigate(
              `/clientes?selecionar=1&retorno=${encodeURIComponent(`/pedidos/novo?marca=${encodeURIComponent(marca)}`)}`,
            )
          }
        >
          Escolher cliente
        </Button>
      )}

      <BarraInferior>
        <Button bloco onClick={criar} disabled={!clienteId || criando}>
          {criando ? "Criando…" : "Iniciar pedido"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
