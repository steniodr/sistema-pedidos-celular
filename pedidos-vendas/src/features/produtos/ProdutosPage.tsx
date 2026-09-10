import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { BarraInferior, BotaoCapa, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { IconeBases, IconeBuscar, IconeSomar } from "../../components/ui/icones";
import capaCss from "../../components/ui/redesenho.module.css";
import { formatarMoeda } from "../../domain/calculos";
import { AvisoBase } from "./AvisoBase";
import { avaliarBase, formatarDataHora } from "./statusBase";
import css from "./produtos.module.css";

const ORDENS = ["Nome", "Valor"] as const;
type Ordem = (typeof ORDENS)[number];

/** Teto de linhas renderizadas de uma vez — a base pode ter milhares. */
const LIMITE = 100;

export function ProdutosPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("Nome");
  const buscaDebounced = useDebounce(busca);

  // Pede um a mais que o teto só para saber se ficou algo de fora — antes a
  // lista cortava em 100 em silêncio, e o chip "Valor" ordenava apenas esses
  // 100, mostrando um "mais barato" que podia não ser o mais barato da base.
  const { dados: produtosBrutos } = useDados(
    () => repo.listarProdutos(buscaDebounced, LIMITE + 1),
    [repo, buscaDebounced],
  );
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const { dados: totalBase } = useDados(() => repo.contarProdutos(), [repo]);

  const temMais = (produtosBrutos?.length ?? 0) > LIMITE;

  const produtos = useMemo(() => {
    if (!produtosBrutos) return produtosBrutos;
    const visiveis = produtosBrutos.slice(0, LIMITE);
    if (ordem === "Nome") return visiveis;
    return [...visiveis].sort((a, b) => a.valorUnit - b.valorUnit);
  }, [produtosBrutos, ordem]);

  const status = avaliarBase(importacao);

  return (
    <Tela
      titulo="Base de produtos"
      subtitulo={
        importacao
          ? `${importacao.totalProdutos} produtos · ${formatarDataHora(importacao.quandoEm)}`
          : totalBase !== undefined
            ? `${totalBase} cadastrados`
            : undefined
      }
      voltar="/bases"
      capa
      comBarraInferior
      acao={
        <BotaoCapa rotulo="Importar base" onClick={() => navigate("/produtos/importar")}>
          <IconeBases size={19} />
        </BotaoCapa>
      }
      abaixoDoTitulo={
        <div className={capaCss.capaBusca}>
          <span className={capaCss.capaBuscaIcone}>
            <IconeBuscar size={16} />
          </span>
          <input
            className={capaCss.capaBuscaCampo}
            aria-label="Buscar produto"
            placeholder="Ex.: esmalte galão"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
          />
        </div>
      }
    >
      {/* Só quando a base pede atenção; o "tudo em dia" já está no subtítulo. */}
      {status.nivel !== "ok" && <AvisoBase status={status} />}

      <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />

      {temMais && (
        <p className={css.avisoLimite}>
          Mostrando os primeiros {LIMITE} de {importacao?.totalProdutos ?? totalBase ?? "muitos"}.
          {ordem === "Valor" && " A ordenação por valor vale só para estes."} Refine a busca para
          chegar no produto certo.
        </p>
      )}

      {!produtos ? (
        <Esqueleto linhas={4} />
      ) : produtos.length === 0 ? (
        <EstadoVazio
          titulo={busca ? "Nenhum produto encontrado" : "Base vazia"}
          descricao={
            busca
              ? "Tente outro nome ou embalagem."
              : "Importe a planilha de preços ou cadastre um produto."
          }
        />
      ) : (
        <div className="pilha">
          {produtos.map((produto) => (
            <LinhaLista
              key={produto.id}
              titulo={produto.nome + (produto.detalhes ? ` (${produto.detalhes})` : "")}
              meta={[produto.embalagem, produto.variacao].filter(Boolean).join(" · ")}
              valor={formatarMoeda(produto.valorUnit)}
              onClick={() => navigate(`/produtos/${produto.id}`)}
            />
          ))}
        </div>
      )}

      <BarraInferior>
        <Button bloco onClick={() => navigate("/produtos/novo")}>
          <IconeSomar size={17} />
          Novo produto
        </Button>
      </BarraInferior>
    </Tela>
  );
}
