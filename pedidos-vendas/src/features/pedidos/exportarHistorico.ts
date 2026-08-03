import type { Cliente, Pedido } from "../../domain/types";
import { formatarData } from "../produtos/statusBase";

/**
 * Lista simples do histórico (nome do cliente, horário, código do cliente),
 * agrupada por data do pedido — pensada pra conferência/roteiro do dia, não
 * pra substituir o Excel/PDF de cada pedido individual (ver `export/pdf.ts`).
 */

export interface LinhaHistorico {
  dataPedido: string;
  horaPedido: string;
  clienteNome: string;
  clienteCodigo: string;
}

/** Pedidos sem `horaPedido` (criados antes desse campo existir) caem no horário de criação. */
function horaDoPedido(pedido: Pedido): string {
  if (pedido.horaPedido) return pedido.horaPedido;
  const d = new Date(pedido.criadoEm);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function montarLinhasHistorico(
  pedidos: Pedido[],
  clientesPorId: Map<string, Cliente>,
): LinhaHistorico[] {
  return pedidos.map((pedido) => {
    const cliente = clientesPorId.get(pedido.clienteId);
    return {
      dataPedido: pedido.dataPedido,
      horaPedido: horaDoPedido(pedido),
      clienteNome: cliente?.nome ?? "Cliente removido",
      clienteCodigo: cliente?.codigoCliente ?? "",
    };
  });
}

/** Mais recente primeiro; dentro do dia, ordem cronológica (roteiro de visitas). */
function agruparPorData(linhas: LinhaHistorico[]): Map<string, LinhaHistorico[]> {
  const porData = new Map<string, LinhaHistorico[]>();
  for (const linha of linhas) {
    const grupo = porData.get(linha.dataPedido) ?? [];
    grupo.push(linha);
    porData.set(linha.dataPedido, grupo);
  }
  const datas = [...porData.keys()].sort((a, b) => b.localeCompare(a));
  const ordenado = new Map<string, LinhaHistorico[]>();
  for (const data of datas) {
    ordenado.set(
      data,
      [...porData.get(data)!].sort((a, b) => a.horaPedido.localeCompare(b.horaPedido)),
    );
  }
  return ordenado;
}

/** "16/07" — dia e mês, sem ano (dataPedido é "YYYY-MM-DD"). */
function dataCurta(dataPedido: string): string {
  return `${dataPedido.slice(8, 10)}/${dataPedido.slice(5, 7)}`;
}

/**
 * Texto simples pra colar em outro app (ex.: WhatsApp) — mesmo agrupamento
 * do PDF, uma linha "hora nome código" por pedido.
 */
export function montarTextoHistorico(linhas: LinhaHistorico[]): string {
  const porData = agruparPorData(linhas);
  const blocos: string[] = [];
  for (const [data, grupo] of porData) {
    const corpo = grupo
      .map((l) => [l.horaPedido, l.clienteNome, l.clienteCodigo].filter(Boolean).join(" "))
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

export async function gerarPdfHistorico(
  linhas: LinhaHistorico[],
  titulo: string,
): Promise<Blob> {
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
    doc.text("Nenhum pedido neste filtro.", MARGEM, y + 4);
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
      doc.text(linha.horaPedido, MARGEM, y);
      doc.text(linha.clienteNome, MARGEM + 22, y);
      doc.text(linha.clienteCodigo, LARGURA_A4 - MARGEM - 20, y);
      y += 6;
    }
    y += 4;
  }

  return doc.output("blob");
}
