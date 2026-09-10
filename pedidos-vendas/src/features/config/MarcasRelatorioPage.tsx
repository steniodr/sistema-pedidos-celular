import { useEffect, useMemo, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Checkbox, Input } from "../../components/ui/Field";
import { EstadoVazio, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { IconeLista, IconeMarca, IconeOk } from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
import type { GrupoMarca, Marca } from "../../domain/types";
import ui from "../../components/ui/ui.module.css";
import css from "./marcasRelatorio.module.css";

/** Configura quais marcas entram nos relatórios e monta grupos/tags de marcas. */
export function MarcasRelatorioPage() {
  const repo = useRepository();
  const toast = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState("");
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState("");

  const { dados, carregando, recarregar } = useDados(async () => {
    const [marcas, grupos] = await Promise.all([
      repo.listarMarcas(),
      repo.listarGruposMarca(),
    ]);
    return { marcas, grupos };
  }, [repo]);

  const marcas = dados?.marcas ?? [];
  const visiveis = marcas.filter((m) => m.visivelEmRelatorios).length;

  const marcasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return marcas;
    return marcas.filter((m) => m.nome.toLowerCase().includes(termo));
  }, [marcas, busca]);

  async function alternarVisibilidade(marca: Marca, visivel: boolean) {
    try {
      await repo.salvarMarca({
        id: marca.id,
        nome: marca.nome,
        teste: marca.teste,
        visivelEmRelatorios: visivel,
      });
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível atualizar a marca."));
    }
  }

  /**
   * Marcar/desmarcar todas de uma vez. Com 20 marcas, o único caminho era 20
   * toques — e o caso comum é "só quero ver uma empresa".
   */
  async function definirTodas(visivel: boolean) {
    const alvo = marcasFiltradas.filter((m) => m.visivelEmRelatorios !== visivel);
    if (alvo.length === 0) return;
    try {
      for (const m of alvo) {
        await repo.salvarMarca({
          id: m.id,
          nome: m.nome,
          teste: m.teste,
          visivelEmRelatorios: visivel,
        });
      }
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível atualizar as marcas."));
    }
  }

  async function salvarGrupo(grupo: GrupoMarca) {
    try {
      await repo.salvarGrupoMarca(grupo);
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o grupo."));
    }
  }

  async function removerGrupo(id: string) {
    if (
      !(await confirmar({ mensagem: "Remover este grupo?", textoConfirmar: "Remover", perigo: true }))
    )
      return;
    try {
      await repo.removerGrupoMarca(id);
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível remover o grupo."));
    }
  }

  /**
   * O grupo só nasce quando tem nome. Antes, "+ Novo grupo" gravava na hora um
   * registro chamado "Novo grupo" — sair da tela deixava o lixo salvo.
   */
  async function confirmarNovoGrupo() {
    const nome = nomeNovoGrupo.trim();
    if (!nome) return;
    await salvarGrupo({ id: crypto.randomUUID(), nome, marcaIds: [] });
    setNomeNovoGrupo("");
    setCriandoGrupo(false);
  }

  return (
    <Tela
      titulo="Marcas nos relatórios"
      subtitulo={
        marcas.length > 0 ? `${visiveis} de ${marcas.length} marcas nos totais` : undefined
      }
      voltar="/config"
      capa
    >
      <Painel
        titulo="Marcas visíveis"
        icone={<IconeMarca size={17} />}
        contador={marcas.length > 0 ? `${visiveis} de ${marcas.length}` : undefined}
      >
        <p className="texto-suave">
          Marcas desligadas não entram em nenhum total de Relatórios, nem em “Tudo”.
        </p>

        {marcas.length > 6 && (
          <Input
            rotulo="Buscar marca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome da marca"
          />
        )}

        {carregando ? (
          <Esqueleto linhas={4} />
        ) : marcas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma marca cadastrada" />
        ) : (
          <>
            <div className={css.acoesMassa}>
              <Button variante="fantasma" onClick={() => definirTodas(true)}>
                Marcar todas
              </Button>
              <Button variante="fantasma" onClick={() => definirTodas(false)}>
                Desmarcar todas
              </Button>
            </div>
            <div className={css.marcasGrid}>
              {marcasFiltradas.map((m) => (
                <Checkbox
                  key={m.id}
                  rotulo={m.nome}
                  checked={m.visivelEmRelatorios}
                  onChange={(v) => alternarVisibilidade(m, v)}
                />
              ))}
            </div>
            {marcasFiltradas.length === 0 && (
              <p className="texto-suave">Nenhuma marca encontrada para “{busca}”.</p>
            )}
          </>
        )}
      </Painel>

      <Painel
        titulo="Grupos"
        icone={<IconeLista size={17} />}
        contador={dados?.grupos.length ? String(dados.grupos.length) : undefined}
      >
        <p className="texto-suave">
          Um grupo reúne marcas (ex.: “Empresa A”) para você filtrar o relatório por
          conjunto, sem marcar uma a uma toda vez.
        </p>

        {dados?.grupos.map((g) => (
          <EditorGrupo
            key={g.id}
            grupo={g}
            marcas={marcas}
            onSalvar={salvarGrupo}
            onRemover={() => removerGrupo(g.id)}
          />
        ))}

        {criandoGrupo ? (
          <div className={css.novoGrupo}>
            <Input
              rotulo="Nome do novo grupo"
              value={nomeNovoGrupo}
              autoFocus
              onChange={(e) => setNomeNovoGrupo(e.target.value)}
              placeholder="Ex.: Empresa A"
            />
            <div className={css.grupoAcoes}>
              <Button
                variante="secundario"
                onClick={() => {
                  setCriandoGrupo(false);
                  setNomeNovoGrupo("");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={confirmarNovoGrupo} disabled={!nomeNovoGrupo.trim()}>
                Criar grupo
              </Button>
            </div>
          </div>
        ) : (
          <Button variante="secundario" bloco onClick={() => setCriandoGrupo(true)}>
            Novo grupo
          </Button>
        )}
      </Painel>
    </Tela>
  );
}

function EditorGrupo({
  grupo,
  marcas,
  onSalvar,
  onRemover,
}: {
  grupo: GrupoMarca;
  marcas: Marca[];
  onSalvar: (g: GrupoMarca) => void;
  onRemover: () => void;
}) {
  const [nome, setNome] = useState(grupo.nome);
  useEffect(() => setNome(grupo.nome), [grupo.nome]);

  const escolhidas = grupo.marcaIds.length;

  return (
    <div className={css.grupo}>
      <Input
        rotulo="Nome do grupo"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome.trim() && nome !== grupo.nome && onSalvar({ ...grupo, nome: nome.trim() })}
      />
      {/* Chips do vocabulário único (modo "multi": contorno + visto), no lugar
          da cópia local que existia neste módulo. */}
      <div className={ui.chips}>
        {marcas.map((m) => {
          const ativo = grupo.marcaIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={[ui.chip, ui["chip--multi"], ativo ? ui["chip--ativo"] : ""]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={ativo}
              onClick={() =>
                onSalvar({
                  ...grupo,
                  marcaIds: ativo
                    ? grupo.marcaIds.filter((id) => id !== m.id)
                    : [...grupo.marcaIds, m.id],
                })
              }
            >
              {ativo && <IconeOk size={13} />}
              {m.nome}
            </button>
          );
        })}
      </div>
      <div className={css.grupoAcoes}>
        <span className="texto-suave">
          {escolhidas === 0 ? "Nenhuma marca no grupo" : `${escolhidas} marca(s)`}
        </span>
        <Button variante="fantasma" onClick={onRemover}>
          Remover grupo
        </Button>
      </div>
    </div>
  );
}
