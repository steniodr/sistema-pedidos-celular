import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararCpfCnpj, somenteDigitos } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import { lerArquivoClientes } from "./lerArquivoClientes";
import {
  converterClientes,
  type CampoCliente,
  type MapeamentoClientes,
  type PlanilhaLidaClientes,
} from "./importarClientesPlanilha";
import css from "./clientes.module.css";

const ROTULOS: Record<CampoCliente, string> = {
  nome: "Nome / Razão social",
  nomeFantasia: "Nome fantasia",
  cpfCnpj: "CPF / CNPJ",
  codigoCliente: "Código do cliente",
  contato: "Contato",
  telefone: "Telefone",
  endereco: "Endereço",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
  situacao: "Situação",
  obsGerais: "Observações",
};

const CAMPOS_OBRIGATORIOS: CampoCliente[] = ["nome", "cpfCnpj"];

export function ImportarClientesPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [nomeArquivo, setNomeArquivo] = useState("");
  const [planilha, setPlanilha] = useState<PlanilhaLidaClientes | null>(null);
  const [mapeamento, setMapeamento] = useState<MapeamentoClientes | null>(null);
  const [lendo, setLendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const { dados: docsExistentes } = useDados(async () => {
    const clientes = await repo.listarClientes();
    return new Set(clientes.map((c) => somenteDigitos(c.cpfCnpj)));
  }, [repo]);

  const resultado = useMemo(() => {
    if (!planilha || !mapeamento) return null;
    return converterClientes(planilha, mapeamento);
  }, [planilha, mapeamento]);

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendo(true);
    try {
      const lida = await lerArquivoClientes(arquivo);
      setPlanilha(lida);
      setMapeamento(lida.mapeamento);
      setNomeArquivo(arquivo.name);
      if (lida.linhaCabecalho === -1) {
        toast.info("Não identifiquei o cabeçalho. Confira as colunas abaixo.");
      }
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível ler o arquivo."));
      setPlanilha(null);
      setMapeamento(null);
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    if (!resultado || resultado.clientes.length === 0) return;
    setConfirmando(true);
    try {
      const info = await repo.importarClientes(resultado.clientes, nomeArquivo);
      toast.sucesso(
        `${info.totalNovos} novos, ${info.totalAtualizados} atualizados.`,
      );
      navigate("/clientes", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Falha ao importar clientes."));
    } finally {
      setConfirmando(false);
    }
  }

  const colunas = planilha?.cabecalho ?? [];
  const prontoParaImportar = (resultado?.clientes.length ?? 0) > 0;

  return (
    <Tela titulo="Importar clientes" voltar={true} comBarraInferior>
      <p className="texto-suave">
        Selecione a base de clientes (.xlsx, .xls ou .csv). Clientes já
        cadastrados são identificados pelo CPF/CNPJ e têm os dados
        atualizados — nenhum cliente existente é apagado.
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

      {planilha && mapeamento && (
        <>
          <h2 className="secao-titulo">Colunas</h2>
          {(Object.keys(ROTULOS) as CampoCliente[]).map((campo) => (
            <Select
              key={campo}
              rotulo={ROTULOS[campo]}
              value={mapeamento[campo] ?? ""}
              obrigatorio={CAMPOS_OBRIGATORIOS.includes(campo)}
              onChange={(e) =>
                setMapeamento({
                  ...mapeamento,
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
                <span className={css.resumoImportValor}>{resultado.clientes.length}</span>
                <span className="texto-suave">clientes válidos</span>
              </div>
              <div className={css.resumoImportItem}>
                <span className={css.resumoImportValor}>{resultado.ignorados.length}</span>
                <span className="texto-suave">linhas com aviso</span>
              </div>
            </div>
          </Cartao>

          {resultado.clientes.length > 0 && (
            <div className="pilha">
              {resultado.clientes.slice(0, 10).map((c, i) => {
                const existe = docsExistentes?.has(somenteDigitos(c.cpfCnpj));
                return (
                  <Cartao key={i}>
                    <div className="linha linha--entre">
                      <span className="texto-forte">{c.nome}</span>
                      <span className="texto-suave">{existe ? "Atualiza" : "Novo"}</span>
                    </div>
                    <div className="texto-suave">
                      {mascararCpfCnpj(c.cpfCnpj)}
                      {c.cidadeEstado ? ` · ${c.cidadeEstado}` : ""}
                    </div>
                  </Cartao>
                );
              })}
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
          {confirmando ? "Importando…" : `Importar (${resultado?.clientes.length ?? 0})`}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
