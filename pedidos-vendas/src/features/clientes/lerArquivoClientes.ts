import { analisarLinhasClientes, type PlanilhaLidaClientes } from "./importarClientesPlanilha";

/** Lê .xlsx/.xls/.csv no navegador e devolve as linhas cruas já analisadas. */
export async function lerArquivoClientes(arquivo: File): Promise<PlanilhaLidaClientes> {
  // SheetJS é pesado e só é usado na importação: carrega sob demanda.
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });

  const nomeAba =
    pasta.SheetNames.find((n) => n.toLowerCase().includes("base de clientes")) ??
    pasta.SheetNames[0];
  if (!nomeAba) throw new Error("O arquivo não tem nenhuma aba.");

  const aba = pasta.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  if (linhas.length === 0) throw new Error("A planilha está vazia.");

  return analisarLinhasClientes(linhas);
}
