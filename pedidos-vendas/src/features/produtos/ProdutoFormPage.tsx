import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { lerNumeroBR } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import type { EntradaProdutoUnico } from "../../data/repository";

const VAZIO: EntradaProdutoUnico = {
  nome: "",
  categoria: "",
  detalhes: "",
  variacao: "",
  embalagem: "",
  valorUnit: 0,
};

export function ProdutoFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const { id } = useParams();

  const [form, setForm] = useState<EntradaProdutoUnico>(VAZIO);
  const [valorTexto, setValorTexto] = useState("");
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const { dados: produto } = useDados(
    async () => (id ? repo.obterProduto(id) : undefined),
    [repo, id],
  );

  useEffect(() => {
    if (produto) {
      setForm(produto);
      setValorTexto(String(produto.valorUnit).replace(".", ","));
    }
  }, [produto]);

  function campo<K extends keyof EntradaProdutoUnico>(chave: K, valor: EntradaProdutoUnico[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    const nomeOk = form.nome.trim().length > 0;
    setErroNome(nomeOk ? undefined : "Informe o nome do produto.");
    if (!nomeOk) return;

    setSalvando(true);
    try {
      await repo.salvarProduto({
        ...form,
        id,
        nome: form.nome.trim(),
        categoria: form.categoria?.trim() || undefined,
        detalhes: form.detalhes?.trim() || undefined,
        variacao: form.variacao?.trim() || undefined,
        valorUnit: lerNumeroBR(valorTexto) ?? 0,
      });
      toast.sucesso("Produto salvo.");
      navigate(-1);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o produto."));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!id || !produto) return;
    const ok = await confirmar({
      mensagem: `Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`,
      textoConfirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setExcluindo(true);
    try {
      await repo.removerProduto(id);
      const produtoApagado = produto;
      toast.acao("Produto excluído.", "Desfazer", () => {
        void repo.restaurarProduto(produtoApagado);
      });
      navigate("/produtos", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir o produto."));
      setExcluindo(false);
    }
  }

  return (
    <Tela titulo={id ? "Editar produto" : "Novo produto"} voltar={true} comBarraInferior>
      <Input
        rotulo="Nome"
        obrigatorio
        value={form.nome}
        erro={erroNome}
        onChange={(e) => campo("nome", e.target.value)}
      />
      <Input
        rotulo="Categoria"
        value={form.categoria ?? ""}
        onChange={(e) => campo("categoria", e.target.value)}
        ajuda="Usada pra agrupar vendas por categoria em Relatórios (opcional)."
      />
      <Input
        rotulo="Detalhes"
        value={form.detalhes ?? ""}
        onChange={(e) => campo("detalhes", e.target.value)}
        ajuda="Variação/observação da tabela de preços (opcional)."
      />
      <Input
        rotulo="Variação"
        value={form.variacao ?? ""}
        onChange={(e) => campo("variacao", e.target.value)}
        ajuda="Tamanho/tipo que não muda o preço (ex.: “#08”, “médio”) — some ao nome no Excel/PDF exportado (opcional)."
      />
      <Input
        rotulo="Embalagem"
        value={form.embalagem}
        onChange={(e) => campo("embalagem", e.target.value)}
      />
      <Input
        rotulo="Valor unitário (R$)"
        obrigatorio
        inputMode="decimal"
        value={valorTexto}
        onChange={(e) => setValorTexto(e.target.value)}
      />

      {id && (
        <Button variante="perigo" onClick={excluir} disabled={excluindo}>
          {excluindo ? "Excluindo…" : "Excluir produto"}
        </Button>
      )}

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar produto"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
