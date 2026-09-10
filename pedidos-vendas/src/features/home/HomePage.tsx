import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Cartao, EstadoVazio, Sheet } from "../../components/ui/Layout";
import { Logo } from "../../components/ui/Logo";
import {
  IconeBases,
  IconeCheckin,
  IconeConfig,
  IconeHistorico,
  IconeNovidades,
  IconeNovoPedido,
  IconeRelatorios,
  IconeSeta,
} from "../../components/ui/icones";
import { StatusPedido } from "../../components/ui/StatusPedido";
import { AvisoBase } from "../produtos/AvisoBase";
import { avaliarBase, formatarData } from "../produtos/statusBase";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { CHANGELOG, VERSAO_APP } from "../../versaoApp";
import css from "./home.module.css";

/** "Bom dia" até 12h, "Boa tarde" até 18h, "Boa noite" depois. */
function saudacaoDaHora(agora = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

function dataPorExtenso(agora = new Date()): string {
  const texto = FMT_DATA.format(agora);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "hoje" / "ontem" / "há N dias" até uma semana; depois, a data cheia. */
function dataRelativa(dataPedido: string): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [ano, mes, dia] = dataPedido.slice(0, 10).split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const dias = Math.round((hoje.getTime() - alvo.getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias <= 7) return `há ${dias} dias`;
  return formatarData(dataPedido);
}

const ATALHOS = [
  { to: "/checkins", rotulo: "Check-in", Icone: IconeCheckin },
  { to: "/bases", rotulo: "Cadastros", Icone: IconeBases },
  { to: "/pedidos", rotulo: "Histórico", Icone: IconeHistorico },
  { to: "/relatorios", rotulo: "Relatórios", Icone: IconeRelatorios },
];

export function HomePage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [novidadesAberto, setNovidadesAberto] = useState(false);

  const { dados } = useDados(
    async () => ({
      importacao: await repo.obterUltimaImportacao(),
      recentes: (await repo.listarPedidos()).slice(0, 5),
      clientes: await repo.listarClientes(),
      representante: await repo.obterRepresentante(),
    }),
    [repo],
  );

  const status = avaliarBase(dados?.importacao);
  const nomeClientePorId = new Map((dados?.clientes ?? []).map((c) => [c.id, c.nome]));
  const primeiroNome = dados?.representante?.nome?.trim().split(/\s+/)[0];

  return (
    <div className="app-shell">
      <header className={css.capa}>
        <div className={css.capaTopo}>
          <div className={css.marca}>
            <Logo size={30} />
            <h1 className={css.wordmark}>Pedidos</h1>
          </div>
          <button
            type="button"
            className={css.iconeBtn}
            onClick={() => navigate("/config")}
            aria-label="Configurações"
          >
            <IconeConfig size={20} />
          </button>
        </div>
        <p className={css.saudacao}>
          {saudacaoDaHora()}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </p>
        <p className={css.data}>{dataPorExtenso()}</p>
      </header>

      <main className={css.conteudo}>
        {status.nivel === "ok" ? (
          <span className={css.baseOk}>
            <span className={css.baseOkPonto} aria-hidden="true" />
            {status.mensagem}
          </span>
        ) : (
          <AvisoBase status={status} sempreVisivel />
        )}

        <Link to="/pedidos/novo" className={css.hero} aria-label="Novo pedido">
          <span className={css.heroIcone}>
            <IconeNovoPedido />
          </span>
          <span className={css.heroTexto}>
            <span className={css.heroTitulo}>Novo pedido</span>
            <span className={css.heroSub}>Pedido ou orçamento</span>
          </span>
          <span className={css.heroSeta} aria-hidden="true">
            <IconeSeta size={20} />
          </span>
        </Link>

        <div className={css.grade}>
          {ATALHOS.map(({ to, rotulo, Icone }) => (
            <Link key={to} to={to} className={css.tile}>
              <span className={css.tileIcone}>
                <Icone size={22} />
              </span>
              <span className={css.tileRotulo}>{rotulo}</span>
            </Link>
          ))}
        </div>

        <div className="linha linha--entre">
          <h2 className="secao-titulo">Pedidos recentes</h2>
          {dados && dados.recentes.length > 0 && (
            <Link to="/pedidos" className={css.verTodos}>
              Ver histórico
            </Link>
          )}
        </div>

        {dados && dados.recentes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido ainda"
            descricao="Toque em “Novo pedido” para abrir o primeiro."
          />
        ) : (
          <div className="pilha">
            {dados?.recentes.map((pedido) => {
              const { total } = totaisPedido(pedido);
              const rotuloId = pedido.somenteOrcamento
                ? `Orçamento ${pedido.codigoOrcamento}`
                : `nº ${pedido.numero}`;
              return (
                <Cartao
                  key={pedido.id}
                  className={css.recenteCartao}
                  onClick={() => navigate(`/pedidos/${pedido.id}`)}
                >
                  <span
                    className={`${css.recenteAcento} ${css[`recenteAcento--${pedido.status}`]}`}
                    aria-hidden="true"
                  />
                  <div className="linha linha--entre">
                    <span className="texto-forte">
                      {nomeClientePorId.get(pedido.clienteId) ?? "Cliente removido"}
                    </span>
                    <span className="texto-forte">{formatarMoeda(total)}</span>
                  </div>
                  <div className="linha linha--entre texto-suave">
                    <span>
                      {rotuloId}
                      {pedido.marca ? ` · ${pedido.marca}` : ""}
                    </span>
                    <span>
                      <StatusPedido
                        status={pedido.status}
                        somenteOrcamento={pedido.somenteOrcamento}
                      />{" "}
                      · {dataRelativa(pedido.dataPedido)}
                    </span>
                  </div>
                </Cartao>
              );
            })}
          </div>
        )}

        <div className={css.rodape}>
          <button
            type="button"
            className={css.novidades}
            onClick={() => setNovidadesAberto(true)}
          >
            <IconeNovidades size={15} />
            Novidades da v{VERSAO_APP}
          </button>
        </div>
      </main>

      <Sheet titulo="Novidades" aberto={novidadesAberto} aoFechar={() => setNovidadesAberto(false)}>
        <div className="pilha">
          {CHANGELOG.map((entrada) => (
            <div key={entrada.versao}>
              <div className="texto-forte">
                v{entrada.versao} · {formatarData(entrada.data)}
              </div>
              <ul className={css.listaNovidades}>
                {entrada.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
