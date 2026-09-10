import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Checkbox, Input } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { ZonaDeRisco } from "../../components/ui/ZonaDeRisco";
import { IconeExcluir, IconeMarca, IconeRelatorios } from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
import { definirParametro } from "../../domain/rotas";
import { normalizar } from "../../domain/texto";

/**
 * Cadastro de marca. Quando chamada com `?retorno=<rota>`, volta para o fluxo
 * do pedido com `&marcaId=` anexado — atalho "+ Cadastrar nova marca".
 */
export function MarcaFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const { id } = useParams();
  const [params] = useSearchParams();
  const retorno = params.get("retorno");

  const [nome, setNome] = useState("");
  const [visivelEmRelatorios, setVisivel] = useState(true);
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const { dados } = useDados(async () => {
    const [marca, todas] = await Promise.all([
      id ? repo.obterMarca(id) : Promise.resolve(undefined),
      repo.listarMarcas({ incluirTeste: true }),
    ]);
    return { marca, todas };
  }, [repo, id]);

  useEffect(() => {
    if (dados?.marca) {
      setNome(dados.marca.nome);
      setVisivel(dados.marca.visivelEmRelatorios);
    }
  }, [dados?.marca]);

  async function salvar() {
    const limpo = nome.trim();
    if (!limpo) {
      setErroNome("Informe o nome da marca.");
      return;
    }
    const duplicada = (dados?.todas ?? []).some(
      (m) => m.id !== id && normalizar(m.nome) === normalizar(limpo),
    );
    if (duplicada) {
      setErroNome("Já existe uma marca com esse nome.");
      return;
    }

    setSalvando(true);
    try {
      const salva = await repo.salvarMarca({ id, nome: limpo, visivelEmRelatorios });
      toast.sucesso("Marca salva.");
      if (retorno) {
        navigate(definirParametro(retorno, "marcaId", salva.id), { replace: true });
      } else {
        navigate(-1);
      }
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar a marca."));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!id || !dados?.marca) return;
    const vinculados = await repo.listarPedidos({ marca: dados.marca.nome });
    const aviso =
      vinculados.length > 0
        ? `Esta marca está em ${vinculados.length} pedido(s). Os pedidos continuam existindo com o nome da marca, mas ela some do cadastro e dos filtros. Excluir mesmo assim?`
        : `Excluir a marca "${dados.marca.nome}"? Esta ação não pode ser desfeita.`;
    if (!(await confirmar({ mensagem: aviso, textoConfirmar: "Excluir", perigo: true }))) return;

    setExcluindo(true);
    try {
      await repo.removerMarca(id);
      toast.sucesso("Marca excluída.");
      navigate("/marcas", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível excluir a marca."));
      setExcluindo(false);
    }
  }

  return (
    <Tela
      titulo={id ? nome || "Editar marca" : "Nova marca"}
      subtitulo="Marcas"
      voltar={true}
      capa
      comBarraInferior
    >
      <Painel titulo="Marca" icone={<IconeMarca size={17} />}>
        <Input
          rotulo="Nome da marca"
          obrigatorio
          placeholder="Ex.: ARARA AZUL"
          value={nome}
          erro={erroNome}
          onChange={(e) => {
            setNome(e.target.value);
            if (erroNome) setErroNome(undefined);
          }}
          autoCapitalize="characters"
          ajuda="Aparece no cabeçalho da planilha e nos filtros de Relatórios."
        />
      </Painel>

      <Painel titulo="Relatórios" icone={<IconeRelatorios size={17} />}>
        <Checkbox
          rotulo="Aparece nos relatórios"
          checked={visivelEmRelatorios}
          onChange={setVisivel}
          ajuda="Desligada, a marca não entra em nenhum total de Relatórios, nem em “Tudo”."
        />
      </Painel>

      {id && (
        <ZonaDeRisco descricao="Os pedidos continuam existindo com o nome da marca, mas ela some do cadastro e dos filtros.">
          <Button variante="perigo" onClick={excluir} disabled={excluindo}>
            <IconeExcluir size={16} />
            {excluindo ? "Excluindo…" : "Excluir marca"}
          </Button>
        </ZonaDeRisco>
      )}

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar marca"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
