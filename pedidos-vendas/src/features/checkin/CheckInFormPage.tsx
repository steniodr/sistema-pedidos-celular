import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { Painel } from "../../components/ui/Painel";
import { LinhaLista } from "../../components/ui/LinhaLista";
import { IconeCalendario, IconeCliente } from "../../components/ui/icones";
import { useToast } from "../../components/ui/Toast";
import { mascararCpfCnpj } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import { horaAgora } from "../../domain/tempo";
import css from "./checkin.module.css";

const ROTA_ESCOLHER_CLIENTE = `/clientes?selecionar=1&retorno=${encodeURIComponent("/checkins/novo")}`;

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

  /** Caso mais comum: registrar a visita que acabou de acontecer. */
  function usarAgora() {
    setData(new Date().toISOString().slice(0, 10));
    setHora(horaAgora());
  }

  const ehAgora = data === new Date().toISOString().slice(0, 10) && hora === horaAgora();

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
    <Tela
      titulo={id ? "Editar check-in" : "Novo check-in"}
      subtitulo={cliente?.nome}
      voltar="/checkins"
      capa
      comBarraInferior
    >
      <Painel titulo="Cliente" icone={<IconeCliente size={17} />}>
        {cliente ? (
          <LinhaLista
            iniciais={cliente.nome.slice(0, 2).toUpperCase()}
            titulo={cliente.nome}
            meta={[mascararCpfCnpj(cliente.cpfCnpj), cliente.cidadeEstado].filter(Boolean).join(" · ")}
            fim={id ? <span /> : undefined}
            onClick={id ? undefined : () => navigate(ROTA_ESCOLHER_CLIENTE)}
          />
        ) : (
          <Button variante="secundario" bloco onClick={() => navigate(ROTA_ESCOLHER_CLIENTE)}>
            Escolher cliente
          </Button>
        )}
      </Painel>

      <Painel
        titulo="Quando"
        icone={<IconeCalendario size={17} />}
        acao={
          // Antes eram dois campos nativos empilhados, sempre digitados na mão
          // mesmo quando a resposta era "agora".
          ehAgora ? undefined : (
            <Button variante="fantasma" className={css.linkAgora} onClick={usarAgora}>
              Agora
            </Button>
          )
        }
      >
        <div className={css.duplo}>
          <Input rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input rotulo="Horário" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </Painel>

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={!clienteId || !data || !hora || salvando}>
          {salvando ? "Salvando…" : "Salvar check-in"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
