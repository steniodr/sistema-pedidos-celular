import { analisarLinhas, type PlanilhaLida } from "./importarPlanilha";

/**
 * Lê .xlsx/.xls/.csv no navegador e devolve as linhas cruas já analisadas.
 * SheetJS fica só na leitura — a escrita do pedido usa ExcelJS, que preserva formatação.
 */
export async function lerArquivoPlanilha(arquivo: File): Promise<PlanilhaLida> {
  // SheetJS é pesado e só é usado na importação: carrega sob demanda.
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });

  const nomeAba = pasta.SheetNames[0];
  if (!nomeAba) throw new Error("O arquivo não tem nenhuma aba.");

  const aba = pasta.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  if (linhas.length === 0) throw new Error("A planilha está vazia.");

  return analisarLinhas(linhas);
}
