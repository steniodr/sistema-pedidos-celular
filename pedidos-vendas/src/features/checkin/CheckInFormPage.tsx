import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import { horaAgora } from "../../domain/tempo";

/**
 * Criar (`/checkins/novo`) ou editar (`/checkins/:id`) um check-in. Na criação,
 * o cliente é escolhido em /clientes?selecionar=1&retorno=/checkins/novo, que
 * volta pra cá com `?clienteId=`; na edição o cliente já está fixo.
 */
export function CheckInFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();

  const clienteIdEscolhido = params.get("clienteId") ?? "";
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState(horaAgora());
  const [salvando, setSalvando] = useState(false);

  const { dados: checkIn } = useDados(
    async () => (id ? repo.obterCheckIn(id) : undefined),
    [repo, id],
  );

  const clienteId = id ? checkIn?.clienteId ?? "" : clienteIdEscolhido;

  const { dados: cliente } = useDados(
    async () => (clienteId ? repo.obterCliente(clienteId) : undefined),
    [repo, clienteId],
  );

  useEffect(() => {
    if (checkIn) {
      setData(checkIn.data);
      setHora(checkIn.hora);
    }
  }, [checkIn]);

  async function salvar() {
    if (!clienteId) return;
    setSalvando(true);
    try {
      await repo.salvarCheckIn({
        id,
        clienteId,
        data,
        hora,
      });
      toast.sucesso("Check-in salvo.");
      navigate("/checkins", { replace: true });
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar o check-in."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela titulo={id ? "Editar check-in" : "Novo check-in"} voltar="/checkins" comBarraInferior>
      <h2 className="secao-titulo">Cliente</h2>
      {cliente ? (
        <Cartao
          onClick={
            id
              ? undefined
              : () => navigate(`/clientes?selecionar=1&retorno=${encodeURIComponent("/checkins/novo")}`)
          }
        >
          <div className="texto-forte">{cliente.nome}</div>
          <div className="texto-suave">
            {mascararCpfCnpj(cliente.cpfCnpj)}
            {cliente.cidadeEstado ? ` · ${cliente.cidadeEstado}` : ""}
          </div>
          {!id && <div className="texto-suave">Toque para trocar de cliente</div>}
        </Cartao>
      ) : (
        <Button
          variante="secundario"
          bloco
          onClick={() => navigate(`/clientes?selecionar=1&retorno=${encodeURIComponent("/checkins/novo")}`)}
        >
          Escolher cliente
        </Button>
      )}

      <Input rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <Input rotulo="Horário" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={!clienteId || !data || !hora || salvando}>
          {salvando ? "Salvando…" : "Salvar check-in"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
