import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { Passos } from "../../components/ui/Passos";
import { Etiqueta } from "../../components/ui/Etiqueta";
import {
  IconeCliente,
  IconeLista,
  IconeOk,
  IconePlanilha,
  IconeSeta,
} from "../../components/ui/icones";
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
  const [passoConferencia, setPassoConferencia] = useState(false);

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
      const cabecalhoNaoIdentificado = lida.linhaCabecalho === -1;
      setPassoConferencia(false);
      if (cabecalhoNaoIdentificado) {
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

  const passo = !planilha ? 0 : passoConferencia ? 2 : 1;

  return (
    <Tela
      titulo="Importar clientes"
      subtitulo={`Passo ${passo + 1} de 3 · ${["escolher arquivo", "conferir colunas", "conferir e importar"][passo]}`}
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
            Base de clientes em .xlsx, .xls ou .csv. Quem já existe é reconhecido pelo CPF/CNPJ e
            tem os dados atualizados — <strong>nenhum cliente é apagado</strong>.
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
            <span className="texto-suave">{colunas.length} colunas na planilha</span>
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
        <Painel titulo="Colunas" icone={<IconeLista size={17} />}>
          {(Object.keys(ROTULOS) as CampoCliente[]).map((campo) => {
            const atual = mapeamento?.[campo] ?? null;
            return (
              <div key={campo} className={css.mapa}>
                <Select
                  rotulo={`Vira ${ROTULOS[campo]}`}
                  obrigatorio={CAMPOS_OBRIGATORIOS.includes(campo)}
                  value={atual === null ? "" : String(atual)}
                  onChange={(e) =>
                    setMapeamento({
                      ...(mapeamento as MapeamentoClientes),
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
                {atual === null ? (
                  <Etiqueta>vazia</Etiqueta>
                ) : (
                  <Etiqueta variante="sucesso">reconhecida</Etiqueta>
                )}
              </div>
            );
          })}
        </Painel>
      )}

      {passo === 2 && resultado && (
        <>
          <Painel titulo="Conferência" icone={<IconeOk size={17} />}>
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
          </Painel>

          {resultado.clientes.length > 0 && (
            <Painel titulo="Amostra" icone={<IconeCliente size={17} />}>
              <div className="pilha pilha--apertada">
                {resultado.clientes.slice(0, 10).map((cliente, i) => {
                  const jaExiste = docsExistentes?.has(somenteDigitos(cliente.cpfCnpj));
                  return (
                    <div key={i} className={css.amostraLinha}>
                      <span className={css.amostraNome}>{cliente.nome}</span>
                      <span className="texto-suave">{mascararCpfCnpj(cliente.cpfCnpj)}</span>
                      {/* Novo x Atualiza era texto cinza igual ao resto; virou
                          etiqueta, que é o dado mais importante da conferência. */}
                      <Etiqueta variante={jaExiste ? "info" : "sucesso"}>
                        {jaExiste ? "Atualiza" : "Novo"}
                      </Etiqueta>
                    </div>
                  );
                })}
              </div>
              {resultado.clientes.length > 10 && (
                <p className="texto-suave">Mostrando 10 de {resultado.clientes.length}.</p>
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
                <p className="texto-suave">Mostrando 30 de {resultado.ignorados.length}.</p>
              )}
            </details>
          )}
        </>
      )}

      <BarraInferior>
        {passo === 2 ? (
          <div className={css.botoesRodape}>
            <Button variante="secundario" bloco onClick={() => setPassoConferencia(false)}>
              Voltar
            </Button>
            <Button bloco disabled={!prontoParaImportar || confirmando} onClick={confirmar}>
              {confirmando ? "Importando…" : `Importar (${resultado?.clientes.length ?? 0})`}
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
