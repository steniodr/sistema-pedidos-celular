import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button, LinkButton } from "../../components/ui/Button";
import { Cartao, EstadoVazio } from "../../components/ui/Layout";
import { StatusPedido } from "../../components/ui/StatusPedido";
import { AvisoBase } from "../produtos/AvisoBase";
import { avaliarBase, formatarData } from "../produtos/statusBase";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import css from "./home.module.css";

export function HomePage() {
  const repo = useRepository();
  const navigate = useNavigate();

  const { dados } = useDados(
    async () => ({
      importacao: await repo.obterUltimaImportacao(),
      totalProdutos: await repo.contarProdutos(),
      recentes: (await repo.listarPedidos()).slice(0, 5),
      clientes: await repo.listarClientes(),
    }),
    [repo],
  );

  const status = avaliarBase(dados?.importacao);
  const nomeClientePorId = new Map((dados?.clientes ?? []).map((c) => [c.id, c.nome]));

  return (
    <div className="app-shell">
      <header className={css.cabecalho}>
        <h1>Pedidos</h1>
        <Button
          variante="fantasma"
          className={css.botaoConfig}
          onClick={() => navigate("/config")}
          aria-label="Configurações"
        >
          ⚙
        </Button>
      </header>

      <main className="app-conteudo">
        <AvisoBase status={status} sempreVisivel />

        <LinkButton to="/pedidos/novo" grande bloco>
          Novo pedido
        </LinkButton>

        <div className={css.atalhos}>
          <LinkButton to="/clientes" variante="secundario">
            Clientes ({dados?.clientes.length ?? 0})
          </LinkButton>
          <LinkButton to="/produtos" variante="secundario">
            Produtos ({dados?.totalProdutos ?? 0})
          </LinkButton>
          <LinkButton to="/pedidos" variante="secundario" className={css.atalhoHistorico}>
            Histórico
          </LinkButton>
        </div>

        <h2 className="secao-titulo">Pedidos recentes</h2>
        {dados && dados.recentes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido ainda"
            descricao="Toque em “Novo pedido” para começar."
          />
        ) : (
          <div className="pilha">
            {dados?.recentes.map((pedido) => {
              const { total } = totaisPedido(pedido);
              return (
                <Cartao key={pedido.id} onClick={() => navigate(`/pedidos/${pedido.id}`)}>
                  <div className="linha linha--entre">
                    <span className="texto-forte">Pedido nº {pedido.numero}</span>
                    <span className="texto-forte">{formatarMoeda(total)}</span>
                  </div>
                  <div className="linha linha--entre texto-suave">
                    <span>
                      {nomeClientePorId.get(pedido.clienteId) ?? "Cliente removido"} ·{" "}
                      {pedido.marca || "Sem marca"}
                    </span>
                    <span>
                      <StatusPedido status={pedido.status} /> · {formatarData(pedido.dataPedido)}
                    </span>
                  </div>
                </Cartao>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
