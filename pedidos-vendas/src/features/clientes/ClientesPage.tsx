import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { useDebounce } from "../../hooks/useDebounce";
import { Button, LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Chips, EstadoVazio, Tela } from "../../components/ui/Layout";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { normalizar } from "../../domain/texto";
import css from "./clientes.module.css";

const ORDENS = ["Nome", "Recentes"] as const;
type Ordem = (typeof ORDENS)[number];

/** Cliente "Ativo" ou sem situação (cadastro manual) não mostra tag — só o que pede atenção. */
function tagSituacao(situacao: string | undefined) {
  if (!situacao) return null;
  const alvo = normalizar(situacao);
  if (alvo.startsWith("ativo")) return null;
  const variante = alvo.includes("inativo") ? "inativo" : "atencao";
  return (
    <span className={`${css.tagSituacao} ${css[`tagSituacao--${variante}`]}`}>{situacao}</span>
  );
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
  const marca = params.get("marca") ?? "";

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
    navigate(`/pedidos/novo?clienteId=${id}&marca=${encodeURIComponent(marca)}`, {
      replace: true,
    });
  }

  const destinoNovo = selecionando
    ? `/clientes/novo?selecionar=1&marca=${encodeURIComponent(marca)}`
    : "/clientes/novo";

  return (
    <Tela
      titulo={selecionando ? "Escolher cliente" : "Clientes"}
      voltar={true}
      comBarraInferior
    >
      <Input
        rotulo="Buscar"
        placeholder="Nome, CPF/CNPJ ou código"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      {!selecionando && clientes && clientes.length > 1 && (
        <Chips opcoes={ORDENS} valor={ordem} onChange={setOrdem} />
      )}

      {clientes?.length === 0 ? (
        <EstadoVazio
          titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          descricao="Cadastre o primeiro cliente para começar."
        />
      ) : (
        <div className="pilha">
          {clientes?.map((cliente) =>
            selecionando ? (
              <Cartao key={cliente.id} onClick={() => aoEscolher(cliente.id)}>
                <div className="texto-forte">{cliente.nome}</div>
                <div className="texto-suave">
                  {mascararCpfCnpj(cliente.cpfCnpj)}
                  {cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""}
                </div>
              </Cartao>
            ) : (
              <Cartao key={cliente.id}>
                <div className={css.linhaCliente}>
                  <div className={css.linhaClienteInfo}>
                    <div className="texto-forte">
                      {cliente.nome}
                      {tagSituacao(cliente.situacao)}
                    </div>
                    <div className="texto-suave">
                      {mascararCpfCnpj(cliente.cpfCnpj)}
                      {cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""}
                    </div>
                  </div>
                  <Button
                    variante="fantasma"
                    className={css.botaoEditar}
                    aria-label={`Editar ${cliente.nome}`}
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                  >
                    ✎
                  </Button>
                </div>
              </Cartao>
            ),
          )}
        </div>
      )}

      <BarraInferior>
        {selecionando ? (
          <Button bloco onClick={() => navigate(destinoNovo)}>
            Novo cliente
          </Button>
        ) : (
          <div className={css.botoesRodape}>
            <LinkButton to="/clientes/importar" variante="secundario" bloco>
              Importar
            </LinkButton>
            <LinkButton to={destinoNovo} bloco>
              Novo cliente
            </LinkButton>
          </div>
        )}
      </BarraInferior>
    </Tela>
  );
}
