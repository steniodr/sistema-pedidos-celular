import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, EstadoVazio, Tela } from "../../components/ui/Layout";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import css from "./clientes.module.css";

/**
 * Lista/busca de clientes. Quando chamada com `?selecionar=1`, funciona como
 * seletor dentro do fluxo de novo pedido e devolve o cliente escolhido.
 */
export function ClientesPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busca, setBusca] = useState("");

  const selecionando = params.get("selecionar") === "1";
  const marca = params.get("marca") ?? "";

  const { dados: clientes } = useDados(() => repo.listarClientes(busca), [repo, busca]);

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
                    <div className="texto-forte">{cliente.nome}</div>
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
        <Button bloco onClick={() => navigate(destinoNovo)}>
          Novo cliente
        </Button>
      </BarraInferior>
    </Tela>
  );
}
