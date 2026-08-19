import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Checkbox, Input } from "../../components/ui/Field";
import { SelectComOutro } from "../../components/ui/SelectComOutro";
import { BarraInferior, Cartao, EstadoVazio, Tela } from "../../components/ui/Layout";
import { StatusPedido } from "../../components/ui/StatusPedido";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { CONDICOES_PAGAMENTO } from "../../domain/condicoesPagamento";
import { mascararTelefone, validarCpfCnpj } from "../../domain/cpfCnpj";
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
  const confirmar = useConfirm();
  const { pedido, cliente, carregando, atualizar } = usePedido(id);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [exportado, setExportado] = useState(false);
  const [temModelo, setTemModelo] = useState<boolean | null>(null);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);
  const { dados: numeroDuplicado } = useDados(
    () => (pedido ? repo.existeNumeroPedido(pedido.numero, pedido.id) : Promise.resolve(false)),
    [repo, pedido?.numero, pedido?.id],
  );

  useEffect(() => {
    if (!pedido) return;
    void modeloDisponivel(pedido.itens.length).then(setTemModelo);
  }, [pedido?.itens.length]);

  if (carregando) {
    return (
      <Tela titulo="Finalizar" voltar={true}>
        <p className="texto-suave">Carregando…</p>
      </Tela>
    );
  }
  if (!pedido) {
    return (
      <Tela titulo="Finalizar" voltar="/">
        <EstadoVazio titulo="Pedido não encontrado" />
      </Tela>
    );
  }

  // Validações que impedem a exportação (tela de finalização). CPF/CNPJ é
  // opcional (ex.: orçamento cujo documento ainda não foi capturado) — só
  // bloqueia quando algo foi digitado e está errado, nunca por estar vazio.
  const pendencias: string[] = [];
  if (!cliente) pendencias.push("O pedido não tem cliente vinculado.");
  else {
    if (!cliente.nome.trim()) pendencias.push("O cliente está sem nome.");
    if (cliente.cpfCnpj.trim() && !validarCpfCnpj(cliente.cpfCnpj)) {
      pendencias.push("O CPF/CNPJ do cliente é inválido — corrija no cadastro.");
    }
  }
  if (pedido.itens.length === 0) pendencias.push("O pedido não tem itens.");
  // Orçamento não tem (nem precisa de) número de pedido — usa o código
  // próprio (ORC...) no lugar, então essas duas validações não se aplicam.
  if (!pedido.somenteOrcamento) {
    if (pedido.numero <= 0) pendencias.push("O número do pedido é obrigatório.");
    if (numeroDuplicado) {
      pendencias.push(`Já existe outro pedido com o número ${pedido.numero} — altere antes de exportar.`);
    }
  }

  const totais = totaisPedido(pedido);
  const podeExportar = pendencias.length === 0;

  async function exportar(formato: "excel" | "pdf") {
    if (!pedido || !podeExportar) return;
    if (statusBase.nivel === "critico") {
      const confirmado = await confirmar({
        mensagem: `${statusBase.mensagem} Os preços deste pedido podem estar desatualizados. Finalizar mesmo assim?`,
        textoConfirmar: "Finalizar mesmo assim",
      });
      if (!confirmado) return;
    }
    setExportando(formato);
    try {
      const dados = montarDadosExportacao(pedido, cliente);
      if (formato === "excel") {
        const resultado = await gerarExcel(dados);
        baixarArquivo(resultado.blob, nomeArquivo(dados, "xlsx"));
        if (resultado.usouModelo) {
          toast.sucesso("Excel gerado no modelo oficial.");
        } else if (resultado.motivoFallback === "capacidade") {
          toast.info(
            "Este pedido tem mais itens do que o molde oficial comporta — Excel gerado no modelo padrão.",
          );
        } else if (resultado.motivoFallback === "erro") {
          toast.erro(
            "Não consegui usar o molde oficial (algo mudou na estrutura do arquivo) — Excel gerado no modelo padrão. Avise o suporte.",
          );
        } else {
          toast.info(
            "Molde oficial indisponível agora (sem internet ou ainda não baixado neste aparelho) — Excel gerado no modelo padrão.",
          );
        }
      } else {
        const blob = await gerarPdf(dados);
        baixarArquivo(blob, nomeArquivo(dados, "pdf"));
        toast.sucesso("PDF gerado.");
      }

      if (pedido.status !== "enviado") {
        await atualizar({ status: "enviado" });
      }
      setExportado(true);
    } catch (e) {
      toast.erro(mensagemErro(e, "Falha ao gerar o arquivo."));
    } finally {
      setExportando(null);
    }
  }

  async function alternarSomenteOrcamento(valor: boolean) {
    if (!pedido) return;
    if (valor) {
      const codigo = pedido.codigoOrcamento ?? (await repo.proximoCodigoOrcamento());
      await atualizar({ somenteOrcamento: true, codigoOrcamento: codigo });
    } else {
      // Volta a ser um pedido de verdade — sugere o próximo número
      // disponível (o antigo pode já ter sido usado por outro pedido
      // enquanto este ficou parado como orçamento); o vendedor pode ajustar.
      // Exclui o próprio pedido do cálculo — senão marcar/desmarcar várias
      // vezes ia subir o número toda hora, mesmo sem pedido novo nenhum.
      const numero = await repo.proximoNumeroPedido(pedido.id);
      await atualizar({ somenteOrcamento: false, numero });
    }
  }

  async function usarCondicaoPagamentoDoCliente() {
    await atualizar({ condicaoPagamento: cliente?.condicaoPagamento ?? "" });
  }

  async function usarTransportadoraDoCliente() {
    await atualizar({ transportadora: cliente?.transportadora ?? "" });
  }

  async function usarLocalEntregaDoCliente() {
    await atualizar({ localEntrega: cliente?.obsGerais ?? "" });
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
    <Tela
      titulo="Finalizar pedido"
      voltar={`/pedidos/${pedido.id}`}
      comBarraInferior
      barraInferiorAlta
    >
      <Cartao>
        <div className="linha linha--entre">
          <span className="texto-forte">
            {pedido.somenteOrcamento ? `Orçamento ${pedido.codigoOrcamento}` : `Pedido nº ${pedido.numero}`}
          </span>
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
      {pedido.somenteOrcamento ? (
        <Input
          rotulo="Código do orçamento"
          value={pedido.codigoOrcamento ?? ""}
          readOnly
          disabled
          ajuda="Gerado automaticamente. Vira o número do pedido quando 'Somente orçamento' for desmarcado."
        />
      ) : (
        <Input
          rotulo="Número do pedido"
          obrigatorio
          inputMode="numeric"
          type="number"
          erro={
            pedido.numero <= 0
              ? "Informe um número válido."
              : numeroDuplicado
                ? "Já existe outro pedido com esse número."
                : undefined
          }
          value={pedido.numero}
          onChange={(e) => atualizar({ numero: Number(e.target.value) || 0 })}
        />
      )}
      <Checkbox
        rotulo="Somente orçamento"
        checked={pedido.somenteOrcamento ?? false}
        onChange={alternarSomenteOrcamento}
        ajuda="Sem número de pedido ainda — usa um código próprio (ex.: ORC01). Pode ser exportado normalmente pra mandar pro cliente; desmarque quando virar um pedido de verdade."
      />
      <Input
        rotulo="Data do pedido"
        type="date"
        value={pedido.dataPedido}
        onChange={(e) => atualizar({ dataPedido: e.target.value })}
      />
      <SelectComOutro
        rotulo="Forma de solicitação"
        opcoes={FORMAS_SOLICITACAO}
        value={pedido.formaSolicitacao ?? ""}
        onChange={(valor) => atualizar({ formaSolicitacao: valor })}
      />
      <SelectComOutro
        rotulo="Condição de pagamento"
        opcoes={CONDICOES_PAGAMENTO}
        value={pedido.condicaoPagamento ?? ""}
        onChange={(valor) => atualizar({ condicaoPagamento: valor })}
      />
      {cliente?.condicaoPagamento && cliente.condicaoPagamento !== pedido.condicaoPagamento && (
        <Button variante="fantasma" onClick={usarCondicaoPagamentoDoCliente}>
          Usar do cliente ({cliente.condicaoPagamento})
        </Button>
      )}
      <Input
        rotulo="Transportadora"
        value={pedido.transportadora ?? ""}
        onChange={(e) => atualizar({ transportadora: e.target.value })}
      />
      {cliente?.transportadora && cliente.transportadora !== pedido.transportadora && (
        <Button variante="fantasma" onClick={usarTransportadoraDoCliente}>
          Usar do cliente ({cliente.transportadora})
        </Button>
      )}
      <Input
        rotulo="Local de entrega"
        value={pedido.localEntrega ?? ""}
        onChange={(e) => atualizar({ localEntrega: e.target.value })}
      />
      {cliente?.obsGerais && cliente.obsGerais !== pedido.localEntrega && (
        <Button variante="fantasma" onClick={usarLocalEntregaDoCliente}>
          Usar do cliente ({cliente.obsGerais})
        </Button>
      )}

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
        inputMode="tel"
        value={mascararTelefone(pedido.representanteTelefone ?? "")}
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
          O modelo oficial ainda não está disponível neste aparelho — a planilha
          será gerada com o layout equivalente montado pelo app.
        </p>
      )}
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

      <BarraInferior>
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
      </BarraInferior>
    </Tela>
  );
}
