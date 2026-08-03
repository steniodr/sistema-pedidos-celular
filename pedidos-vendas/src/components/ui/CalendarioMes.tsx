import css from "./ui.module.css";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const FORMATADOR_CABECALHO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function paraChaveData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Calendário de um mês, com navegação e marcador nos dias com dado (bolinha)
 * e no intervalo selecionado (dia, semana ou mês, ver `filtroPeriodoHistorico.ts`).
 */
export function CalendarioMes({
  mesExibido,
  diasComDados,
  intervaloSelecionado,
  onSelecionarDia,
  onMudarMes,
}: {
  mesExibido: Date;
  /** Dias com pedido, "YYYY-MM-DD" — ganham uma bolinha no calendário. */
  diasComDados?: Set<string>;
  /** Intervalo em destaque (o filtro ativo), inclusive nas duas pontas. */
  intervaloSelecionado?: { inicio: string; fim: string } | null;
  onSelecionarDia: (dataISO: string) => void;
  onMudarMes: (novoMes: Date) => void;
}) {
  const ano = mesExibido.getFullYear();
  const mes = mesExibido.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const offset = new Date(ano, mes, 1).getDay();

  const celulas: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(ano, mes, i + 1)),
  ];

  const rotuloMes = FORMATADOR_CABECALHO.format(mesExibido);

  return (
    <div className={css.calendario}>
      <div className={css.calendarioCabecalho}>
        <button
          type="button"
          className={css.calendarioNav}
          aria-label="Mês anterior"
          onClick={() => onMudarMes(new Date(ano, mes - 1, 1))}
        >
          ‹
        </button>
        <span className={css.calendarioMesRotulo}>
          {rotuloMes.charAt(0).toUpperCase() + rotuloMes.slice(1)}
        </span>
        <button
          type="button"
          className={css.calendarioNav}
          aria-label="Próximo mês"
          onClick={() => onMudarMes(new Date(ano, mes + 1, 1))}
        >
          ›
        </button>
      </div>

      <div className={css.calendarioSemana}>
        {DIAS_SEMANA.map((rotulo, i) => (
          <span key={i}>{rotulo}</span>
        ))}
      </div>

      <div className={css.calendarioGrade}>
        {celulas.map((data, i) => {
          if (!data) return <span key={i} />;
          const chave = paraChaveData(data);
          const temDados = diasComDados?.has(chave) ?? false;
          const noIntervalo =
            !!intervaloSelecionado &&
            chave >= intervaloSelecionado.inicio &&
            chave <= intervaloSelecionado.fim;
          const classes = [
            css.calendarioDia,
            temDados ? css["calendarioDia--comDados"] : "",
            noIntervalo ? css["calendarioDia--selecionado"] : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={i} type="button" className={classes} onClick={() => onSelecionarDia(chave)}>
              {data.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
