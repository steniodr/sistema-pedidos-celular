import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { useConfirm } from "../../components/ui/Confirm";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { Passos } from "../../components/ui/Passos";
import { Etiqueta } from "../../components/ui/Etiqueta";
import {
  IconeAtencao,
  IconeLista,
  IconeOk,
  IconePlanilha,
  IconeProduto,
  IconeSeta,
} from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
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
  const [passoConferencia, setPassoConferencia] = useState(false);
  const pedirConfirmacao = useConfirm();

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
      const cabecalhoNaoIdentificado = lida.linhaCabecalho === -1;
      setPassoConferencia(false);
      if (cabecalhoNaoIdentificado) {
        toast.info("Não identifiquei o cabeçalho. Confira as colunas abaixo.");
      }
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível ler o arquivo."));
      setPlanilha(null);
      setMapeamentoLista(null);
      setColunasMatriz(null);
    } finally {
      setLendo(false);
    }
  }

  function ajustarColunaMatriz(campo: "categoria" | "produto" | "detalhes" | "variacao", valor: string) {
    if (!planilha) return;
    const indice = valor === "" ? null : Number(valor);
    const fixas = {
      categoria: colunasMatriz?.categoria ?? null,
      produto: colunasMatriz?.produto ?? null,
      detalhes: colunasMatriz?.detalhes ?? null,
      variacao: colunasMatriz?.variacao ?? null,
      [campo]: indice,
    };
    setColunasMatriz(detectarColunasMatriz(planilha.cabecalho, fixas));
  }

  async function confirmar() {
    if (!resultado || resultado.produtos.length === 0) return;
    // Trocar a base e irreversivel e antes acontecia num toque so — excluir UM
    // produto ja pedia confirmacao, o que deixava o risco invertido.
    const ok = await pedirConfirmacao({
      mensagem: `Substituir a base atual pelos ${resultado.produtos.length} produtos de "${nomeArquivo}"? Os produtos de hoje serão apagados e isso não pode ser desfeito.`,
      textoConfirmar: "Substituir base",
      perigo: true,
    });
    if (!ok) return;
    setConfirmando(true);
    try {
      const info = await repo.substituirBaseProdutos(resultado.produtos, nomeArquivo);
      toast.sucesso(`${info.totalProdutos} combinações de produto importadas.`);
      navigate("/produtos", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Falha ao gravar a base."));
    } finally {
      setConfirmando(false);
    }
  }

  const colunas = planilha?.cabecalho ?? [];
  const prontoParaImportar = (resultado?.produtos.length ?? 0) > 0;

  // Passo derivado do estado: 0 escolher arquivo, 1 conferir colunas, 2 conferir
  // resultado. Antes tudo isso aparecia de uma vez na mesma rolagem.
  const passo = !planilha ? 0 : passoConferencia ? 2 : 1;

  const rotulosMatriz: { campo: "produto" | "detalhes" | "categoria" | "variacao"; rotulo: string; obrigatorio?: boolean }[] = [
    { campo: "produto", rotulo: "Produto", obrigatorio: true },
    { campo: "detalhes", rotulo: "Detalhes do produto" },
    { campo: "categoria", rotulo: "Categoria" },
    { campo: "variacao", rotulo: "Variação (tamanho/tipo)" },
  ];

  function nomeColuna(indice: number | null | undefined): string | null {
    if (indice === null || indice === undefined) return null;
    return colunas[indice] || `Coluna ${indice + 1}`;
  }

  return (
    <Tela
      titulo="Importar produtos"
      subtitulo={`Passo ${passo + 1} de 3 · ${["escolher arquivo", "conferir colunas", "conferir e substituir"][passo]}`}
      voltar={true}
      capa
      comBarraInferior
      abaixoDoTitulo={<Passos rotulos={["Arquivo", "Colunas", "Conferir"]} atual={passo} />}
    >
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

      {passo === 0 && (
        <Painel titulo="Arquivo" icone={<IconePlanilha size={17} />}>
          <p className="texto-suave">
            Tabela de preços em .xlsx, .xls ou .csv. Na última etapa você confere tudo antes de
            substituir a base atual.
          </p>
          <Button
            variante="secundario"
            bloco
            onClick={() => inputArquivo.current?.click()}
            disabled={lendo}
          >
            {lendo ? "Lendo arquivo…" : "Escolher arquivo"}
          </Button>
        </Painel>
      )}

      {planilha && (
        <div className={css.arquivoEscolhido}>
          <span className={css.arquivoIcone}>
            <IconePlanilha size={19} />
          </span>
          <span className={css.arquivoInfo}>
            <span className={css.arquivoNome}>{nomeArquivo}</span>
            <span className="texto-suave">
              {planilha.formato === "matriz"
                ? "Tabela de preços (uma coluna por embalagem)"
                : "Lista (uma linha por produto)"}
            </span>
          </span>
          <Button
            variante="fantasma"
            className={css.linkArquivo}
            onClick={() => inputArquivo.current?.click()}
          >
            Trocar
          </Button>
        </div>
      )}

      {passo === 1 && (
        <>
          <Painel titulo="Colunas" icone={<IconeLista size={17} />}>
            {/* "Coluna da planilha → vira campo" no lugar de uma pilha de selects
                iguais: dá para conferir de relance o que foi reconhecido. */}
            {planilha?.formato === "matriz"
              ? rotulosMatriz.map(({ campo, rotulo, obrigatorio }) => {
                  const atual = colunasMatriz?.[campo] ?? null;
                  return (
                    <div key={campo} className={css.mapa}>
                      <Select
                        rotulo={`Vira ${rotulo}`}
                        obrigatorio={obrigatorio}
                        value={atual === null ? "" : String(atual)}
                        onChange={(e) => ajustarColunaMatriz(campo, e.target.value)}
                      >
                        <option value="">— não usar —</option>
                        {colunas.map((nome, i) => (
                          <option key={i} value={i}>
                            {nome || `Coluna ${i + 1}`}
                          </option>
                        ))}
                      </Select>
                      {nomeColuna(atual) ? (
                        <Etiqueta variante="sucesso">reconhecida</Etiqueta>
                      ) : (
                        <Etiqueta>vazia</Etiqueta>
                      )}
                    </div>
                  );
                })
              : (Object.keys(ROTULOS_LISTA) as CampoLista[]).map((campo) => {
                  const atual = mapeamentoLista?.[campo] ?? null;
                  return (
                    <div key={campo} className={css.mapa}>
                      <Select
                        rotulo={`Vira ${ROTULOS_LISTA[campo]}`}
                        obrigatorio={campo !== "embalagem"}
                        value={atual === null ? "" : String(atual)}
                        onChange={(e) =>
                          setMapeamentoLista({
                            ...(mapeamentoLista as MapeamentoLista),
                            [campo]: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">— não usar —</option>
                        {colunas.map((nome, i) => (
                          <option key={i} value={i}>
                            {nome || `Coluna ${i + 1}`}
                          </option>
                        ))}
                      </Select>
                      {nomeColuna(atual) ? (
                        <Etiqueta variante="sucesso">reconhecida</Etiqueta>
                      ) : (
                        <Etiqueta>vazia</Etiqueta>
                      )}
                    </div>
                  );
                })}
            {planilha?.formato === "matriz" && (
              <p className="texto-suave">
                {colunasMatriz?.embalagens.length ?? 0} colunas de embalagem encontradas.
              </p>
            )}
          </Painel>

          <p className={css.avisoLimite}>
            No passo 3 você confere o resultado antes de substituir a base atual.
          </p>
        </>
      )}

      {passo === 2 && resultado && (
        <>
          <Painel titulo="Conferência" icone={<IconeOk size={17} />}>
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
          </Painel>

          {resultado.produtos.length > 0 && (
            <Painel titulo="Amostra" icone={<IconeProduto size={17} />}>
              <div className="pilha pilha--apertada">
                {resultado.produtos.slice(0, 10).map((p, i) => (
                  <div key={i} className={css.amostraLinha}>
                    <span className={css.amostraNome}>
                      {[p.categoria, p.nome].filter(Boolean).join(" · ")}
                      {p.detalhes ? ` (${p.detalhes})` : ""}
                      {p.variacao ? ` · ${p.variacao}` : ""}
                    </span>
                    <span className="texto-suave">{p.embalagem}</span>
                    <span className="texto-forte">{formatarMoeda(p.valorUnit)}</span>
                  </div>
                ))}
              </div>
              {/* O corte era silencioso: a tela mostrava 10 sem dizer de quantos. */}
              {resultado.produtos.length > 10 && (
                <p className="texto-suave">
                  Mostrando 10 de {resultado.produtos.length}.
                </p>
              )}
            </Painel>
          )}

          {resultado.ignorados.length > 0 && (
            <details className={css.detalhesAviso}>
              <summary>Ver linhas com aviso ({resultado.ignorados.length})</summary>
              <ul className="texto-suave">
                {resultado.ignorados.slice(0, 30).map((linha, i) => (
                  <li key={i}>
                    Linha {linha.linha}: {linha.motivo}
                  </li>
                ))}
              </ul>
              {resultado.ignorados.length > 30 && (
                <p className="texto-suave">
                  Mostrando 30 de {resultado.ignorados.length}.
                </p>
              )}
            </details>
          )}

          <div className={css.avisoSubstituir}>
            <span className={css.avisoSubstituirIcone}>
              <IconeAtencao size={17} />
            </span>
            <span>
              Substituir troca a base inteira: os {resultado.produtos.length} produtos deste
              arquivo passam a ser os únicos. Pedidos já feitos não mudam.
            </span>
          </div>
        </>
      )}

      <BarraInferior>
        {passo === 2 ? (
          <div className={css.botoesRodape}>
            <Button variante="secundario" bloco onClick={() => setPassoConferencia(false)}>
              Voltar
            </Button>
            <Button bloco disabled={!prontoParaImportar || confirmando} onClick={confirmar}>
              {confirmando ? "Importando…" : `Substituir base (${resultado?.produtos.length ?? 0})`}
            </Button>
          </div>
        ) : (
          <Button
            bloco
            disabled={passo === 0 || !prontoParaImportar}
            onClick={() => setPassoConferencia(true)}
          >
            Conferir
            <IconeSeta size={17} />
          </Button>
        )}
      </BarraInferior>
    </Tela>
  );
}
