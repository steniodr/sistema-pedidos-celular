import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/Confirm";
import { Input } from "../../components/ui/Field";
import { SelectComOutro } from "../../components/ui/SelectComOutro";
import { BarraInferior, EstadoVazio, Sheet, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { Etiqueta } from "../../components/ui/Etiqueta";
import {
  IconeAtencao,
  IconeCliente,
  IconeEntrega,
  IconeExportar,
  IconePlanilha,
} from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { formatarMoeda, totaisPedido } from "../../domain/calculos";
import { CONDICOES_PAGAMENTO } from "../../domain/condicoesPagamento";
import { mascararTelefone, somenteDigitos, validarCpfCnpj } from "../../domain/cpfCnpj";
import {
  ehAppDesatualizado,
  MENSAGEM_APP_DESATUALIZADO,
  mensagemErro,
} from "../../domain/erros";
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
  const [exportarAberto, setExportarAberto] = useState(false);
  // Passo de conferência dentro da folha de exportar, ao "Salvar como orçamento".
  const [confirmandoOrcamento, setConfirmandoOrcamento] = useState(false);
  const [codigoOrcamentoPrevisto, setCodigoOrcamentoPrevisto] = useState<string | null>(null);
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
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
  const pendenciasBase: string[] = [];
  if (!cliente) pendenciasBase.push("O pedido não tem cliente vinculado.");
  else {
    if (!cliente.nome.trim()) pendenciasBase.push("O cliente está sem nome.");
    if (cliente.cpfCnpj.trim() && !validarCpfCnpj(cliente.cpfCnpj)) {
      pendenciasBase.push("O CPF/CNPJ do cliente é inválido — corrija no cadastro.");
    }
  }
  if (pedido.itens.length === 0) pendenciasBase.push("O pedido não tem itens.");
  // Orçamento usa o código próprio (ORC...) no lugar do número, então as
  // pendências de número não valem pra ele nem pra "Salvar como orçamento".
  const pendenciasNumero: string[] = [];
  if (!pedido.somenteOrcamento) {
    if (pedido.numero <= 0) pendenciasNumero.push("O número do pedido é obrigatório.");
    if (numeroDuplicado) {
      pendenciasNumero.push(`Já existe outro pedido com o número ${pedido.numero} — altere antes de exportar.`);
    }
  }
  const pendencias = [...pendenciasBase, ...pendenciasNumero];

  const totais = totaisPedido(pedido);
  const podeExportar = pendencias.length === 0;
  const podeSalvarComoOrcamento = pendenciasBase.length === 0;

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
      if (ehAppDesatualizado(e)) {
        // O pedaco do exceljs/jspdf e desta versao do app; se a aba ficou aberta
        // durante uma atualizacao, o arquivo pedido nao existe mais no servidor.
        toast.acao(MENSAGEM_APP_DESATUALIZADO, "Recarregar", () => window.location.reload());
      } else {
        toast.erro(mensagemErro(e, "Falha ao gerar o arquivo."));
      }
    } finally {
      setExportando(null);
    }
  }

  /** Abre o passo de conferência do código, dentro da folha de exportar. */
  async function abrirConfirmacaoOrcamento() {
    if (!pedido) return;
    const codigo = pedido.codigoOrcamento ?? (await repo.proximoCodigoOrcamento());
    setCodigoOrcamentoPrevisto(codigo);
    setConfirmandoOrcamento(true);
  }

  /** Confirma: o pedido vira orçamento (enviado) e volta pra tela inicial. */
  async function confirmarSalvarComoOrcamento() {
    if (!pedido || !codigoOrcamentoPrevisto) return;
    setSalvandoOrcamento(true);
    try {
      await atualizar({
        somenteOrcamento: true,
        codigoOrcamento: codigoOrcamentoPrevisto,
        status: "enviado",
      });
      toast.sucesso(`Orçamento ${codigoOrcamentoPrevisto} salvo.`);
      navigate("/");
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o orçamento."));
      setSalvandoOrcamento(false);
    }
  }

  /**
   * Volta de orçamento para pedido de verdade: sugere o próximo número
   * disponível (o antigo pode já ter sido usado enquanto este ficou parado
   * como orçamento), excluindo o próprio pedido do cálculo pra ida-e-volta
   * não subir o número à toa.
   */
  async function converterEmPedido() {
    if (!pedido) return;
    const numero = await repo.proximoNumeroPedido(pedido.id);
    await atualizar({ somenteOrcamento: false, numero });
  }

  function fecharExportar() {
    setExportarAberto(false);
    setConfirmandoOrcamento(false);
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

  const identificador = pedido.somenteOrcamento
    ? `Orçamento ${pedido.codigoOrcamento}`
    : `Pedido nº ${pedido.numero}`;
  const entregaPreenchidos = [
    pedido.condicaoPagamento,
    pedido.transportadora,
    pedido.localEntrega,
  ].filter((v) => v?.trim()).length;

  return (
    <Tela
      titulo="Finalizar pedido"
      subtitulo={`${identificador} · ${cliente?.nome ?? "Sem cliente"} · ${pedido.itens.length} ${
        pedido.itens.length === 1 ? "item" : "itens"
      }`}
      voltar={`/pedidos/${pedido.id}`}
      capa
      comBarraInferior
      acao={<span className={css.capaValor}>{formatarMoeda(totais.total)}</span>}
    >
      {/* Todas as pendencias num bloco so — antes era um slab vermelho por
          problema, cada um com 16px de respiro, empurrando o formulario. */}
      {pendencias.length > 0 && (
        <div className={css.bloqueio}>
          <div className={css.bloqueioCabecalho}>
            <span className={css.bloqueioIcone}>
              <IconeAtencao size={17} />
            </span>
            <span className={css.bloqueioTitulo}>
              {pendencias.length === 1
                ? "1 pendência antes de exportar"
                : `${pendencias.length} pendências antes de exportar`}
            </span>
          </div>
          {pendencias.map((pendencia) => (
            <div key={pendencia} className={css.bloqueioItem}>
              <span className={css.bloqueioPonto} aria-hidden="true" />
              <span>{pendencia}</span>
            </div>
          ))}
          {cliente && (
            <Button
              variante="fantasma"
              className={css.linkCampo}
              onClick={() => navigate(`/clientes/${cliente.id}`)}
            >
              Abrir cadastro do cliente
            </Button>
          )}
        </div>
      )}

      <Painel titulo="Pedido" icone={<IconePlanilha size={17} />}>
        <div className={css.duplo}>
          {pedido.somenteOrcamento ? (
            <Input
              rotulo="Código do orçamento"
              value={pedido.codigoOrcamento ?? ""}
              readOnly
              disabled
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
          <Input
            rotulo="Data do pedido"
            type="date"
            value={pedido.dataPedido}
            onChange={(e) => atualizar({ dataPedido: e.target.value })}
          />
        </div>
        {pedido.somenteOrcamento && (
          <Button variante="fantasma" className={css.linkCampo} onClick={converterEmPedido}>
            Converter em pedido (usar número, não código)
          </Button>
        )}
        <SelectComOutro
          rotulo="Forma de solicitação"
          opcoes={FORMAS_SOLICITACAO}
          value={pedido.formaSolicitacao ?? ""}
          onChange={(valor) => atualizar({ formaSolicitacao: valor })}
        />
      </Painel>

      <Painel
        titulo="Entrega e pagamento"
        icone={<IconeEntrega size={17} />}
        colapsavel
        abertoInicial={entregaPreenchidos > 0}
        contador={<Etiqueta variante="info">{entregaPreenchidos} de 3</Etiqueta>}
        resumo={
          entregaPreenchidos > 0 ? (
            <div className={css.produtoVariantes}>
              {[pedido.condicaoPagamento, pedido.transportadora, pedido.localEntrega]
                .filter((v): v is string => !!v?.trim())
                .map((v) => (
                  <Etiqueta key={v}>{v}</Etiqueta>
                ))}
            </div>
          ) : undefined
        }
      >
        <SelectComOutro
          rotulo="Condição de pagamento"
          opcoes={CONDICOES_PAGAMENTO}
          value={pedido.condicaoPagamento ?? ""}
          onChange={(valor) => atualizar({ condicaoPagamento: valor })}
        />
        {/* "Usar do cliente" vira link discreto colado no campo — antes era um
            botao de 44px intercalado entre os campos, quebrando o ritmo. */}
        {cliente?.condicaoPagamento && cliente.condicaoPagamento !== pedido.condicaoPagamento && (
          <Button variante="fantasma" className={css.linkCampo} onClick={usarCondicaoPagamentoDoCliente}>
            Usar do cliente ({cliente.condicaoPagamento})
          </Button>
        )}
        <Input
          rotulo="Transportadora"
          value={pedido.transportadora ?? ""}
          onChange={(e) => atualizar({ transportadora: e.target.value })}
        />
        {cliente?.transportadora && cliente.transportadora !== pedido.transportadora && (
          <Button variante="fantasma" className={css.linkCampo} onClick={usarTransportadoraDoCliente}>
            Usar do cliente ({cliente.transportadora})
          </Button>
        )}
        <Input
          rotulo="Local de entrega"
          value={pedido.localEntrega ?? ""}
          onChange={(e) => atualizar({ localEntrega: e.target.value })}
        />
        {cliente?.obsGerais && cliente.obsGerais !== pedido.localEntrega && (
          <Button variante="fantasma" className={css.linkCampo} onClick={usarLocalEntregaDoCliente}>
            Usar do cliente ({cliente.obsGerais})
          </Button>
        )}
      </Painel>

      <Painel
        titulo="Representante"
        icone={<IconeCliente size={17} />}
        acao={
          <Button variante="fantasma" className={css.acaoPainel} onClick={usarRepresentanteSalvo}>
            Usar o salvo
          </Button>
        }
      >
        <Input
          rotulo="Nome"
          value={pedido.representanteNome ?? ""}
          onChange={(e) => atualizar({ representanteNome: e.target.value })}
        />
        <div className={css.duplo}>
          <Input
            rotulo="Telefone"
            inputMode="tel"
            value={mascararTelefone(pedido.representanteTelefone ?? "")}
            onChange={(e) =>
              atualizar({ representanteTelefone: somenteDigitos(e.target.value) })
            }
          />
          <Input
            rotulo="E-mail"
            type="email"
            value={pedido.representanteEmail ?? ""}
            onChange={(e) => atualizar({ representanteEmail: e.target.value })}
          />
        </div>
      </Painel>

      <BarraInferior>
        <div className={css.totalBarra}>
          {podeExportar ? (
            <>
              <span className="texto-suave">Total</span>
              <span className={css.totalValor}>{formatarMoeda(totais.total)}</span>
            </>
          ) : (
            <>
              <span className="texto-suave">
                {pendencias.length === 1 ? "1 pendência" : `${pendencias.length} pendências`}
              </span>
              <span className={css.totalBloqueado}>Resolva para exportar</span>
            </>
          )}
        </div>
        <Button
          disabled={(!podeExportar && !podeSalvarComoOrcamento) || exportando !== null}
          onClick={() => setExportarAberto(true)}
        >
          <IconeExportar size={17} />
          Exportar
        </Button>
      </BarraInferior>

      <Sheet
        titulo={confirmandoOrcamento ? "Salvar como orçamento" : "Exportar pedido"}
        aberto={exportarAberto}
        aoFechar={fecharExportar}
      >
        {confirmandoOrcamento ? (
          <>
            <div className={css.confirmaOrcamento}>
              <span className="texto-suave">Código do orçamento</span>
              <span className={css.confirmaOrcamentoCodigo}>{codigoOrcamentoPrevisto}</span>
              <p className="texto-suave">
                O pedido vira um orçamento (com esse código no lugar do número) e
                volta para a tela inicial já como enviado. Dá para reabrir e
                convertê-lo em pedido depois.
              </p>
            </div>
            <Button bloco disabled={salvandoOrcamento} onClick={confirmarSalvarComoOrcamento}>
              {salvandoOrcamento ? "Salvando…" : `Confirmar orçamento ${codigoOrcamentoPrevisto ?? ""}`}
            </Button>
            <Button
              variante="fantasma"
              bloco
              disabled={salvandoOrcamento}
              onClick={() => setConfirmandoOrcamento(false)}
            >
              Voltar
            </Button>
          </>
        ) : (
          <>
            {temModelo === false && (
              <p className="texto-suave">
                O modelo oficial ainda não está disponível neste aparelho — a planilha
                será gerada com o layout equivalente montado pelo app.
              </p>
            )}
            <Button
              bloco
              disabled={!podeExportar || exportando !== null}
              onClick={() => exportar("excel")}
            >
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
            {!pedido.somenteOrcamento && (
              <Button
                variante="secundario"
                bloco
                disabled={!podeSalvarComoOrcamento || exportando !== null}
                onClick={abrirConfirmacaoOrcamento}
              >
                Salvar como orçamento e voltar
              </Button>
            )}
            {exportado ? (
              <Button variante="secundario" bloco onClick={() => navigate("/")}>
                Voltar ao início
              </Button>
            ) : (
              <Button variante="fantasma" bloco onClick={() => navigate("/")}>
                Salvar rascunho e voltar
              </Button>
            )}
          </>
        )}
      </Sheet>
    </Tela>
  );
}
