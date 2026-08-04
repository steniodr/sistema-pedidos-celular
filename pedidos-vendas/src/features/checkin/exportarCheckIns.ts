import type { CheckIn, Cliente } from "../../domain/types";
import { formatarData } from "../produtos/statusBase";

/**
 * Lista simples do check-in (nome do cliente, horário, código do cliente),
 * agrupada por data — pensada pra conferência/roteiro do dia. Migrado de
 * `src/features/pedidos/exportarHistorico.ts`: antes o horário vinha do
 * pedido (`Pedido.horaPedido`), agora vem direto do check-in.
 */

export interface LinhaCheckIn {
  data: string;
  hora: string;
  clienteNome: string;
  clienteCodigo: string;
}

export function linhasDeCheckIns(
  checkIns: CheckIn[],
  clientesPorId: Map<string, Cliente>,
): LinhaCheckIn[] {
  return checkIns.map((checkIn) => {
    const cliente = clientesPorId.get(checkIn.clienteId);
    return {
      data: checkIn.data,
      hora: checkIn.hora,
      clienteNome: cliente?.nome ?? "Cliente removido",
      clienteCodigo: cliente?.codigoCliente ?? "",
    };
  });
}

/** Mais recente primeiro; dentro do dia, ordem cronológica (roteiro de visitas). */
function agruparPorData(linhas: LinhaCheckIn[]): Map<string, LinhaCheckIn[]> {
  const porData = new Map<string, LinhaCheckIn[]>();
  for (const linha of linhas) {
    const grupo = porData.get(linha.data) ?? [];
    grupo.push(linha);
    porData.set(linha.data, grupo);
  }
  const datas = [...porData.keys()].sort((a, b) => b.localeCompare(a));
  const ordenado = new Map<string, LinhaCheckIn[]>();
  for (const data of datas) {
    ordenado.set(
      data,
      [...porData.get(data)!].sort((a, b) => a.hora.localeCompare(b.hora)),
    );
  }
  return ordenado;
}

/** "16/07" — dia e mês, sem ano (data é "YYYY-MM-DD"). */
function dataCurta(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/**
 * Texto simples pra colar em outro app (ex.: WhatsApp) — mesmo agrupamento
 * do PDF, uma linha "hora nome código" por check-in.
 */
export function montarTextoCheckIns(linhas: LinhaCheckIn[]): string {
  const porData = agruparPorData(linhas);
  const blocos: string[] = [];
  for (const [data, grupo] of porData) {
    const corpo = grupo
      .map((l) => [l.hora, l.clienteNome, l.clienteCodigo].filter(Boolean).join(" "))
      .join("\n");
    blocos.push(`${dataCurta(data)}\n${corpo}`);
  }
  return blocos.join("\n\n");
}

const MARGEM = 14;
const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const LIMITE_RODAPE = ALTURA_A4 - 20;
const AZUL_MARCA: [number, number, number] = [28, 115, 183];
const BORDA_GRADE: [number, number, number] = [201, 214, 226];

export async function gerarPdfCheckIns(linhas: LinhaCheckIn[], titulo: string): Promise<Blob> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  let y = MARGEM;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, MARGEM, y);
  y += 8;

  const porData = agruparPorData(linhas);
  const datas = [...porData.keys()];

  if (datas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum check-in neste filtro.", MARGEM, y + 4);
    return doc.output("blob");
  }

  for (const data of datas) {
    if (y + 14 > LIMITE_RODAPE) {
      doc.addPage();
      y = MARGEM;
    }

    doc.setFillColor(...AZUL_MARCA);
    doc.rect(MARGEM, y, LARGURA_A4 - 2 * MARGEM, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(formatarData(data), MARGEM + 3, y + 5);
    y += 10;
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Horário", MARGEM, y);
    doc.text("Cliente", MARGEM + 22, y);
    doc.text("Código", LARGURA_A4 - MARGEM - 20, y);
    y += 1.5;
    doc.setDrawColor(...BORDA_GRADE);
    doc.line(MARGEM, y, LARGURA_A4 - MARGEM, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const linha of porData.get(data)!) {
      if (y + 6 > LIMITE_RODAPE) {
        doc.addPage();
        y = MARGEM;
      }
      doc.text(linha.hora, MARGEM, y);
      doc.text(linha.clienteNome, MARGEM + 22, y);
      doc.text(linha.clienteCodigo, LARGURA_A4 - MARGEM - 20, y);
      y += 6;
    }
    y += 4;
  }

  return doc.output("blob");
}
