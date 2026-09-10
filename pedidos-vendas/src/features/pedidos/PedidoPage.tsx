import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Select } from "../../components/ui/Field";
import {
  BarraInferior,
  BotaoCapa,
  EstadoVazio,
  Sheet,
  Tela,
} from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { Etiqueta } from "../../components/ui/Etiqueta";
import {
  IconeCliente,
  IconeExcluir,
  IconeMaisAcoes,
  IconeProduto,
  IconeSeta,
  IconeSomar,
} from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido, totalItem } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

export function PedidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const repo = useRepository();
  const toast = useToast();
  const confirmar = useConfirm();
  const { pedido, cliente, carregando, atualizar } = usePedido(id);
  const [excluindo, setExcluindo] = useState(false);
  const [editandoCabecalho, setEditandoCabecalho] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const marcaIdParam = params.get("marcaId") ?? "";
  // marcaIdParam nas deps: ao voltar do cadastro de marca, a lista recarrega já com a nova.
  const { dados: marcas } = useDados(() => repo.listarMarcas(), [repo, marcaIdParam]);

  // Volta de /clientes?selecionar=1&retorno=/pedidos/:id com ?clienteId= na
  // URL — troca o cliente do pedido e limpa a query string.
  const trocaClienteProcessada = useRef(false);
  useEffect(() => {
    if (trocaClienteProcessada.current) return;
    const novoClienteId = params.get("clienteId");
    if (!novoClienteId || !pedido) return;
    trocaClienteProcessada.current = true;
    navigate(`/pedidos/${pedido.id}`, { replace: true });
    if (novoClienteId !== pedido.clienteId) {
      void atualizar({ clienteId: novoClienteId });
    }
  }, [params, pedido, atualizar, navigate]);

  // Volta de /marcas/nova?retorno=/pedidos/:id com ?marcaId= na URL — aplica a
  // marca recém-cadastrada ao pedido e limpa a query string.
  const trocaMarcaProcessada = useRef(false);
  useEffect(() => {
    if (trocaMarcaProcessada.current) return;
    if (!marcaIdParam || !pedido || !marcas) return;
    const nova = marcas.find((m) => m.id === marcaIdParam);
    if (!nova) return;
    trocaMarcaProcessada.current = true;
    navigate(`/pedidos/${pedido.id}`, { replace: true });
    if (nova.id !== pedido.marcaId) {
      void atualizar({ marca: nova.nome, marcaId: nova.id });
    }
  }, [marcaIdParam, pedido, marcas, atualizar, navigate]);

  if (carregando) {
    return (
      <Tela titulo="Pedido" voltar="/">
        <p className="texto-suave">Carregando…</p>
      </Tela>
    );
  }
  if (!pedido) {
    return (
      <Tela titulo="Pedido" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  const { total } = totaisPedido(pedido);
  const identificador = pedido.somenteOrcamento
    ? `Orçamento ${pedido.codigoOrcamento}`
    : `Pedido nº ${pedido.numero}`;

  async function excluirPedido() {
    if (!pedido) return;
    const rotulo = pedido.somenteOrcamento
      ? `orçamento ${pedido.codigoOrcamento}`
      : `pedido nº ${pedido.numero}`;
    const ok = await confirmar({
      mensagem: `Excluir o ${rotulo}? Esta ação não pode ser desfeita.`,
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setExcluindo(true);
    try {
      await repo.removerPedido(pedido.id);
      const pedidoApagado = pedido;
      toast.acao("Pedido excluído.", "Desfazer", () => {
        void repo.restaurarPedido(pedidoApagado);
      });
      navigate("/pedidos", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir o pedido."));
      setExcluindo(false);
    }
  }

  return (
    <Tela
      titulo={identificador}
      subtitulo={[cliente?.nome ?? "Cliente removido", pedido.marca || "Sem marca"].join(" · ")}
      voltar="/"
      capa
      comBarraInferior
      acao={
        <BotaoCapa rotulo="Mais ações do pedido" onClick={() => setMenuAberto(true)}>
          <IconeMaisAcoes size={19} />
        </BotaoCapa>
      }
    >
      {editandoCabecalho ? (
        <Painel titulo="Cliente e marca" icone={<IconeCliente size={17} />}>
          <Select
            rotulo="Marca"
            value={pedido.marcaId ?? ""}
            onChange={(e) => {
              const marca = marcas?.find((m) => m.id === e.target.value);
              if (marca) void atualizar({ marca: marca.nome, marcaId: marca.id });
            }}
          >
            {!pedido.marcaId && <option value="">{pedido.marca || "Selecione a marca"}</option>}
            {marcas?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
          <Button
            variante="fantasma"
            onClick={() =>
              navigate(`/marcas/nova?retorno=${encodeURIComponent(`/pedidos/${pedido.id}`)}`)
            }
          >
            + Cadastrar nova marca
          </Button>
          <div className="texto-suave">{cliente?.nome ?? "Cliente removido"}</div>
          <div className="linha linha--entre">
            <Button
              variante="secundario"
              onClick={() =>
                navigate(
                  `/clientes?selecionar=1&retorno=${encodeURIComponent(`/pedidos/${pedido.id}`)}`,
                )
              }
            >
              Trocar cliente
            </Button>
            <Button variante="fantasma" onClick={() => setEditandoCabecalho(false)}>
              Concluir
            </Button>
          </div>
        </Painel>
      ) : (
        <Painel>
          <LinhaLista
            icone={<IconeCliente size={17} />}
            titulo={cliente?.nome ?? "Cliente removido"}
            meta={pedido.marca || "Sem marca"}
            onClick={() => setEditandoCabecalho(true)}
          />
        </Painel>
      )}

      <Painel
        titulo={`Itens (${pedido.itens.length})`}
        icone={<IconeProduto size={17} />}
        acao={
          <Button
            variante="fantasma"
            className={css.acaoPainel}
            aria-label="Adicionar item"
            onClick={() => navigate(`/pedidos/${pedido.id}/item/novo`)}
          >
            <IconeSomar size={15} />
            Adicionar
          </Button>
        }
      >
        {pedido.itens.length === 0 ? (
          <EstadoVazio titulo="Nenhum item" descricao="Adicione o primeiro produto do pedido." />
        ) : (
          <div className="pilha pilha--apertada">
            {pedido.itens.map((item, indice) => (
              <LinhaLista
                key={indice}
                acento={item.comDesconto ? "alerta" : "info"}
                titulo={
                  <>
                    {item.descricaoProduto}
                    {item.comDesconto && <Etiqueta variante="alerta">Promo</Etiqueta>}
                  </>
                }
                meta={[
                  `${item.qtd} × ${formatarMoeda(item.valorUnit)}`,
                  item.embalagem,
                  item.cor,
                  item.padraoComplemento,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                valor={formatarMoeda(totalItem(item))}
                onClick={() => navigate(`/pedidos/${pedido.id}/item/${indice}`)}
              />
            ))}
          </div>
        )}
      </Painel>

      <BarraInferior>
        <div className={css.totalBarra}>
          <span className="texto-suave">
            Total{pedido.itens.length > 0 ? ` · ${pedido.itens.length} itens` : ""}
          </span>
          <span className={css.totalValor}>{formatarMoeda(total)}</span>
        </div>
        <Button
          onClick={() => navigate(`/pedidos/${pedido.id}/resumo`)}
          disabled={pedido.itens.length === 0}
        >
          Resumo
          <IconeSeta size={17} />
        </Button>
      </BarraInferior>

      <Sheet titulo="Ações do pedido" aberto={menuAberto} aoFechar={() => setMenuAberto(false)}>
        <Button
          variante="secundario"
          bloco
          onClick={() => {
            setMenuAberto(false);
            setEditandoCabecalho(true);
          }}
        >
          Editar cliente ou marca
        </Button>
        {pedido.itens.length > 0 && (
          <Button
            variante="secundario"
            bloco
            onClick={() => {
              setMenuAberto(false);
              navigate(`/pedidos/${pedido.id}/finalizar`);
            }}
          >
            Finalizar pedido
          </Button>
        )}
        <Button
          variante="perigo"
          bloco
          onClick={() => {
            setMenuAberto(false);
            void excluirPedido();
          }}
          disabled={excluindo}
        >
          <IconeExcluir size={17} />
          {excluindo ? "Excluindo…" : "Excluir pedido"}
        </Button>
      </Sheet>
    </Tela>
  );
}
