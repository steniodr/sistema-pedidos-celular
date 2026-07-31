import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
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
import type { EntradaCliente } from "../../data/repository";

const VAZIO: EntradaCliente = {
  nome: "",
  cpfCnpj: "",
  codigoCliente: "",
  telefone: "",
  endereco: "",
  bairro: "",
  cidadeEstado: "",
  cep: "",
  transportadora: "",
  condicaoPagamento: "",
  localEntrega: "",
};

export function ClienteFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();

  const selecionando = params.get("selecionar") === "1";
  const marca = params.get("marca") ?? "";

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

    const documentoOk = validarCpfCnpj(form.cpfCnpj);
    setErroDocumento(documentoOk ? undefined : "CPF/CNPJ inválido.");

    // Documento inválido não impede salvar o cadastro; só bloqueia a finalização
    // do pedido (especificação 6.2). Nome é o mínimo para identificar o cliente.
    if (!nomeOk) return;

    setSalvando(true);
    try {
      const salvo = await repo.salvarCliente({ ...form, id });
      toast.sucesso("Cliente salvo.");
      if (selecionando) {
        navigate(
          `/pedidos/novo?clienteId=${salvo.id}&marca=${encodeURIComponent(marca)}`,
          { replace: true },
        );
      } else {
        navigate(-1);
      }
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!id) return;
    if (!window.confirm(`Excluir o cliente "${cliente?.nome ?? ""}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setExcluindo(true);
    try {
      await repo.removerCliente(id);
      toast.sucesso("Cliente excluído.");
      navigate("/clientes", { replace: true });
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível excluir o cliente.");
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
        obrigatorio
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
        ajuda="Validado ao sair do campo. O pedido só é finalizado com documento válido."
      />
      <Input
        rotulo="Código do cliente"
        value={form.codigoCliente ?? ""}
        onChange={(e) => campo("codigoCliente", e.target.value)}
      />

      <h2 className="secao-titulo">Contato e endereço</h2>
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
      <Input
        rotulo="Local da entrega"
        value={form.localEntrega ?? ""}
        onChange={(e) => campo("localEntrega", e.target.value)}
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
