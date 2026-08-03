import { useRef, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button, LinkButton } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
import type { BackupDados } from "../../data/repository";
import { semearClientesTeste } from "../clientes/clientesTeste";
import { gerarPedidosTeste } from "../pedidos/pedidosTeste";
import { avaliarBase, formatarDataHora } from "../produtos/statusBase";
import { baixarArquivo } from "../export/dadosExportacao";
import { verificarAtualizacoesAgora } from "../../pwa";
import { VERSAO_APP } from "../../versaoApp";

export function ConfigPage() {
  const repo = useRepository();
  const toast = useToast();
  const confirmar = useConfirm();
  const [semeando, setSemeando] = useState(false);
  const [semeandoPedidos, setSemeandoPedidos] = useState(false);
  const [removendoTeste, setRemovendoTeste] = useState(false);
  const [gerandoBackup, setGerandoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const inputBackup = useRef<HTMLInputElement>(null);

  const { dados: representante } = useDados(() => repo.obterRepresentante(), [repo]);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);

  async function criarClientesTeste() {
    setSemeando(true);
    try {
      const criados = await semearClientesTeste(repo);
      toast.sucesso(
        criados > 0
          ? `${criados} cliente(s) de teste criado(s).`
          : "Os clientes de teste já existem.",
      );
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível criar os clientes de teste."));
    } finally {
      setSemeando(false);
    }
  }

  async function criarPedidosTeste() {
    setSemeandoPedidos(true);
    try {
      const criados = await gerarPedidosTeste(repo);
      toast.sucesso(`${criados} pedido(s) de teste criado(s) para validar os Relatórios.`);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível criar os pedidos de teste."));
    } finally {
      setSemeandoPedidos(false);
    }
  }

  async function removerDadosTeste() {
    const ok = await confirmar({
      mensagem:
        "Remove todos os clientes e pedidos marcados como teste (criados pelos botões acima). Clientes e pedidos reais não são afetados. Continuar?",
      textoConfirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setRemovendoTeste(true);
    try {
      const resultado = await repo.removerDadosTeste();
      toast.sucesso(
        `${resultado.clientes} cliente(s) e ${resultado.pedidos} pedido(s) de teste removidos.`,
      );
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível remover os dados de teste."));
    } finally {
      setRemovendoTeste(false);
    }
  }

  async function baixarBackup() {
    setGerandoBackup(true);
    try {
      const dados = await repo.exportarBackup();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const hoje = dados.geradoEm.slice(0, 10);
      baixarArquivo(blob, `backup-pedidos-${hoje}.json`);
      toast.sucesso("Backup baixado.");
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível gerar o backup."));
    } finally {
      setGerandoBackup(false);
    }
  }

  async function restaurarDeArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const ok = await confirmar({
      mensagem:
        "Restaurar este backup substitui TODOS os clientes, produtos e pedidos deste aparelho pelo conteúdo do arquivo. Continuar?",
      textoConfirmar: "Restaurar",
      perigo: true,
    });
    if (!ok) return;
    setRestaurando(true);
    try {
      const texto = await arquivo.text();
      const dados = JSON.parse(texto) as BackupDados;
      if (!Array.isArray(dados.clientes) || !Array.isArray(dados.produtos) || !Array.isArray(dados.pedidos)) {
        throw new Error("Arquivo de backup inválido.");
      }
      await repo.restaurarBackup(dados);
      toast.sucesso("Backup restaurado.");
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível restaurar o backup."));
    } finally {
      setRestaurando(false);
    }
  }

  async function verificarAtualizacoes() {
    setVerificando(true);
    try {
      const atualizou = await verificarAtualizacoesAgora();
      // Se atualizou, a página recarrega sozinha na versão nova — não sobra
      // tempo pra esse toast aparecer, mas não custa nada deixá-lo aqui.
      if (!atualizou) toast.info(`Você já está na versão mais recente (v${VERSAO_APP}).`);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível verificar atualizações."));
    } finally {
      setVerificando(false);
    }
  }

  return (
    <Tela titulo="Configurações" voltar="/">
      <h2 className="secao-titulo">App</h2>
      <p className="texto-suave">
        Versão v{VERSAO_APP}. O app instalado na tela inicial às vezes demora
        pra pegar uma atualização sozinho — use o botão abaixo pra forçar a
        checagem agora, sem precisar apagar e reinstalar.
      </p>
      <Button variante="secundario" onClick={verificarAtualizacoes} disabled={verificando}>
        {verificando ? "Verificando…" : "Verificar atualizações"}
      </Button>

      <h2 className="secao-titulo">Representante</h2>
      <p className="texto-suave">
        Preenchido automaticamente no rodapé de todo pedido novo.
      </p>
      <Cartao>
        <p className="texto-suave">
          {representante?.nome
            ? [representante.nome, representante.telefone, representante.email]
                .filter(Boolean)
                .join(" · ")
            : "Nenhum representante cadastrado ainda."}
        </p>
      </Cartao>
      <LinkButton to="/config/representante" variante="secundario">
        Cadastrar representante
      </LinkButton>

      <h2 className="secao-titulo">Base de produtos</h2>
      <Cartao>
        <p className="texto-suave">
          {importacao
            ? `${importacao.totalProdutos} produtos · última importação em ${formatarDataHora(importacao.quandoEm)} (${statusBase.mensagem.toLowerCase()})`
            : "Nenhuma base importada ainda."}
        </p>
      </Cartao>
      <LinkButton to="/produtos/importar" variante="secundario">
        Importar base de produtos
      </LinkButton>

      <h2 className="secao-titulo">Backup</h2>
      <p className="texto-suave">
        Guarda uma cópia de clientes, produtos e pedidos deste aparelho num
        arquivo .json — útil antes de trocar de celular (ainda não existe
        sincronização automática entre vendedores).
      </p>
      <Button variante="secundario" onClick={baixarBackup} disabled={gerandoBackup}>
        {gerandoBackup ? "Gerando…" : "Baixar backup (.json)"}
      </Button>
      <input
        ref={inputBackup}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          void restaurarDeArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variante="secundario"
        onClick={() => inputBackup.current?.click()}
        disabled={restaurando}
      >
        {restaurando ? "Restaurando…" : "Restaurar backup"}
      </Button>

      <h2 className="secao-titulo">Dados de teste</h2>
      <p className="texto-suave">
        Cria 2 clientes de exemplo (“(teste)” no nome) para experimentar o app sem
        digitar dados.
      </p>
      <Button variante="secundario" onClick={criarClientesTeste} disabled={semeando}>
        {semeando ? "Criando…" : "Criar clientes de teste"}
      </Button>
      <p className="texto-suave">
        Cria pedidos de exemplo espalhados em semanas/meses diferentes, com
        marcas variadas, vinculados só aos clientes de teste acima — só para
        validar a tela de Relatórios. Marcados como teste, então nunca entram
        nos totais de vendas.
      </p>
      <Button variante="secundario" onClick={criarPedidosTeste} disabled={semeandoPedidos}>
        {semeandoPedidos ? "Criando…" : "Criar pedidos de teste"}
      </Button>
      <p className="texto-suave">
        Remove de uma vez todos os clientes e pedidos criados pelos dois
        botões acima. Não afeta clientes/pedidos reais.
      </p>
      <Button variante="perigo" onClick={removerDadosTeste} disabled={removendoTeste}>
        {removendoTeste ? "Removendo…" : "Remover dados de teste"}
      </Button>
    </Tela>
  );
}
