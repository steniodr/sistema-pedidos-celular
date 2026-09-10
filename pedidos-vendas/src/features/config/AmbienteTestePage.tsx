import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { ZonaDeRisco } from "../../components/ui/ZonaDeRisco";
import {
  IconeCliente,
  IconeExcluir,
  IconeNovoPedido,
  IconeRelatorios,
  IconeTeste,
} from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { useRepository } from "../../data/RepositoryContext";
import { mensagemErro } from "../../domain/erros";
import { semearClientesTeste } from "../clientes/clientesTeste";
import { gerarPedidosTeste } from "../pedidos/pedidosTeste";
import { gerarRelatorioTeste } from "../relatorios/relatoriosTeste";

/** Tudo relacionado a dados de teste num lugar só (antes espalhado em Configurações). */
export function AmbienteTestePage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function rodar(chave: string, acao: () => Promise<void>) {
    setOcupado(chave);
    try {
      await acao();
    } finally {
      setOcupado(null);
    }
  }

  async function criarClientesTeste() {
    await rodar("clientes", async () => {
      try {
        const criados = await semearClientesTeste(repo);
        toast.sucesso(
          criados > 0
            ? `${criados} cliente(s) de teste criado(s).`
            : "Os clientes de teste já existem.",
        );
      } catch (e) {
        toast.erro(mensagemErro(e, "Não foi possível criar os clientes de teste."));
      }
    });
  }

  async function criarPedidosTeste() {
    await rodar("pedidos", async () => {
      try {
        const criados = await gerarPedidosTeste(repo);
        toast.sucesso(`${criados} pedido(s) de teste criado(s) para validar os Relatórios.`);
      } catch (e) {
        toast.erro(mensagemErro(e, "Não foi possível criar os pedidos de teste."));
      }
    });
  }

  async function criarRelatorioTeste() {
    await rodar("relatorio", async () => {
      try {
        const criados = await gerarRelatorioTeste(repo);
        toast.sucesso(`${criados} pedido(s) de teste criados em 3 marcas, por semana e mês.`);
      } catch (e) {
        toast.erro(mensagemErro(e, "Não foi possível criar os dados de Relatório de teste."));
      }
    });
  }

  async function removerDadosTeste() {
    const ok = await confirmar({
      mensagem:
        "Remove todos os clientes, pedidos e marcas marcados como teste (criados pelos botões acima). Dados reais não são afetados. Continuar?",
      textoConfirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    await rodar("remover", async () => {
      try {
        const r = await repo.removerDadosTeste();
        toast.sucesso(
          `${r.clientes} cliente(s), ${r.pedidos} pedido(s) e ${r.marcas} marca(s) de teste removidos.`,
        );
      } catch (e) {
        toast.erro(mensagemErro(e, "Não foi possível remover os dados de teste."));
      }
    });
  }

  /** Mesma linha, com o texto virando "Criando…" enquanto a ação roda. */
  function linhaCriar(
    chave: string,
    icone: React.ReactNode,
    titulo: string,
    meta: string,
    acao: () => void,
  ) {
    return (
      <LinhaLista
        icone={icone}
        titulo={ocupado === chave ? "Criando…" : titulo}
        meta={meta}
        fim={<span />}
        onClick={acao}
      />
    );
  }

  return (
    // Antes: quatro parágrafos longos alternando com botões "secundário"
    // idênticos, sem dizer qual criava e qual apagava.
    <Tela
      titulo="Ambiente de teste"
      subtitulo="Dados fictícios, nunca somados aos reais"
      voltar="/config"
      capa
    >
      <Painel titulo="Criar dados" icone={<IconeTeste size={17} />}>
        {linhaCriar(
          "clientes",
          <IconeCliente size={17} />,
          "Clientes de teste",
          "2 clientes de exemplo, com “(teste)” no nome",
          criarClientesTeste,
        )}
        {linhaCriar(
          "pedidos",
          <IconeNovoPedido size={17} />,
          "Pedidos de teste",
          "Pedidos espalhados em semanas e meses, só nos clientes de teste",
          criarPedidosTeste,
        )}
        {linhaCriar(
          "relatorio",
          <IconeRelatorios size={17} />,
          "Dados de Relatório",
          "Base maior em 3 marcas (“Teste 1/2/3”) para ver a tela com conteúdo",
          criarRelatorioTeste,
        )}
      </Painel>

      <Painel titulo="Conferir" icone={<IconeRelatorios size={17} />}>
        <LinhaLista
          icone={<IconeRelatorios size={17} />}
          titulo="Abrir Relatório de teste"
          meta="O seletor Reais / Teste no topo da tela mostra só o que é fictício"
          onClick={() => navigate("/relatorios/teste")}
        />
      </Painel>

      {/* Remover apaga dados — antes era um botão vermelho encostado nos de criar. */}
      <ZonaDeRisco descricao="Remove de uma vez tudo criado aqui: clientes, pedidos e marcas marcados como teste. Dados reais não são afetados.">
        <Button variante="perigo" onClick={removerDadosTeste} disabled={ocupado === "remover"}>
          <IconeExcluir size={16} />
          {ocupado === "remover" ? "Removendo…" : "Remover dados de teste"}
        </Button>
      </ZonaDeRisco>
    </Tela>
  );
}
