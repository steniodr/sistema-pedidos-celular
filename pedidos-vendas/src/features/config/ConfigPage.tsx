import { useEffect, useRef, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button, LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararTelefone } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import type { Representante } from "../../domain/types";
import type { BackupDados } from "../../data/repository";
import { semearClientesTeste } from "../clientes/clientesTeste";
import { gerarPedidosTeste } from "../pedidos/pedidosTeste";
import { avaliarBase, formatarDataHora } from "../produtos/statusBase";
import { baixarArquivo } from "../export/dadosExportacao";

const VAZIO: Representante = { nome: "", telefone: "", email: "" };

export function ConfigPage() {
  const repo = useRepository();
  const toast = useToast();
  const [form, setForm] = useState<Representante>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [semeando, setSemeando] = useState(false);
  const [semeandoPedidos, setSemeandoPedidos] = useState(false);
  const [gerandoBackup, setGerandoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const inputBackup = useRef<HTMLInputElement>(null);

  const { dados: salvo } = useDados(() => repo.obterRepresentante(), [repo]);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);

  useEffect(() => {
    if (salvo) setForm(salvo);
  }, [salvo]);

  async function salvar() {
    setSalvando(true);
    try {
      await repo.salvarRepresentante(form);
      toast.sucesso("Dados do representante salvos.");
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

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
    if (
      !window.confirm(
        "Restaurar este backup substitui TODOS os clientes, produtos e pedidos deste aparelho pelo conteúdo do arquivo. Continuar?",
      )
    ) {
      return;
    }
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

  return (
    <Tela titulo="Configurações" voltar="/" comBarraInferior>
      <h2 className="secao-titulo">Representante</h2>
      <p className="texto-suave">
        Preenchido automaticamente no rodapé de todo pedido novo.
      </p>
      <Input
        rotulo="Nome"
        value={form.nome}
        onChange={(e) => setForm({ ...form, nome: e.target.value })}
      />
      <Input
        rotulo="Telefone"
        inputMode="tel"
        value={mascararTelefone(form.telefone)}
        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
      />
      <Input
        rotulo="E-mail"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

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

      <h2 className="secao-titulo">Testes</h2>
      <p className="texto-suave">
        Cria 2 clientes de exemplo (“(teste)” no nome) para experimentar o app sem
        digitar dados. Depois, abra o cliente em Clientes e toque em “Excluir
        cliente” para remover.
      </p>
      <Button variante="secundario" onClick={criarClientesTeste} disabled={semeando}>
        {semeando ? "Criando…" : "Criar clientes de teste"}
      </Button>
      <p className="texto-suave">
        Cria pedidos de exemplo espalhados em semanas/meses diferentes, com
        marcas e clientes variados — só para validar a tela de Relatórios.
      </p>
      <Button variante="secundario" onClick={criarPedidosTeste} disabled={semeandoPedidos}>
        {semeandoPedidos ? "Criando…" : "Criar pedidos de teste"}
      </Button>

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
