import { useMemo, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { Select } from "../../components/ui/Field";
import { formatarMoeda } from "../../domain/calculos";
import {
  filtrarPedidos,
  intervaloPeriodo,
  produtosMaisVendidos,
  resumoVendas,
  type OrdemValor,
  type Periodo,
} from "../../domain/relatorios";
import css from "./relatorios.module.css";

const PERIODOS = ["semana", "mes", "tudo"] as const satisfies readonly Periodo[];
const ROTULOS_PERIODO: Record<Periodo, string> = {
  semana: "Semana",
  mes: "Mês",
  tudo: "Tudo",
};
const TODAS_MARCAS = "Todas";
const TODOS_CLIENTES = "";

const ORDENS_VALOR = ["Maior valor", "Menor valor"] as const;
type RotuloOrdem = (typeof ORDENS_VALOR)[number];
const ORDEM_POR_ROTULO: Record<RotuloOrdem, OrdemValor> = {
  "Maior valor": "desc",
  "Menor valor": "asc",
};

export function RelatoriosPage() {
  const repo = useRepository();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [marcaFiltro, setMarcaFiltro] = useState(TODAS_MARCAS);
  const [clienteFiltro, setClienteFiltro] = useState(TODOS_CLIENTES);
  const [rotuloOrdem, setRotuloOrdem] = useState<RotuloOrdem>("Maior valor");

  const { dados: contexto } = useDados(async () => {
    const [enviados, clientes] = await Promise.all([
      repo.listarPedidos({ status: "enviado" }),
      repo.listarClientes(),
    ]);
    const nomePorClienteId = new Map(clientes.map((c) => [c.id, c.nome]));
    const marcas = [...new Set(enviados.map((p) => p.marca).filter(Boolean))];
    const clientesComPedido = [...new Set(enviados.map((p) => p.clienteId))]
      .map((id) => ({ id, nome: nomePorClienteId.get(id) ?? "Cliente removido" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { enviados, marcas, clientesComPedido };
  }, [repo]);

  const { inicio, fim } = intervaloPeriodo(periodo);

  const filtrados = useMemo(() => {
    if (!contexto) return [];
    return filtrarPedidos(contexto.enviados, {
      inicio,
      fim,
      marca: marcaFiltro === TODAS_MARCAS ? undefined : marcaFiltro,
      clienteId: clienteFiltro || undefined,
    });
  }, [contexto, inicio, fim, marcaFiltro, clienteFiltro]);

  const resumo = resumoVendas(filtrados);
  const maisVendidos = produtosMaisVendidos(filtrados, 10, ORDEM_POR_ROTULO[rotuloOrdem]);
  const maiorValor = Math.max(0, ...maisVendidos.map((p) => p.valorTotal));

  const opcoesMarca = [TODAS_MARCAS, ...(contexto?.marcas ?? [])];

  return (
    <Tela titulo="Relatórios" voltar="/">
      <p className={css.aviso}>
        Mostra só os pedidos enviados neste aparelho — ainda não há
        sincronização entre vendedores.
      </p>

      <Chips
        opcoes={PERIODOS}
        valor={periodo}
        onChange={setPeriodo}
        rotulos={ROTULOS_PERIODO}
      />

      {opcoesMarca.length > 1 && (
        <Chips opcoes={opcoesMarca} valor={marcaFiltro} onChange={setMarcaFiltro} />
      )}

      {contexto && contexto.clientesComPedido.length > 1 && (
        <Select
          rotulo="Cliente"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        >
          <option value={TODOS_CLIENTES}>Todos os clientes</option>
          {contexto.clientesComPedido.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      )}

      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido enviado neste filtro" />
      ) : (
        <>
          <Cartao>
            <div className={css.stats}>
              <div className={css.statItem}>
                <span className={css.statValor}>{formatarMoeda(resumo.totalVendido)}</span>
                <span className="texto-suave">Total vendido</span>
              </div>
              <div className={css.statItem}>
                <span className={css.statValor}>{resumo.numeroPedidos}</span>
                <span className="texto-suave">Pedidos</span>
              </div>
              <div className={css.statItem}>
                <span className={css.statValor}>{formatarMoeda(resumo.ticketMedio)}</span>
                <span className="texto-suave">Ticket médio</span>
              </div>
            </div>
          </Cartao>

          <div className="linha linha--entre">
            <h2 className="secao-titulo">Produtos mais vendidos</h2>
            <Chips opcoes={ORDENS_VALOR} valor={rotuloOrdem} onChange={setRotuloOrdem} />
          </div>
          <Cartao>
            {maisVendidos.map((p) => (
              <div key={p.nome} className={css.barraLinha}>
                <div className={css.barraRotulo}>
                  <span>{p.nome}</span>
                  <span className="texto-suave">{formatarMoeda(p.valorTotal)}</span>
                </div>
                <div className={css.barraTrilha}>
                  <div
                    className={css.barraPreenchida}
                    style={{ width: `${maiorValor > 0 ? (p.valorTotal / maiorValor) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </Cartao>
        </>
      )}
    </Tela>
  );
}
