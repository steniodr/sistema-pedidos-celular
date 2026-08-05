import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input, Textarea } from "../../components/ui/Field";
import { SelectComOutro } from "../../components/ui/SelectComOutro";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import {
  mascararCep,
  mascararCpfCnpj,
  mascararTelefone,
  validarCpfCnpj,
} from "../../domain/cpfCnpj";
import { CONDICOES_PAGAMENTO } from "../../domain/condicoesPagamento";
import { mensagemErro } from "../../domain/erros";
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
    if (cliente) setForm({ ...cliente });
  }, [cliente]);

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
        const separador = retorno.includes("?") ? "&" : "?";
        navigate(`${retorno}${separador}clienteId=${salvo.id}`, { replace: true });
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

  return (
    <Tela titulo={id ? "Editar cliente" : "Novo cliente"} voltar={true} comBarraInferior>
      <h2 className="secao-titulo">Identificação</h2>
      <Input
        rotulo="Nome"
        obrigatorio
        value={form.nome}
        erro={erroNome}
        onChange={(e) => campo("nome", e.target.value)}
        autoCapitalize="words"
      />
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
        ajuda="Opcional — útil quando o dado ainda não foi capturado (ex.: orçamento). Se preenchido, é validado ao sair do campo."
      />
      <Input
        rotulo="Nome fantasia"
        value={form.nomeFantasia ?? ""}
        onChange={(e) => campo("nomeFantasia", e.target.value)}
      />
      <Input
        rotulo="Código do cliente"
        value={form.codigoCliente ?? ""}
        onChange={(e) => campo("codigoCliente", e.target.value)}
      />
      {form.situacao && (
        <Input rotulo="Situação (base importada)" value={form.situacao} readOnly disabled />
      )}

      <h2 className="secao-titulo">Contato e endereço</h2>
      <Input
        rotulo="Contato"
        value={form.contato ?? ""}
        onChange={(e) => campo("contato", e.target.value)}
      />
      <Input
        rotulo="Telefone"
        inputMode="tel"
        value={mascararTelefone(form.telefone ?? "")}
        onChange={(e) => campo("telefone", e.target.value)}
      />
      <Input
        rotulo="Endereço"
        value={form.endereco ?? ""}
        onChange={(e) => campo("endereco", e.target.value)}
      />
      <Input
        rotulo="Bairro"
        value={form.bairro ?? ""}
        onChange={(e) => campo("bairro", e.target.value)}
      />
      <Input
        rotulo="Cidade / Estado"
        value={form.cidadeEstado ?? ""}
        onChange={(e) => campo("cidadeEstado", e.target.value)}
      />
      <Input
        rotulo="CEP"
        inputMode="numeric"
        value={mascararCep(form.cep ?? "")}
        onChange={(e) => campo("cep", e.target.value)}
      />

      <h2 className="secao-titulo">Comercial</h2>
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

      {id && (
        <Button variante="perigo" onClick={excluir} disabled={excluindo}>
          {excluindo ? "Excluindo…" : "Excluir cliente"}
        </Button>
      )}

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cliente"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
