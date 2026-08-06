import { formatarMoeda } from "../../domain/calculos";
import css from "./relatorios.module.css";

/**
 * Rosca (donut) desenhada à mão em SVG — sem lib de gráfico, ver README.
 * Paleta categórica validada (skill de dataviz, `references/palette.md`),
 * conferida com `scripts/validate_palette.js` contra a superfície real do
 * app (`--cor-superficie: #fff`): 8 tons, ordem fixa, nunca ciclada.
 */
const CORES_CATEGORICAS = [
  "#2a78d6", // azul
  "#eb6834", // laranja
  "#1baf7a", // água
  "#eda100", // amarelo
  "#e87ba4", // magenta
  "#008300", // verde
];
/** Cinza neutro do grupo "Outros" — nunca uma cor categórica (evita se passar por uma série de verdade). */
const COR_OUTROS = "#c3c2b7";
/** Rosca é só uma visão geral "de relance" — os detalhes ficam na própria legenda abaixo dela. */
const MAX_FATIAS_VISIVEIS = 6;

export interface FatiaRosca {
  rotulo: string;
  valor: number;
}

interface GraficoRoscaProps {
  fatias: FatiaRosca[];
  rotuloCentro?: string;
  selecionado?: string | null;
  onSelecionar?: (rotulo: string) => void;
}

const RAIO = 60;
const ESPESSURA = 22;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function GraficoRosca({
  fatias,
  rotuloCentro = "Total",
  selecionado,
  onSelecionar,
}: GraficoRoscaProps) {
  const total = fatias.reduce((soma, f) => soma + Math.max(0, f.valor), 0);

  if (total <= 0) {
    return <p className="texto-suave">Sem dados suficientes pra esse gráfico ainda.</p>;
  }

  const ordenadas = [...fatias].sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, MAX_FATIAS_VISIVEIS);
  const restante = ordenadas.slice(MAX_FATIAS_VISIVEIS);
  const valorOutros = restante.reduce((soma, f) => soma + f.valor, 0);
  const exibidas: FatiaRosca[] =
    valorOutros > 0 ? [...principais, { rotulo: "Outros", valor: valorOutros }] : principais;

  let acumulado = 0;
  const comLayout = exibidas.map((fatia, indice) => {
    const comprimento = (fatia.valor / total) * CIRCUNFERENCIA;
    const offset = -((acumulado / total) * CIRCUNFERENCIA);
    acumulado += fatia.valor;
    const cor = fatia.rotulo === "Outros" ? COR_OUTROS : CORES_CATEGORICAS[indice % CORES_CATEGORICAS.length];
    return { ...fatia, cor, comprimento, offset, indice };
  });

  return (
    <div className={css.rosca}>
      <svg
        viewBox="0 0 160 160"
        className={css.roscaSvg}
        role="img"
        aria-label={`Distribuição de ${rotuloCentro}, total ${formatarMoeda(total)}`}
      >
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={RAIO} fill="none" stroke="var(--cor-borda)" strokeWidth={ESPESSURA} />
          {comLayout.map((fatia) => {
            const clicavel = fatia.rotulo !== "Outros" && !!onSelecionar;
            const ativa = selecionado != null && fatia.rotulo === selecionado;
            return (
              <circle
                key={fatia.rotulo}
                cx="80"
                cy="80"
                r={RAIO}
                fill="none"
                stroke={fatia.cor}
                strokeWidth={ativa ? ESPESSURA + 6 : ESPESSURA}
                strokeDasharray={`${fatia.comprimento} ${CIRCUNFERENCIA - fatia.comprimento}`}
                strokeDashoffset={fatia.offset}
                className={css.roscaFatia}
                style={{
                  animationDelay: `${fatia.indice * 60}ms`,
                  cursor: clicavel ? "pointer" : "default",
                }}
                tabIndex={clicavel ? 0 : undefined}
                role={clicavel ? "button" : undefined}
                aria-label={clicavel ? `${fatia.rotulo}: ${formatarMoeda(fatia.valor)}` : undefined}
                onClick={() => clicavel && onSelecionar?.(fatia.rotulo)}
                onKeyDown={(e) => {
                  if (clicavel && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelecionar?.(fatia.rotulo);
                  }
                }}
              />
            );
          })}
        </g>
        <text x="80" y="86" textAnchor="middle" className={css.roscaCentroValor}>
          {formatarMoeda(total)}
        </text>
      </svg>

      {/* Nome da categoria/grupo fora do SVG — o círculo central é estreito
          demais pra caber nomes longos (ex.: categorias compridas da base). */}
      <p className={css.roscaRotulo}>{rotuloCentro}</p>

      <ul className={css.roscaLegenda}>
        {comLayout.map((fatia) => {
          const pct = (fatia.valor / total) * 100;
          const clicavel = fatia.rotulo !== "Outros" && !!onSelecionar;
          const ativa = selecionado != null && fatia.rotulo === selecionado;
          return (
            <li key={fatia.rotulo} style={{ animationDelay: `${fatia.indice * 40}ms` }}>
              <button
                type="button"
                className={`${css.roscaLegendaItem} ${ativa ? css["roscaLegendaItem--ativo"] : ""}`}
                onClick={() => clicavel && onSelecionar?.(fatia.rotulo)}
                disabled={!clicavel}
              >
                <span className={css.roscaSwatch} style={{ background: fatia.cor }} aria-hidden="true" />
                <span className={css.roscaLegendaRotulo}>{fatia.rotulo}</span>
                <span className="texto-suave">
                  {formatarMoeda(fatia.valor)} · {pct.toFixed(0)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
