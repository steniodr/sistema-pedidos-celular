import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button, LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { formatarMoeda } from "../../domain/calculos";
import { AvisoBase } from "./AvisoBase";
import { avaliarBase, formatarDataHora } from "./statusBase";
import css from "./produtos.module.css";

const ORDENS = ["Nome", "Valor"] as const;
type Ordem = (typeof ORDENS)[number];

export function ProdutosPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("Nome");
  const buscaDebounced = useDebounce(busca);

  const { dados: produtosBrutos } = useDados(
    () => repo.listarProdutos(buscaDebounced, 100),
    [repo, buscaDebounced],
  );
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);

  const produtos = useMemo(() => {
    if (!produtosBrutos) return produtosBrutos;
    if (ordem === "Nome") return produtosBrutos;
    return [...produtosBrutos].sort((a, b) => a.valorUnit - b.valorUnit);
  }, [produtosBrutos, ordem]);

  const status = avaliarBase(importacao);

  return (
    <Tela titulo="Base de produtos" voltar="/" comBarraInferior>
      <AvisoBase status={status} sempreVisivel />
      {importacao && (
        <p className="texto-suave">
          {importacao.totalProdutos} produtos · arquivo “{importacao.arquivo}” ·{" "}
          {formatarDataHora(importacao.quandoEm)}
        </p>
      )}

      <Input
        rotulo="Buscar produto"
        placeholder="Ex.: esmalte galão"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      {produtos && produtos.length > 1 && <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />}

      {produtos?.length === 0 ? (
        <EstadoVazio
          titulo={busca ? "Nenhum produto encontrado" : "Base vazia"}
          descricao="Importe a planilha de preços ou cadastre um produto."
        />
      ) : (
        <div className="pilha">
          {produtos?.map((produto) => (
            <Cartao key={produto.id}>
              <div className={css.listaProduto}>
                <div className={css.listaProdutoInfo}>
                  <div>
                    {produto.nome}
                    {produto.detalhes ? ` (${produto.detalhes})` : ""}
                  </div>
                  <div className="texto-suave">{produto.embalagem}</div>
                </div>
                <span className="texto-forte">{formatarMoeda(produto.valorUnit)}</span>
                <Button
                  variante="fantasma"
                  className={css.botaoEditarProduto}
                  aria-label={`Editar ${produto.nome}`}
                  onClick={() => navigate(`/produtos/${produto.id}`)}
                >
                  ✎
                </Button>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <BarraInferior>
        <div className={css.botoesRodape}>
          <LinkButton to="/produtos/novo" variante="secundario" bloco>
            Novo produto
          </LinkButton>
          <LinkButton to="/produtos/importar" bloco>
            Importar base
          </LinkButton>
        </div>
      </BarraInferior>
    </Tela>
  );
}
