import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { SelectComOutro } from "../../components/ui/SelectComOutro";
import { Cartao, EstadoVazio, Tela } from "../../components/ui/Layout";
import { StatusPedido } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { validarCpfCnpj } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import { FORMAS_SOLICITACAO } from "../../domain/formasSolicitacao";
import { baixarArquivo, montarDadosExportacao, nomeArquivo } from "../export/dadosExportacao";
import { gerarExcel, modeloDisponivel } from "../export/excel";
import { gerarPdf } from "../export/pdf";
import { avaliarBase } from "../produtos/statusBase";
import { usePedido } from "./usePedido";
import css from "./pedidos.module.css";

export function FinalizarPedidoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  const toast = useToast();
  const { pedido, cliente, carregando, atualizar } = usePedido(id);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [exportado, setExportado] = useState(false);
  const [temModelo, setTemModelo] = useState<boolean | null>(null);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);

  useEffect(() => {
    void modeloDisponivel().then(setTemModelo);
  }, []);

  if (carregando) return <Tela titulo="Finalizar" voltar={true}>{null}</Tela>;
  if (!pedido) {
    return (
      <Tela titulo="Finalizar" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  // Validações que impedem a exportação (especificação 6.2 e tela de finalização).
  const pendencias: string[] = [];
  if (!cliente) pendencias.push("O pedido não tem cliente vinculado.");
  else {
    if (!cliente.nome.trim()) pendencias.push("O cliente está sem nome.");
    if (!validarCpfCnpj(cliente.cpfCnpj)) {
      pendencias.push("O CPF/CNPJ do cliente é inválido — corrija no cadastro.");
    }
  }
  if (pedido.itens.length === 0) pendencias.push("O pedido não tem itens.");

  const totais = totaisPedido(pedido);
  const podeExportar = pendencias.length === 0;

  async function exportar(formato: "excel" | "pdf") {
    if (!pedido || !podeExportar) return;
    if (statusBase.nivel === "critico") {
      const confirmado = window.confirm(
        `${statusBase.mensagem} Os preços deste pedido podem estar desatualizados. Finalizar mesmo assim?`,
      );
      if (!confirmado) return;
    }
    setExportando(formato);
    try {
      const dados = montarDadosExportacao(pedido, cliente);
      const blob = formato === "excel" ? await gerarExcel(dados) : await gerarPdf(dados);
      baixarArquivo(blob, nomeArquivo(dados, formato === "excel" ? "xlsx" : "pdf"));

      if (pedido.status !== "enviado") {
        await atualizar({ status: "enviado" });
      }
      setExportado(true);
      toast.sucesso(formato === "excel" ? "Excel gerado." : "PDF gerado.");
    } catch (e) {
      toast.erro(mensagemErro(e, "Falha ao gerar o arquivo."));
    } finally {
      setExportando(null);
    }
  }

  async function usarRepresentanteSalvo() {
    const representante = await repo.obterRepresentante();
    if (!representante) {
      toast.info("Cadastre o representante em Configurações.");
      return;
    }
    await atualizar({
      representanteNome: representante.nome,
      representanteTelefone: representante.telefone,
      representanteEmail: representante.email,
    });
  }

  return (
    <Tela titulo="Finalizar pedido" voltar={`/pedidos/${pedido.id}`}>
      <Cartao>
        <div className="linha linha--entre">
          <span className="texto-forte">Pedido nº {pedido.numero}</span>
          <span className="texto-forte">{formatarMoeda(totais.total)}</span>
        </div>
        <div className="texto-suave">
          {cliente?.nome ?? "Sem cliente"} · {pedido.itens.length} item(ns) ·{" "}
          <StatusPedido status={pedido.status} />
        </div>
      </Cartao>

      {pendencias.map((pendencia) => (
        <div key={pendencia} className={css.pendencia}>
          {pendencia}
        </div>
      ))}

      <h2 className="secao-titulo">Dados do pedido</h2>
      <Input
        rotulo="Data do pedido"
        type="date"
        value={pedido.dataPedido}
        onChange={(e) => atualizar({ dataPedido: e.target.value })}
      />
      <Input
        rotulo="Horário do pedido"
        type="time"
        value={pedido.horaPedido ?? ""}
        onChange={(e) => atualizar({ horaPedido: e.target.value })}
      />
      <SelectComOutro
        rotulo="Forma de solicitação"
        opcoes={FORMAS_SOLICITACAO}
        value={pedido.formaSolicitacao ?? ""}
        onChange={(valor) => atualizar({ formaSolicitacao: valor })}
      />

      <div className="linha linha--entre">
        <h2 className="secao-titulo">Representante</h2>
        <Button variante="fantasma" onClick={usarRepresentanteSalvo}>
          Usar o salvo
        </Button>
      </div>
      <Input
        rotulo="Nome"
        value={pedido.representanteNome ?? ""}
        onChange={(e) => atualizar({ representanteNome: e.target.value })}
      />
      <Input
        rotulo="Telefone"
        value={pedido.representanteTelefone ?? ""}
        onChange={(e) => atualizar({ representanteTelefone: e.target.value })}
      />
      <Input
        rotulo="E-mail"
        type="email"
        value={pedido.representanteEmail ?? ""}
        onChange={(e) => atualizar({ representanteEmail: e.target.value })}
      />

      <h2 className="secao-titulo">Exportar</h2>
      {temModelo === false && (
        <p className="texto-suave">
          O modelo oficial (public/templates/modelo_pedido.xlsx) ainda não está no
          projeto — a planilha será gerada com o layout equivalente montado pelo app.
        </p>
      )}
      <div className={css.exportacoes}>
        <Button bloco disabled={!podeExportar || exportando !== null} onClick={() => exportar("excel")}>
          {exportando === "excel" ? "Gerando…" : "Exportar Excel (.xlsx)"}
        </Button>
        <Button
          variante="secundario"
          bloco
          disabled={!podeExportar || exportando !== null}
          onClick={() => exportar("pdf")}
        >
          {exportando === "pdf" ? "Gerando…" : "Exportar PDF"}
        </Button>
      </div>

      <div className={css.exportacoes}>
        {exportado && (
          <Button bloco onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
        )}
        <Button variante="fantasma" bloco onClick={() => navigate("/")}>
          Salvar rascunho e voltar
        </Button>
      </div>
    </Tela>
  );
}
