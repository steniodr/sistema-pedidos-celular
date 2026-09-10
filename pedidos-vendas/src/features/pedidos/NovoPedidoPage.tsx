import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { IconeCliente, IconeMarca, IconeSomar } from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import css from "./pedidos.module.css";

/**
 * Passo 1 do pedido: marca (cadastro obrigatório) + cliente.
 * Cliente e cadastro de marca são telas separadas que voltam para cá pela query
 * string (`clienteId` / `marcaId`), então o estado escolhido vive na URL.
 */
export function NovoPedidoPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const clienteId = params.get("clienteId") ?? "";
  const marcaIdParam = params.get("marcaId") ?? "";
  const [marcaId, setMarcaId] = useState(marcaIdParam);
  const [criando, setCriando] = useState(false);

  const { dados: cliente } = useDados(
    async () => (clienteId ? repo.obterCliente(clienteId) : undefined),
    [repo, clienteId],
  );

  // marcaIdParam entra nas deps: ao voltar do cadastro de marca com `?marcaId=`
  // novo, a lista é recarregada e já inclui a marca recém-criada.
  const { dados: contexto } = useDados(
    async () => ({
      numero: await repo.proximoNumeroPedido(),
      marcas: await repo.listarMarcas(),
      ultimoMarcaId: (await repo.listarPedidos())[0]?.marcaId,
    }),
    [repo, marcaIdParam],
  );

  // Sem marca escolhida ainda, herda a do último pedido para poupar toque —
  // só na primeira vez que a lista chega, para não reescrever uma escolha do vendedor.
  const marcaJaInicializada = useRef(false);
  useEffect(() => {
    if (marcaJaInicializada.current || marcaId || !contexto) return;
    const herdada = contexto.marcas.find((m) => m.id === contexto.ultimoMarcaId);
    if (herdada) setMarcaId(herdada.id);
    marcaJaInicializada.current = true;
  }, [contexto, marcaId]);

  const rotaRetorno = `/pedidos/novo?clienteId=${encodeURIComponent(clienteId)}&marcaId=${encodeURIComponent(marcaId)}`;

  function irParaSelecaoCliente() {
    navigate(`/clientes?selecionar=1&retorno=${encodeURIComponent(rotaRetorno)}`);
  }

  async function criar() {
    if (!clienteId || !marcaId) return;
    const marca = contexto?.marcas.find((m) => m.id === marcaId);
    if (!marca) return;
    setCriando(true);
    try {
      const pedido = await repo.criarPedido({ clienteId, marca: marca.nome, marcaId: marca.id });
      navigate(`/pedidos/${pedido.id}`, { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível criar o pedido."));
      setCriando(false);
    }
  }

  const semMarcas = contexto && contexto.marcas.length === 0;

  return (
    <Tela
      titulo="Novo pedido"
      subtitulo={`Pedido nº ${contexto?.numero ?? "…"}`}
      voltar="/"
      capa
      comBarraInferior
    >
      <Painel titulo="Marca" icone={<IconeMarca size={17} />}>
        {semMarcas ? (
          <p className="texto-suave">
            Nenhuma marca cadastrada ainda. Cadastre a primeira para começar o pedido.
          </p>
        ) : (
          <Select
            rotulo="Marca"
            obrigatorio
            value={marcaId}
            onChange={(e) => setMarcaId(e.target.value)}
            ajuda="Aparece no cabeçalho da planilha."
          >
            <option value="">Selecione a marca</option>
            {contexto?.marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        )}
        <Button
          variante="fantasma"
          className={css.linkCampo}
          onClick={() => navigate(`/marcas/nova?retorno=${encodeURIComponent(rotaRetorno)}`)}
        >
          <IconeSomar size={14} />
          Cadastrar nova marca
        </Button>
      </Painel>

      <Painel titulo="Cliente" icone={<IconeCliente size={17} />}>
        {cliente ? (
          <LinhaLista
            icone={<IconeCliente size={17} />}
            titulo={cliente.nome}
            meta={`${mascararCpfCnpj(cliente.cpfCnpj)}${
              cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""
            }`}
            onClick={irParaSelecaoCliente}
          />
        ) : (
          <Button variante="secundario" bloco onClick={irParaSelecaoCliente}>
            Escolher cliente
          </Button>
        )}
      </Painel>

      <BarraInferior>
        <Button bloco onClick={criar} disabled={!clienteId || !marcaId || criando}>
          {criando ? "Criando…" : "Iniciar pedido"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
