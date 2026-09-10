import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input, Textarea } from "../../components/ui/Field";
import { SelectComOutro } from "../../components/ui/SelectComOutro";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { Etiqueta } from "../../components/ui/Etiqueta";
import { ZonaDeRisco } from "../../components/ui/ZonaDeRisco";
import {
  IconeCliente,
  IconeEndereco,
  IconeEntrega,
  IconeExcluir,
} from "../../components/ui/icones";
import css from "./clientes.module.css";
import { useToast } from "../../components/ui/Toast";
import {
  mascararCep,
  mascararCpfCnpj,
  mascararTelefone,
  somenteDigitos,
  validarCpfCnpj,
} from "../../domain/cpfCnpj";
import { CONDICOES_PAGAMENTO } from "../../domain/condicoesPagamento";
import { mensagemErro } from "../../domain/erros";
import { definirParametro } from "../../domain/rotas";
import type { EntradaCliente } from "../../data/repository";

const VAZIO: EntradaCliente = {
  nome: "",
  nomeFantasia: "",
  cpfCnpj: "",
  codigoCliente: "",
  contato: "",
  telefone: "",
  endereco: "",
  bairro: "",
  cidadeEstado: "",
  cep: "",
  transportadora: "",
  condicaoPagamento: "",
  obsGerais: "",
};

/** "Campo Grande / MS" -> ["Campo Grande", "MS"]. */
function separarCidadeUf(valor: string | undefined): [string, string] {
  const [cidade = "", uf = ""] = (valor ?? "").split("/").map((p) => p.trim());
  return [cidade, uf];
}

function juntarCidadeUf(cidade: string, uf: string): string {
  const c = cidade.trim();
  const u = uf.trim();
  if (c && u) return `${c} / ${u}`;
  return c || u;
}

/**
 * Cidade e UF vivem em estado proprio, e nao derivados de `cidadeEstado` a cada
 * tecla: o `trim()` do parse comia o espaco em digitacao e "Tres Lagoas" virava
 * "TresLagoas". O campo salvo continua sendo `cidadeEstado`.
 */

export function ClienteFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const { id } = useParams();
  const [params] = useSearchParams();

  const selecionando = params.get("selecionar") === "1";
  const retorno = params.get("retorno") ?? "/pedidos/novo";

  const [form, setForm] = useState<EntradaCliente>(VAZIO);
  /** Guarda o estado salvo para saber se há edição pendente ao voltar. */
  const [original, setOriginal] = useState<EntradaCliente>(VAZIO);
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [erroDocumento, setErroDocumento] = useState<string | undefined>();
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const { dados: cliente } = useDados(
    async () => (id ? repo.obterCliente(id) : undefined),
    [repo, id],
  );

  // Sugestões de transportadora vindas dos clientes já cadastrados (texto livre,
  // sem lista fechada). Condição de pagamento usa CONDICOES_PAGAMENTO (lista fechada).
  const { dados: sugestoes } = useDados(async () => {
    const todos = await repo.listarClientes();
    const unicos = (valores: (string | undefined)[]) =>
      [...new Set(valores.filter((v): v is string => !!v?.trim()))].sort();
    return { transportadora: unicos(todos.map((c) => c.transportadora)) };
  }, [repo]);

  useEffect(() => {
    if (cliente) {
      setForm({ ...cliente });
      setOriginal({ ...cliente });
      const [c, u] = separarCidadeUf(cliente.cidadeEstado);
      setCidade(c);
      setUf(u);
    }
  }, [cliente]);

  const alterado = JSON.stringify(form) !== JSON.stringify(original);

  function campo<K extends keyof EntradaCliente>(chave: K, valor: EntradaCliente[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    const nomeOk = form.nome.trim().length > 0;
    setErroNome(nomeOk ? undefined : "Informe o nome do cliente.");

    // Documento é opcional (ex.: cliente cadastrado ainda em fase de orçamento,
    // documento capturado depois) — só valida quando algo foi digitado. Nome é
    // o mínimo para identificar o cliente.
    const documentoOk = !form.cpfCnpj.trim() || validarCpfCnpj(form.cpfCnpj);
    setErroDocumento(documentoOk ? undefined : "CPF/CNPJ inválido.");

    if (!nomeOk) return;

    setSalvando(true);
    try {
      const salvo = await repo.salvarCliente({ ...form, id });
      toast.sucesso("Cliente salvo.");
      if (selecionando) {
        navigate(definirParametro(retorno, "clienteId", salvo.id), { replace: true });
      } else {
        navigate(-1);
      }
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o cliente."));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!id || !cliente) return;
    const vinculados = await repo.listarPedidos({ clienteId: id });
    const aviso =
      vinculados.length > 0
        ? `Este cliente tem ${vinculados.length} pedido(s) registrado(s). Os pedidos continuam existindo, mas o nome do cliente some deles. Excluir mesmo assim?`
        : `Excluir o cliente "${cliente.nome}"? Esta ação não pode ser desfeita.`;
    if (!(await confirmar({ mensagem: aviso, textoConfirmar: "Excluir", perigo: true }))) return;

    setExcluindo(true);
    try {
      await repo.removerCliente(id);
      const clienteApagado = cliente;
      toast.acao("Cliente excluído.", "Desfazer", () => {
        void repo.restaurarCliente(clienteApagado);
      });
      navigate("/clientes", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir o cliente."));
      setExcluindo(false);
    }
  }

  const enderecoPreenchidos = [
    form.endereco,
    form.bairro,
    form.cidadeEstado,
    form.cep,
  ].filter((v) => v?.trim()).length;
  const comercialPreenchidos = [
    form.transportadora,
    form.condicaoPagamento,
    form.obsGerais,
  ].filter((v) => v?.trim()).length;

  /** Volta só depois de confirmar, quando há edição não salva. */
  function confirmarSaida(seguir: () => void) {
    if (!alterado) {
      seguir();
      return;
    }
    void confirmar({
      mensagem: "Você tem alterações não salvas neste cliente. Sair e descartar?",
      textoConfirmar: "Descartar",
      perigo: true,
    }).then((ok) => {
      if (ok) seguir();
    });
  }

  return (
    <Tela
      titulo={id ? form.nome || "Editar cliente" : "Novo cliente"}
      subtitulo={id ? "Cliente" : "Novo cadastro"}
      voltar={true}
      aoVoltar={confirmarSaida}
      capa
      comBarraInferior
    >
      <Painel
        titulo="Identificação"
        icone={<IconeCliente size={17} />}
        acao={
          // A situação vinda da planilha vira etiqueta — antes gastava uma
          // linha inteira num campo desligado que o usuário não podia mudar.
          form.situacao ? <Etiqueta variante="alerta">{form.situacao}</Etiqueta> : undefined
        }
      >
        <Input
          rotulo="Nome"
          obrigatorio
          value={form.nome}
          erro={erroNome}
          onChange={(e) => campo("nome", e.target.value)}
          autoCapitalize="words"
        />
        <div className={css.duplo}>
          <Input
            rotulo="CPF / CNPJ"
            inputMode="numeric"
            value={mascararCpfCnpj(form.cpfCnpj)}
            erro={erroDocumento}
            onChange={(e) => campo("cpfCnpj", e.target.value)}
            onBlur={() =>
              setErroDocumento(
                !form.cpfCnpj.trim() || validarCpfCnpj(form.cpfCnpj)
                  ? undefined
                  : "CPF/CNPJ inválido.",
              )
            }
            ajuda="Opcional."
          />
          <Input
            rotulo="Código do cliente"
            value={form.codigoCliente ?? ""}
            onChange={(e) => campo("codigoCliente", e.target.value)}
          />
        </div>
        <Input
          rotulo="Telefone"
          inputMode="tel"
          value={mascararTelefone(form.telefone ?? "")}
          onChange={(e) => campo("telefone", somenteDigitos(e.target.value))}
        />
      </Painel>

      <Painel
        titulo="Endereço e contato"
        icone={<IconeEndereco size={17} />}
        colapsavel
        abertoInicial={enderecoPreenchidos > 0}
        contador={<Etiqueta variante="info">{enderecoPreenchidos} de 4</Etiqueta>}
        resumo={
          enderecoPreenchidos > 0 ? (
            <div className={css.resumoChips}>
              {[form.endereco, form.bairro, form.cidadeEstado, form.cep]
                .filter((v): v is string => !!v?.trim())
                .map((v) => (
                  <Etiqueta key={v}>{v}</Etiqueta>
                ))}
            </div>
          ) : undefined
        }
      >
        <Input
          rotulo="Contato"
          value={form.contato ?? ""}
          onChange={(e) => campo("contato", e.target.value)}
        />
        <Input
          rotulo="Endereço"
          value={form.endereco ?? ""}
          onChange={(e) => campo("endereco", e.target.value)}
        />
        <div className={css.duplo}>
          <Input
            rotulo="Bairro"
            value={form.bairro ?? ""}
            onChange={(e) => campo("bairro", e.target.value)}
          />
          <Input
            rotulo="CEP"
            inputMode="numeric"
            value={mascararCep(form.cep ?? "")}
            onChange={(e) => campo("cep", e.target.value)}
          />
        </div>
        {/* Cidade e UF separados, como já vêm da planilha importada — antes era
            um campo livre só, que produzia dados inconsistentes entre os dois
            caminhos. Continuam guardados juntos em `cidadeEstado`. */}
        <div className={css.cidadeUf}>
          <Input
            rotulo="Cidade"
            value={cidade}
            onChange={(e) => {
              setCidade(e.target.value);
              campo("cidadeEstado", juntarCidadeUf(e.target.value, uf));
            }}
          />
          <Input
            rotulo="UF"
            value={uf}
            maxLength={2}
            autoCapitalize="characters"
            onChange={(e) => {
              const novo = e.target.value.toUpperCase();
              setUf(novo);
              campo("cidadeEstado", juntarCidadeUf(cidade, novo));
            }}
          />
        </div>
      </Painel>

      <Painel
        titulo="Comercial"
        icone={<IconeEntrega size={17} />}
        colapsavel
        abertoInicial={comercialPreenchidos > 0}
        contador={<Etiqueta variante="info">{comercialPreenchidos} de 3</Etiqueta>}
        resumo={
          comercialPreenchidos > 0 ? (
            <div className={css.resumoChips}>
              {[form.transportadora, form.condicaoPagamento, form.obsGerais]
                .filter((v): v is string => !!v?.trim())
                .map((v) => (
                  <Etiqueta key={v}>{v}</Etiqueta>
                ))}
            </div>
          ) : undefined
        }
      >
        <Input
          rotulo="Transportadora"
          value={form.transportadora ?? ""}
          sugestoes={sugestoes?.transportadora}
          onChange={(e) => campo("transportadora", e.target.value)}
        />
        <SelectComOutro
          rotulo="Condição de pagamento"
          opcoes={CONDICOES_PAGAMENTO}
          value={form.condicaoPagamento ?? ""}
          onChange={(valor) => campo("condicaoPagamento", valor)}
        />
        <Textarea
          rotulo="Observações"
          ajuda="Entrega, horário de recebimento, financeiro etc."
          value={form.obsGerais ?? ""}
          onChange={(e) => campo("obsGerais", e.target.value)}
        />
      </Painel>

      {id && (
        <ZonaDeRisco descricao="Os pedidos já feitos continuam existindo, mas o nome do cliente some deles.">
          <Button variante="perigo" onClick={excluir} disabled={excluindo}>
            <IconeExcluir size={16} />
            {excluindo ? "Excluindo…" : "Excluir cliente"}
          </Button>
        </ZonaDeRisco>
      )}

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cliente"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
