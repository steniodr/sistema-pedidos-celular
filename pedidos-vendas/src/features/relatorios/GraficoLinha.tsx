import { useRef, useState } from "react";
import { formatarMoeda } from "../../domain/calculos";
import type { PontoSerieTempo } from "../../domain/relatorios";
import css from "./relatorios.module.css";

/**
 * Linha do tempo desenhada à mão em SVG (sem lib de gráfico) — usada só no
 * detalhe (categoria/produto/cliente selecionado), nunca na visão geral.
 */
const LARGURA = 320;
const ALTURA = 140;
const MARGEM_ESQUERDA = 8;
const MARGEM_DIREITA = 8;
const MARGEM_TOPO = 16;
const MARGEM_BASE = 28;

interface GraficoLinhaProps {
  pontos: PontoSerieTempo[];
}

export function GraficoLinha({ pontos }: GraficoLinhaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);

  if (pontos.length < 2) {
    return (
      <p className="texto-suave">
        Ainda não há pontos suficientes nesse período pra desenhar uma linha do tempo.
      </p>
    );
  }

  const valorMaximo = Math.max(...pontos.map((p) => p.valorTotal), 0);
  const areaLargura = LARGURA - MARGEM_ESQUERDA - MARGEM_DIREITA;
  const areaAltura = ALTURA - MARGEM_TOPO - MARGEM_BASE;

  const posicoes = pontos.map((ponto, i) => {
    const x = MARGEM_ESQUERDA + (areaLargura * i) / (pontos.length - 1);
    const y =
      valorMaximo > 0
        ? MARGEM_TOPO + areaAltura - (ponto.valorTotal / valorMaximo) * areaAltura
        : MARGEM_TOPO + areaAltura;
    return { ...ponto, x, y };
  });

  const caminho = posicoes.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Linhas de grade horizontais em valores redondos — 0, metade e o máximo.
  const gridValores = [0, valorMaximo / 2, valorMaximo];

  // Só alguns rótulos no eixo X (senão amontoa) — primeiro, último e meio.
  const indicesComRotulo = new Set(
    [0, Math.floor((pontos.length - 1) / 2), pontos.length - 1].filter((i, idx, arr) => arr.indexOf(i) === idx),
  );

  function moverPonteiro(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const retangulo = svg.getBoundingClientRect();
    const xRelativo = ((clientX - retangulo.left) / retangulo.width) * LARGURA;
    let maisProximo = 0;
    let menorDistancia = Infinity;
    posicoes.forEach((p, i) => {
      const distancia = Math.abs(p.x - xRelativo);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        maisProximo = i;
      }
    });
    setIndiceAtivo(maisProximo);
  }

  const ativo = indiceAtivo !== null ? posicoes[indiceAtivo] : null;

  return (
    <div className={css.linhaGrafico}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className={css.linhaSvg}
        role="img"
        aria-label="Evolução das vendas ao longo do tempo"
        onPointerMove={(e) => moverPonteiro(e.clientX)}
        onPointerLeave={() => setIndiceAtivo(null)}
      >
        {gridValores.map((valor, i) => {
          const y = MARGEM_TOPO + areaAltura - (valorMaximo > 0 ? (valor / valorMaximo) * areaAltura : 0);
          return (
            <line
              key={i}
              x1={MARGEM_ESQUERDA}
              x2={LARGURA - MARGEM_DIREITA}
              y1={y}
              y2={y}
              className={css.linhaGrade}
            />
          );
        })}

        <path d={caminho} className={css.linhaCaminho} fill="none" />

        {posicoes.map((p, i) => (
          <g key={p.chave}>
            {indicesComRotulo.has(i) && (
              <text x={p.x} y={ALTURA - 8} textAnchor="middle" className={css.linhaRotuloEixo}>
                {p.rotulo}
              </text>
            )}
            {i === posicoes.length - 1 && (
              <text x={p.x} y={p.y - 10} textAnchor="end" className={css.linhaRotuloValor}>
                {formatarMoeda(p.valorTotal)}
              </text>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={i === indiceAtivo || i === posicoes.length - 1 ? 4.5 : 3}
              className={css.linhaPonto}
            />
          </g>
        ))}
      </svg>

      {ativo && (
        <div
          className={css.linhaTooltip}
          style={{ left: `${(ativo.x / LARGURA) * 100}%`, top: `${(ativo.y / ALTURA) * 100}%` }}
        >
          <strong>{formatarMoeda(ativo.valorTotal)}</strong>
          <span>{ativo.rotulo}</span>
        </div>
      )}
    </div>
  );
}
