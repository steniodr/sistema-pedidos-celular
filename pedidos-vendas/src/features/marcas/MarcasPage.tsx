import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { BarraInferior, EstadoVazio, Tela } from "../../components/ui/Layout";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { Etiqueta } from "../../components/ui/Etiqueta";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { IconeBuscar, IconeMarca, IconeSomar } from "../../components/ui/icones";
import capaCss from "../../components/ui/redesenho.module.css";
import { normalizar } from "../../domain/texto";

/** Lista/busca de marcas cadastradas. Ponto de partida do cadastro que padroniza o cabeçalho do pedido. */
export function MarcasPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca);

  const { dados } = useDados(async () => {
    const [marcas, contagem] = await Promise.all([
      repo.listarMarcas(),
      repo.contarPedidosPorMarca(),
    ]);
    return { marcas, contagem };
  }, [repo]);

  const marcas = useMemo(() => {
    if (!dados) return dados;
    const alvo = normalizar(buscaDebounced);
    if (!alvo) return dados.marcas;
    return dados.marcas.filter((m) => normalizar(m.nome).includes(alvo));
  }, [dados, buscaDebounced]);


  return (
    <Tela
      titulo="Marcas"
      subtitulo={
        dados
          ? `${dados.marcas.length} ${dados.marcas.length === 1 ? "cadastrada" : "cadastradas"}`
          : undefined
      }
      voltar="/bases"
      capa
      comBarraInferior
      abaixoDoTitulo={
        // A lista de marcas costuma ser curta; a busca só aparece quando
        // realmente ajuda, em vez de ocupar espaço fixo no topo.
        (dados?.marcas.length ?? 0) > 6 ? (
          <div className={capaCss.capaBusca}>
            <span className={capaCss.capaBuscaIcone}>
              <IconeBuscar size={16} />
            </span>
            <input
              className={capaCss.capaBuscaCampo}
              aria-label="Buscar"
              placeholder="Nome da marca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoComplete="off"
            />
          </div>
        ) : undefined
      }
    >
      {!marcas ? (
        <Esqueleto linhas={3} />
      ) : marcas.length === 0 ? (
        <EstadoVazio
          titulo={busca ? "Nenhuma marca encontrada" : "Nenhuma marca cadastrada"}
          descricao="Cadastre as marcas para padronizar o cabeçalho do pedido e os Relatórios."
        />
      ) : (
        <div className="pilha">
          {marcas.map((marca) => (
            <LinhaLista
              key={marca.id}
              icone={<IconeMarca size={17} />}
              acento={marca.visivelEmRelatorios ? undefined : "alerta"}
              titulo={
                <>
                  {marca.nome}
                  {!marca.visivelEmRelatorios && (
                    <Etiqueta variante="alerta">fora dos relatórios</Etiqueta>
                  )}
                </>
              }
              meta={`${dados?.contagem.get(marca.id) ?? 0} pedido(s)`}
              onClick={() => navigate(`/marcas/${marca.id}`)}
            />
          ))}
        </div>
      )}

      <BarraInferior>
        <Button bloco onClick={() => navigate("/marcas/nova")}>
          <IconeSomar size={17} />
          Nova marca
        </Button>
      </BarraInferior>
    </Tela>
  );
}
