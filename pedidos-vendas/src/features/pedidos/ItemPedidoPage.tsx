import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Checkbox, Input, Textarea } from "../../components/ui/Field";
import { BarraInferior, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, lerNumeroBR, totalItem } from "../../domain/calculos";
import { mensagemErro } from "../../domain/erros";
import type { ItemPedido, Produto } from "../../domain/types";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

const OUTRO = "__outro__";

export function ItemPedidoPage() {
  const { id, indice } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  const toast = useToast();
  const { pedido, carregando, atualizar } = usePedido(id);

  const editando = indice !== "novo";
  const posicao = editando ? Number(indice) : -1;

  // Etapa 1: nome do produto.
  const [busca, setBusca] = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState<string | null>(null);

  // Etapa 2: variante (detalhes), só quando o produto tem mais de uma.
  const [variantes, setVariantes] = useState<Produto[]>([]);
  const [detalheEscolhido, setDetalheEscolhido] = useState<string | null>(null);

  // Etapa 2b: variação (tamanho/tipo, ex.: "#08", "médio") — independente de
  // detalhes, só quando o grupo de detalhes escolhido tem mais de uma.
  const [variacaoEscolhida, setVariacaoEscolhida] = useState<string | null>(null);

  // Etapa 3: embalagem.
  const [embalagem, setEmbalagem] = useState("");
  const [embalagemOutro, setEmbalagemOutro] = useState(false);

  // Nome customizado só para o Excel/PDF — não muda o nome na base nem afeta
  // embalagem/preço, que continuam vindos do produto escolhido normalmente.
  const [alterarNomeExportado, setAlterarNomeExportado] = useState(false);
  const [nomeExportado, setNomeExportado] = useState("");

  // Demais campos do item.
  const [cor, setCor] = useState("");
  const [padraoComplemento, setPadraoComplemento] = useState("");
  const [descricaoLivre, setDescricaoLivre] = useState("");
  const [comDesconto, setComDesconto] = useState(false);
  const [qtdTexto, setQtdTexto] = useState("1");
  const [valorTexto, setValorTexto] = useState("");
  const [erroQtd, setErroQtd] = useState<string | undefined>();
  const [erroValorUnit, setErroValorUnit] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    if (editando) {
      const existente = pedido.itens[posicao];
      if (existente) {
        const nome = existente.nomeProduto ?? existente.descricaoProduto;
        setBusca(nome);
        setNomeConfirmado(nome);
        setDetalheEscolhido(existente.detalhesProduto ?? "");
        setVariacaoEscolhida(existente.variacaoProduto ?? "");
        setAlterarNomeExportado(!!existente.nomeExportado);
        setNomeExportado(existente.nomeExportado ?? "");
        setEmbalagem(existente.embalagem);
        setCor(existente.cor ?? "");
        setPadraoComplemento(existente.padraoComplemento ?? "");
        setDescricaoLivre(existente.descricao ?? "");
        setComDesconto(existente.comDesconto ?? false);
        setQtdTexto(String(existente.qtd));
        setValorTexto(String(existente.valorUnit).replace(".", ","));
        // Só para popular as opções de embalagem; a variante já veio do item salvo.
        void repo.listarVariantesPorNome(nome).then(setVariantes);
      }
    }
  }, [pedido, editando, posicao, repo]);

  // Etapa 1 — busca de nomes distintos na base, só depois de 2 caracteres e
  // enquanto o produto ainda não foi confirmado.
  const termoBusca = busca.trim().length >= 2 && busca !== nomeConfirmado ? busca : "";
  const { dados: nomesEncontrados } = useDados(
    async () => (termoBusca ? repo.listarNomesProdutos(termoBusca, 15) : []),
    [repo, termoBusca],
  );

  // Etapa 2 — variantes (linhas da base com o mesmo nome) do produto escolhido.
  // Busca feita diretamente aqui (não via useDados) para poder decidir se precisa
  // perguntar a variante usando o resultado fresco, sem depender de um efeito
  // reativo separado — evita a corrida em que o auto-resolve rodava com os
  // "variantes" ainda da busca anterior antes do fetch novo terminar.
  async function escolherNome(nome: string) {
    setBusca(nome);
    setNomeConfirmado(nome);
    setEmbalagem("");
    setEmbalagemOutro(false);
    setValorTexto("");
    setErroValorUnit(undefined);
    setDetalheEscolhido(null);
    setVariacaoEscolhida(null);
    setAlterarNomeExportado(false);
    setNomeExportado("");
    setVariantes([]);

    const lista = await repo.listarVariantesPorNome(nome);
    setVariantes(lista);
    const grupos = [...new Set(lista.map((v) => v.detalhes ?? ""))];
    if (grupos.length <= 1) {
      resolverVariante(grupos[0] ?? "", lista);
    } else {
      setDetalheEscolhido(null);
      setVariacaoEscolhida(null);
    }
  }

  // Resolve a variante (detalhes) escolhida e, a partir dela, já auto-resolve
  // a variação (tamanho/tipo) quando o grupo tiver só uma — ou deixa null pra
  // pedir escolha, mesmo padrão de `escolherNome` acima pra detalhes.
  function resolverVariante(detalhe: string, listaVariantes: Produto[]) {
    setDetalheEscolhido(detalhe);
    const gruposVariacao = [
      ...new Set(
        listaVariantes.filter((v) => (v.detalhes ?? "") === detalhe).map((v) => v.variacao ?? ""),
      ),
    ];
    setVariacaoEscolhida(gruposVariacao.length <= 1 ? (gruposVariacao[0] ?? "") : null);
  }

  function campoNomeAlterado(valor: string) {
    setBusca(valor);
    setNomeConfirmado(null);
    setDetalheEscolhido(null);
    setVariacaoEscolhida(null);
    setAlterarNomeExportado(false);
    setNomeExportado("");
    setEmbalagem("");
    setEmbalagemOutro(false);
    setVariantes([]);
  }

  const gruposDetalhes = useMemo(
    () => [...new Set(variantes.map((v) => v.detalhes ?? ""))],
    [variantes],
  );

  const precisaEscolherVariante = gruposDetalhes.length > 1 && detalheEscolhido === null;

  const gruposVariacao = useMemo(() => {
    if (detalheEscolhido === null) return [];
    return [
      ...new Set(
        variantes.filter((v) => (v.detalhes ?? "") === detalheEscolhido).map((v) => v.variacao ?? ""),
      ),
    ];
  }, [variantes, detalheEscolhido]);

  const precisaEscolherVariacao =
    !precisaEscolherVariante && gruposVariacao.length > 1 && variacaoEscolhida === null;

  // Etapa 3 — embalagens disponíveis para a variante/variação escolhidas.
  const opcoesEmbalagem = useMemo(() => {
    if (detalheEscolhido === null || precisaEscolherVariacao) return [];
    return (variantes ?? [])
      .filter(
        (v) =>
          (v.detalhes ?? "") === detalheEscolhido &&
          (v.variacao ?? "") === (variacaoEscolhida ?? "") &&
          v.embalagem,
      )
      .map((v) => ({ embalagem: v.embalagem, valorUnit: v.valorUnit }));
  }, [variantes, detalheEscolhido, variacaoEscolhida, precisaEscolherVariacao]);

  function escolherEmbalagem(valor: string) {
    if (valor === OUTRO) {
      setEmbalagemOutro(true);
      setEmbalagem("");
      return;
    }
    setEmbalagemOutro(false);
    setEmbalagem(valor);
    const correspondente = opcoesEmbalagem.find((o) => o.embalagem === valor);
    if (correspondente) {
      setValorTexto(String(correspondente.valorUnit).replace(".", ","));
      // O preço veio do catálogo, não do que o vendedor tinha digitado antes —
      // um erro de validação de uma tentativa anterior não se aplica mais.
      setErroValorUnit(undefined);
    }
  }

  function alternarComDesconto(valor: boolean) {
    setComDesconto(valor);
    // Só sugere o texto se o vendedor ainda não escreveu nada — não sobrescreve
    // um complemento já digitado. Vai em "Padrão / Complemento" (não na
    // observação livre) porque esse campo aparece no Excel/PDF exportado.
    if (valor && !padraoComplemento.trim()) setPadraoComplemento("Valor promocional");
  }

  function ajustarQtd(delta: number) {
    const atual = lerNumeroBR(qtdTexto) ?? 0;
    const novo = Math.max(1, atual + delta);
    setQtdTexto(String(novo).replace(".", ","));
    setErroQtd(undefined);
  }

  function validarNumeroPositivo(texto: string): string | undefined {
    const numero = lerNumeroBR(texto);
    if (numero === null) return "Informe um número válido.";
    if (numero <= 0) return "Precisa ser maior que zero.";
    return undefined;
  }

  const qtd = lerNumeroBR(qtdTexto) ?? 0;
  const valorUnit = lerNumeroBR(valorTexto) ?? 0;
  const previa = totalItem({ qtd, valorUnit });
  const nomeFinal = (nomeConfirmado ?? busca).trim();
  const valido =
    nomeFinal.length > 0 &&
    qtd > 0 &&
    embalagem.trim().length > 0 &&
    valorUnit > 0 &&
    !precisaEscolherVariante &&
    !precisaEscolherVariacao &&
    (!alterarNomeExportado || nomeExportado.trim().length > 0);

  function alternarAlterarNomeExportado(valor: boolean) {
    setAlterarNomeExportado(valor);
    // Pré-preenche com o nome atual só ao marcar a primeira vez — não
    // sobrescreve um texto que o vendedor já ajustou e desmarcou/marcou de novo.
    if (valor && !nomeExportado.trim()) setNomeExportado(nomeFinal);
  }

  async function salvar() {
    if (!pedido || !valido) return;
    setSalvando(true);
    try {
      const detalhesFinal = detalheEscolhido || "";
      const item: ItemPedido = {
        item: 0, // renumerado abaixo
        qtd,
        valorUnit,
        embalagem,
        descricaoProduto: detalhesFinal ? `${nomeFinal} (${detalhesFinal})` : nomeFinal,
        nomeProduto: nomeFinal,
        detalhesProduto: detalhesFinal || undefined,
        variacaoProduto: variacaoEscolhida || undefined,
        nomeExportado: alterarNomeExportado ? nomeExportado.trim() || undefined : undefined,
        cor: cor || undefined,
        padraoComplemento: padraoComplemento || undefined,
        descricao: descricaoLivre || undefined,
        comDesconto: comDesconto || undefined,
      };
      const itens = editando
        ? pedido.itens.map((atual, i) => (i === posicao ? item : atual))
        : [...pedido.itens, item];
      await atualizar({ itens: itens.map((it, i) => ({ ...it, item: i + 1 })) });
      navigate(`/pedidos/${pedido.id}`, { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o item."));
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <Tela titulo="Item" voltar={true}>
        <p className="texto-suave">Carregando…</p>
      </Tela>
    );
  }
  if (!pedido) {
    return (
      <Tela titulo="Item" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  return (
    <Tela titulo={editando ? "Editar item" : "Adicionar item"} voltar={true} comBarraInferior>
      <Input
        rotulo="Produto"
        obrigatorio
        placeholder="Digite para buscar na base"
        value={busca}
        onChange={(e) => campoNomeAlterado(e.target.value)}
        autoComplete="off"
        ajuda="Se o produto não estiver na base, digite o nome livremente."
      />

      {termoBusca && (
        <div className={css.buscaProduto}>
          {nomesEncontrados?.map((nome) => (
            <button
              key={nome}
              type="button"
              className={css.buscaResultado}
              onClick={() => escolherNome(nome)}
            >
              <span>{nome}</span>
            </button>
          ))}
          {(nomesEncontrados?.length ?? 0) === 0 && (
            <button
              type="button"
              className={css.buscaResultado}
              onClick={() => escolherNome(busca.trim())}
            >
              <span>Usar “{busca.trim()}”</span>
            </button>
          )}
        </div>
      )}

      {precisaEscolherVariante && (
        <div className="pilha pilha--apertada">
          <span className="secao-titulo">Qual variante?</span>
          <div className={css.buscaProduto}>
            {gruposDetalhes.map((detalhe) => (
              <button
                key={detalhe}
                type="button"
                className={css.buscaResultado}
                onClick={() => resolverVariante(detalhe, variantes)}
              >
                <span>{detalhe || "Padrão"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {detalheEscolhido && <Input rotulo="Detalhes" value={detalheEscolhido} readOnly />}

      {precisaEscolherVariacao && (
        <div className="pilha pilha--apertada">
          <span className="secao-titulo">Qual variação?</span>
          <div className={css.buscaProduto}>
            {gruposVariacao.map((variacao) => (
              <button
                key={variacao}
                type="button"
                className={css.buscaResultado}
                onClick={() => setVariacaoEscolhida(variacao)}
              >
                <span>{variacao || "Padrão"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {variacaoEscolhida && <Input rotulo="Variação" value={variacaoEscolhida} readOnly />}

      {nomeConfirmado && !precisaEscolherVariante && !precisaEscolherVariacao && (
        <>
          <Checkbox
            rotulo="Alterar nome final do produto"
            checked={alterarNomeExportado}
            onChange={alternarAlterarNomeExportado}
            ajuda="Só muda o texto que sai no Excel/PDF — a base de produtos não é alterada."
          />
          {alterarNomeExportado && (
            <Input
              rotulo="Nome final do produto"
              obrigatorio
              value={nomeExportado}
              onChange={(e) => setNomeExportado(e.target.value)}
            />
          )}
        </>
      )}

      {nomeConfirmado && !precisaEscolherVariante && !precisaEscolherVariacao && opcoesEmbalagem.length > 0 && (
        <div className="pilha pilha--apertada">
          <span className="secao-titulo">
            Embalagem<span className="texto-erro"> *</span>
          </span>
          <Chips
            opcoes={[...opcoesEmbalagem.map((o) => o.embalagem), OUTRO]}
            valor={embalagemOutro ? OUTRO : embalagem}
            onChange={escolherEmbalagem}
            rotulos={{ [OUTRO]: "Outro" }}
          />
        </div>
      )}

      {(embalagemOutro ||
        (nomeConfirmado &&
          !precisaEscolherVariante &&
          !precisaEscolherVariacao &&
          opcoesEmbalagem.length === 0) ||
        !nomeConfirmado) && (
        <Input
          rotulo="Embalagem"
          obrigatorio
          value={embalagem}
          onChange={(e) => setEmbalagem(e.target.value)}
        />
      )}

      <Input rotulo="Cor" value={cor} onChange={(e) => setCor(e.target.value)} />
      <Input
        rotulo="Padrão / Complemento"
        value={padraoComplemento}
        onChange={(e) => setPadraoComplemento(e.target.value)}
      />
      <div className={css.campoComStepper}>
        <Button
          variante="secundario"
          className={css.botaoStepper}
          onClick={() => ajustarQtd(-1)}
          aria-label="Diminuir quantidade"
        >
          −
        </Button>
        <Input
          rotulo="Quantidade"
          obrigatorio
          inputMode="decimal"
          value={qtdTexto}
          erro={erroQtd}
          onChange={(e) => setQtdTexto(e.target.value)}
          onBlur={() => setErroQtd(validarNumeroPositivo(qtdTexto))}
        />
        <Button
          variante="secundario"
          className={css.botaoStepper}
          onClick={() => ajustarQtd(1)}
          aria-label="Aumentar quantidade"
        >
          +
        </Button>
      </div>
      <Checkbox
        rotulo="Item com desconto (valor promocional)"
        checked={comDesconto}
        onChange={alternarComDesconto}
        ajuda="Fica de fora do desconto geral do pedido, calculado em Resumo."
      />
      <Input
        rotulo="Valor unitário (R$)"
        obrigatorio
        inputMode="decimal"
        value={valorTexto}
        erro={erroValorUnit}
        onChange={(e) => setValorTexto(e.target.value)}
        onBlur={() => setErroValorUnit(validarNumeroPositivo(valorTexto))}
      />
      <Textarea
        rotulo="Observação do item"
        value={descricaoLivre}
        onChange={(e) => setDescricaoLivre(e.target.value)}
        ajuda="Campo livre, não substitui a descrição do produto."
      />

      <BarraInferior>
        <div className={css.totalBarra}>
          <span className="texto-suave">Total do item</span>
          <span className={css.totalValor}>{formatarMoeda(previa)}</span>
        </div>
        <Button onClick={salvar} disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar item"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
