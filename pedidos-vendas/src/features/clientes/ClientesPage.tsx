import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import { BarraInferior, BotaoCapa, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { LinhaLista, type AcentoLinha } from "../../components/ui/LinhaLista";
import { Etiqueta } from "../../components/ui/Etiqueta";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { IconeBases, IconeBuscar, IconeSomar } from "../../components/ui/icones";
import capaCss from "../../components/ui/redesenho.module.css";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { definirParametro } from "../../domain/rotas";
import { normalizar } from "../../domain/texto";

const ORDENS = ["Nome", "Recentes"] as const;
type Ordem = (typeof ORDENS)[number];

/**
 * Cliente "Ativo" (ou sem situação, caso do cadastro manual) não ganha
 * etiqueta — só o que pede atenção aparece.
 */
function etiquetaSituacao(situacao: string | undefined) {
  if (!situacao) return null;
  const alvo = normalizar(situacao);
  if (alvo.startsWith("ativo")) return null;
  return (
    <Etiqueta variante={alvo.includes("inativo") ? "erro" : "alerta"}>{situacao}</Etiqueta>
  );
}

function acentoSituacao(situacao: string | undefined): AcentoLinha | undefined {
  if (!situacao) return undefined;
  const alvo = normalizar(situacao);
  if (alvo.startsWith("ativo")) return undefined;
  return alvo.includes("inativo") ? "erro" : "alerta";
}

/** Duas letras do nome como âncora visual da linha (ex.: "Tintas do Vale" -> "TV"). */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 1);
  const letras = (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
  return (letras || nome.slice(0, 2)).toUpperCase();
}

/**
 * Lista/busca de clientes. Quando chamada com `?selecionar=1`, funciona como
 * seletor dentro do fluxo de novo pedido e devolve o cliente escolhido.
 */
export function ClientesPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("Nome");
  const buscaDebounced = useDebounce(busca);

  const selecionando = params.get("selecionar") === "1";
  /** Pra onde voltar (com `?clienteId=` anexado) depois de escolher/criar um cliente. */
  const retorno = params.get("retorno") ?? "/pedidos/novo";

  const { dados: clientesBrutos } = useDados(
    () => repo.listarClientes(buscaDebounced),
    [repo, buscaDebounced],
  );

  const clientes = useMemo(() => {
    if (!clientesBrutos) return clientesBrutos;
    if (ordem === "Nome") return clientesBrutos;
    return [...clientesBrutos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  }, [clientesBrutos, ordem]);

  function aoEscolher(id: string) {
    navigate(definirParametro(retorno, "clienteId", id), { replace: true });
  }

  const destinoNovo = selecionando
    ? `/clientes/novo?selecionar=1&retorno=${encodeURIComponent(retorno)}`
    : "/clientes/novo";

  return (
    <Tela
      titulo={selecionando ? "Escolher cliente" : "Clientes"}
      subtitulo={
        selecionando
          ? "Toque no cliente do pedido"
          : clientes
            ? `${clientes.length} ${clientes.length === 1 ? "cadastrado" : "cadastrados"}`
            : undefined
      }
      voltar={true}
      capa
      comBarraInferior
      acao={
        selecionando ? undefined : (
          <BotaoCapa rotulo="Importar clientes" onClick={() => navigate("/clientes/importar")}>
            <IconeBases size={19} />
          </BotaoCapa>
        )
      }
      abaixoDoTitulo={
        <div className={capaCss.capaBusca}>
          <span className={capaCss.capaBuscaIcone}>
            <IconeBuscar size={16} />
          </span>
          <input
            className={capaCss.capaBuscaCampo}
            aria-label="Buscar"
            placeholder="Nome, CPF/CNPJ ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
          />
        </div>
      }
    >
      {!selecionando && (
        <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />
      )}

      {!clientes ? (
        <Esqueleto linhas={4} />
      ) : clientes.length === 0 ? (
        <EstadoVazio
          titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          descricao={
            busca
              ? "Tente outro nome, CPF/CNPJ ou código."
              : "Cadastre o primeiro cliente para começar."
          }
        />
      ) : (
        <div className="pilha">
          {clientes.map((cliente) => (
            <LinhaLista
              key={cliente.id}
              iniciais={iniciaisDe(cliente.nome)}
              acento={acentoSituacao(cliente.situacao)}
              titulo={
                <>
                  {cliente.nome}
                  {etiquetaSituacao(cliente.situacao)}
                </>
              }
              meta={`${mascararCpfCnpj(cliente.cpfCnpj)}${
                cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""
              }`}
              onClick={() =>
                selecionando ? aoEscolher(cliente.id) : navigate(`/clientes/${cliente.id}`)
              }
            />
          ))}
        </div>
      )}

      <BarraInferior>
        <Button bloco onClick={() => navigate(destinoNovo)}>
          <IconeSomar size={17} />
          Novo cliente
        </Button>
      </BarraInferior>
    </Tela>
  );
}
