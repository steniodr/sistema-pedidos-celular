import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { ZonaDeRisco } from "../../components/ui/ZonaDeRisco";
import {
  IconeBackup,
  IconeBases,
  IconeCliente,
  IconeConfig,
  IconeMarca,
  IconeNovidades,
  IconeProduto,
  IconeTeste,
} from "../../components/ui/icones";
import { mascararTelefone } from "../../domain/cpfCnpj";
import { useToast } from "../../components/ui/Toast";
import { mensagemErro } from "../../domain/erros";
import type { BackupDados } from "../../data/repository";
import { avaliarBase, formatarDataHora } from "../produtos/statusBase";
import { baixarArquivo } from "../export/dadosExportacao";
import { verificarAtualizacoesAgora } from "../../pwa";
import { VERSAO_APP } from "../../versaoApp";

export function ConfigPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const [gerandoBackup, setGerandoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const inputBackup = useRef<HTMLInputElement>(null);

  const { dados: representante } = useDados(() => repo.obterRepresentante(), [repo]);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);

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
    // Vira lista de configurações: cada item é uma linha com ícone, valor atual
    // e seta. Antes eram sete botões "secundário" idênticos, sem distinguir
    // navegação de ação nem o que era irreversível.
    <Tela titulo="Configurações" subtitulo={`Versão ${VERSAO_APP}`} voltar="/" capa>
      <Painel titulo="Seu cadastro" icone={<IconeCliente size={17} />}>
        <LinhaLista
          icone={<IconeCliente size={17} />}
          titulo="Representante"
          meta={
            representante?.nome
              ? [representante.nome, mascararTelefone(representante.telefone ?? ""), representante.email]
                  .filter(Boolean)
                  .join(" · ")
              : "Nenhum representante cadastrado ainda"
          }
          onClick={() => navigate("/config/representante")}
        />
      </Painel>

      <Painel titulo="Dados" icone={<IconeBases size={17} />}>
        <LinhaLista
          icone={<IconeProduto size={17} />}
          titulo="Base de produtos"
          meta={
            importacao
              ? `${importacao.totalProdutos} produtos · ${formatarDataHora(importacao.quandoEm)}`
              : "Nenhuma base importada ainda"
          }
          acento={statusBase.nivel === "ok" ? undefined : "alerta"}
          onClick={() => navigate("/produtos/importar")}
        />
        <LinhaLista
          icone={<IconeMarca size={17} />}
          titulo="Marcas nos relatórios"
          meta="Quais marcas entram nos totais e os grupos de marcas"
          onClick={() => navigate("/config/marcas-relatorio")}
        />
        <LinhaLista
          icone={<IconeBackup size={17} />}
          titulo="Baixar backup (.json)"
          meta={
            gerandoBackup
              ? "Gerando arquivo…"
              : "Cópia de clientes, produtos e pedidos deste aparelho"
          }
          fim={<span />}
          onClick={baixarBackup}
        />
      </Painel>

      <Painel titulo="App" icone={<IconeConfig size={17} />}>
        <LinhaLista
          icone={<IconeNovidades size={17} />}
          titulo="Verificar atualizações"
          meta={
            verificando
              ? "Verificando…"
              : "O app instalado às vezes demora pra pegar sozinho"
          }
          fim={<span />}
          onClick={verificarAtualizacoes}
        />
        <LinhaLista
          icone={<IconeTeste size={17} />}
          titulo="Ambiente de teste"
          meta="Dados fictícios para experimentar sem tocar nos reais"
          onClick={() => navigate("/config/teste")}
        />
      </Painel>

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

      {/* Restaurar apaga TUDO deste aparelho — antes tinha exatamente a mesma
          aparência do "Baixar backup", que não destrói nada. */}
      <ZonaDeRisco descricao="Restaurar substitui todos os clientes, produtos e pedidos deste aparelho pelo conteúdo do arquivo.">
        <Button
          variante="perigo"
          onClick={() => inputBackup.current?.click()}
          disabled={restaurando}
        >
          <IconeBackup size={16} />
          {restaurando ? "Restaurando…" : "Restaurar backup"}
        </Button>
      </ZonaDeRisco>
    </Tela>
  );
}
