import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda } from "../../domain/calculos";
import { lerArquivoPlanilha } from "./lerArquivo";
import {
  converter,
  detectarColunasMatriz,
  type CampoLista,
  type ColunasMatriz,
  type MapeamentoLista,
  type PlanilhaLida,
} from "./importarPlanilha";
import css from "./produtos.module.css";

const ROTULOS_LISTA: Record<CampoLista, string> = {
  descricaoProduto: "Descrição do produto",
  embalagem: "Embalagem",
  valorUnit: "Valor unitário",
};

export function ImportarProdutosPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [nomeArquivo, setNomeArquivo] = useState("");
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [mapeamentoLista, setMapeamentoLista] = useState<MapeamentoLista | null>(null);
  const [colunasMatriz, setColunasMatriz] = useState<ColunasMatriz | null>(null);
  const [lendo, setLendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const resultado = useMemo(() => {
    if (!planilha) return null;
    if (planilha.formato === "lista" && mapeamentoLista) return converter(planilha, mapeamentoLista);
    if (planilha.formato === "matriz" && colunasMatriz) return converter(planilha, colunasMatriz);
    return null;
  }, [planilha, mapeamentoLista, colunasMatriz]);

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendo(true);
    try {
      const lida = await lerArquivoPlanilha(arquivo);
      setPlanilha(lida);
      setMapeamentoLista(lida.mapeamentoLista);
      setColunasMatriz(lida.colunasMatriz);
      setNomeArquivo(arquivo.name);
      if (lida.linhaCabecalho === -1) {
        toast.info("Não identifiquei o cabeçalho. Confira as colunas abaixo.");
      }
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
      setPlanilha(null);
      setMapeamentoLista(null);
      setColunasMatriz(null);
    } finally {
      setLendo(false);
    }
  }

  function ajustarColunaMatriz(campo: "categoria" | "produto" | "detalhes", valor: string) {
    if (!planilha) return;
    const indice = valor === "" ? null : Number(valor);
    const fixas = {
      categoria: colunasMatriz?.categoria ?? null,
      produto: colunasMatriz?.produto ?? null,
      detalhes: colunasMatriz?.detalhes ?? null,
      [campo]: indice,
    };
    setColunasMatriz(detectarColunasMatriz(planilha.cabecalho, fixas));
  }

  async function confirmar() {
    if (!resultado || resultado.produtos.length === 0) return;
    setConfirmando(true);
    try {
      const info = await repo.substituirBaseProdutos(resultado.produtos, nomeArquivo);
      toast.sucesso(`${info.totalProdutos} combinações de produto importadas.`);
      navigate("/produtos", { replace: true });
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Falha ao gravar a base.");
    } finally {
      setConfirmando(false);
    }
  }

  const colunas = planilha?.cabecalho ?? [];
  const prontoParaImportar = (resultado?.produtos.length ?? 0) > 0;

  return (
    <Tela titulo="Importar base de produtos" voltar={true} comBarraInferior>
      <p className="texto-suave">
        Selecione a tabela de preços (.xlsx, .xls ou .csv). A base atual será
        substituída pelo conteúdo do arquivo.
      </p>

      <input
        ref={inputArquivo}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={(e) => {
          void aoEscolherArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variante="secundario" bloco onClick={() => inputArquivo.current?.click()}>
        {lendo ? "Lendo arquivo…" : nomeArquivo || "Escolher arquivo"}
      </Button>

      {planilha && planilha.formato === "matriz" && colunasMatriz && (
        <>
          <h2 className="secao-titulo">Colunas identificadas</h2>
          <p className="texto-suave">
            Formato de tabela de preços: uma linha por produto, uma coluna por
            embalagem. {colunasMatriz.embalagens.length} colunas de embalagem
            encontradas.
          </p>
          <Select
            rotulo="Produto"
            obrigatorio
            value={colunasMatriz.produto ?? ""}
            onChange={(e) => ajustarColunaMatriz("produto", e.target.value)}
          >
            <option value="">— não usar —</option>
            {colunas.map((nome, indice) => (
              <option key={indice} value={indice}>
                {nome || `Coluna ${indice + 1}`}
              </option>
            ))}
          </Select>
          <Select
            rotulo="Detalhes / variação"
            ajuda="Combinado com o nome do produto (ex.: “Esmalte brilhante (branco)”)."
            value={colunasMatriz.detalhes ?? ""}
            onChange={(e) => ajustarColunaMatriz("detalhes", e.target.value)}
          >
            <option value="">— não usar —</option>
            {colunas.map((nome, indice) => (
              <option key={indice} value={indice}>
                {nome || `Coluna ${indice + 1}`}
              </option>
            ))}
          </Select>
          <Select
            rotulo="Categoria"
            ajuda="Usada só para identificar a coluna; não afeta o produto importado."
            value={colunasMatriz.categoria ?? ""}
            onChange={(e) => ajustarColunaMatriz("categoria", e.target.value)}
          >
            <option value="">— não usar —</option>
            {colunas.map((nome, indice) => (
              <option key={indice} value={indice}>
                {nome || `Coluna ${indice + 1}`}
              </option>
            ))}
          </Select>
        </>
      )}

      {planilha && planilha.formato === "lista" && mapeamentoLista && (
        <>
          <h2 className="secao-titulo">Colunas</h2>
          {(Object.keys(ROTULOS_LISTA) as CampoLista[]).map((campo) => (
            <Select
              key={campo}
              rotulo={ROTULOS_LISTA[campo]}
              value={mapeamentoLista[campo] ?? ""}
              obrigatorio={campo !== "embalagem"}
              onChange={(e) =>
                setMapeamentoLista({
                  ...mapeamentoLista,
                  [campo]: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">— não usar —</option>
              {colunas.map((nome, indice) => (
                <option key={indice} value={indice}>
                  {nome || `Coluna ${indice + 1}`}
                </option>
              ))}
            </Select>
          ))}
        </>
      )}

      {planilha && resultado && (
        <>
          <h2 className="secao-titulo">Conferência</h2>
          <Cartao>
            <div className={css.resumoImport}>
              <div className={css.resumoImportItem}>
                <span className={css.resumoImportValor}>{resultado.produtos.length}</span>
                <span className="texto-suave">combinações válidas</span>
              </div>
              <div className={css.resumoImportItem}>
                <span className={css.resumoImportValor}>{resultado.ignorados.length}</span>
                <span className="texto-suave">linhas com aviso</span>
              </div>
            </div>
          </Cartao>

          {resultado.produtos.length > 0 && (
            <div className={css.previaRolagem}>
              <table className={css.previaTabela}>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Embalagem</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.produtos.slice(0, 10).map((p, i) => (
                    <tr key={i}>
                      <td>
                        {p.nome}
                        {p.detalhes ? ` (${p.detalhes})` : ""}
                      </td>
                      <td>{p.embalagem}</td>
                      <td>{formatarMoeda(p.valorUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resultado.ignorados.length > 0 && (
            <details>
              <summary className="texto-suave">
                Ver linhas com aviso ({resultado.ignorados.length})
              </summary>
              <ul className="texto-suave">
                {resultado.ignorados.slice(0, 30).map((ig, i) => (
                  <li key={i}>
                    Linha {ig.linha}: {ig.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <BarraInferior>
        <Button bloco onClick={confirmar} disabled={!prontoParaImportar || confirmando}>
          {confirmando
            ? "Importando…"
            : `Substituir base (${resultado?.produtos.length ?? 0})`}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
