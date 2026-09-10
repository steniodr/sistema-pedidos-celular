import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { ZonaDeRisco } from "../../components/ui/ZonaDeRisco";
import {
  IconeEntrega,
  IconeExcluir,
  IconeLista,
  IconeProduto,
} from "../../components/ui/icones";
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
  const [erroValor, setErroValor] = useState<string | undefined>();
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

  /** `null` só quando o texto é um número válido maior que zero. */
  function validarValor(texto: string): string | undefined {
    const numero = lerNumeroBR(texto);
    if (numero === null) return "Informe um valor numérico (ex.: 95,64).";
    if (numero <= 0) return "O valor precisa ser maior que zero.";
    return undefined;
  }

  async function salvar() {
    const nomeOk = form.nome.trim().length > 0;
    setErroNome(nomeOk ? undefined : "Informe o nome do produto.");

    const erroValorAtual = validarValor(valorTexto);
    setErroValor(erroValorAtual);

    if (!nomeOk || erroValorAtual) return;

    setSalvando(true);
    try {
      await repo.salvarProduto({
        ...form,
        id,
        nome: form.nome.trim(),
        categoria: form.categoria?.trim() || undefined,
        detalhes: form.detalhes?.trim() || undefined,
        variacao: form.variacao?.trim() || undefined,
        // validarValor já garantiu que é um número > 0 — lerNumeroBR aqui
        // nunca deveria devolver null, mas o fallback evita salvar NaN/undefined
        // se esse invariante mudar no futuro.
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
    <Tela
      titulo={id ? form.nome || "Editar produto" : "Novo produto"}
      subtitulo="Base de produtos"
      voltar={true}
      capa
      comBarraInferior
    >
      <Painel titulo="Produto" icone={<IconeProduto size={17} />}>
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
          ajuda="Agrupa as vendas por categoria em Relatórios (opcional)."
        />
      </Painel>

      {/* "Detalhes" e "Variação" eram dois campos livres vizinhos que só se
          distinguiam por um parágrafo de ajuda. Agora vêm juntos, com exemplo
          no próprio campo e a diferença dita numa linha só. */}
      <Painel titulo="Variante" icone={<IconeLista size={17} />}>
        <Input
          rotulo="Detalhes"
          placeholder="Ex.: exceto amarelo, laranja e vermelho"
          value={form.detalhes ?? ""}
          onChange={(e) => campo("detalhes", e.target.value)}
        />
        <Input
          rotulo="Variação"
          placeholder="Ex.: #08, médio"
          value={form.variacao ?? ""}
          onChange={(e) => campo("variacao", e.target.value)}
        />
        <p className="texto-suave">
          <strong>Detalhes</strong> distingue produtos de preços diferentes.{" "}
          <strong>Variação</strong> é tamanho/tipo que não muda o preço e some ao nome no
          Excel/PDF.
        </p>
      </Painel>

      <Painel titulo="Embalagem e preço" icone={<IconeEntrega size={17} />}>
        <Input
          rotulo="Embalagem"
          placeholder="Ex.: Galão 3,6 L"
          value={form.embalagem}
          onChange={(e) => campo("embalagem", e.target.value)}
        />
        <Input
          rotulo="Valor unitário (R$)"
          obrigatorio
          inputMode="decimal"
          value={valorTexto}
          erro={erroValor}
          onChange={(e) => setValorTexto(e.target.value)}
          onBlur={() => setErroValor(validarValor(valorTexto))}
        />
      </Painel>

      {id && (
        <ZonaDeRisco descricao="Pedidos já feitos guardam o nome e o preço do produto, então não mudam.">
          <Button variante="perigo" onClick={excluir} disabled={excluindo}>
            <IconeExcluir size={16} />
            {excluindo ? "Excluindo…" : "Excluir produto"}
          </Button>
        </ZonaDeRisco>
      )}

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar produto"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
