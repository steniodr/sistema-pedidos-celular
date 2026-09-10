import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Tela } from "../../components/ui/Layout";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { IconeCliente, IconeMarca, IconeProduto } from "../../components/ui/icones";
import { formatarData } from "../produtos/statusBase";

/** Hub das bases cadastráveis: Clientes, Produtos e Marcas. */
export function BasesPage() {
  const repo = useRepository();
  const navigate = useNavigate();

  const { dados } = useDados(async () => {
    const [clientes, totalProdutos, marcas, importacao] = await Promise.all([
      repo.listarClientes(),
      repo.contarProdutos(),
      repo.listarMarcas(),
      repo.obterUltimaImportacao(),
    ]);
    return { totalClientes: clientes.length, totalProdutos, totalMarcas: marcas.length, importacao };
  }, [repo]);

  const itens = [
    {
      titulo: "Clientes",
      rota: "/clientes",
      icone: <IconeCliente size={17} />,
      resumo: dados ? `${dados.totalClientes} cadastrado(s)` : "…",
    },
    {
      titulo: "Produtos",
      rota: "/produtos",
      icone: <IconeProduto size={17} />,
      resumo: dados
        ? dados.importacao
          ? `${dados.totalProdutos} · base de ${formatarData(dados.importacao.quandoEm)}`
          : `${dados.totalProdutos} cadastrado(s)`
        : "…",
    },
    {
      titulo: "Marcas",
      rota: "/marcas",
      icone: <IconeMarca size={17} />,
      resumo: dados ? `${dados.totalMarcas} cadastrada(s)` : "…",
    },
  ];

  return (
    // O título dizia "Importar bases", mas duas das três entradas não têm nada
    // a ver com importar — aqui é o lugar dos cadastros que alimentam o pedido.
    <Tela titulo="Cadastros" subtitulo="O que alimenta o pedido" voltar="/" capa>
      <div className="pilha">
        {itens.map((item) => (
          <LinhaLista
            key={item.rota}
            icone={item.icone}
            titulo={item.titulo}
            meta={item.resumo}
            onClick={() => navigate(item.rota)}
          />
        ))}
      </div>
    </Tela>
  );
}
