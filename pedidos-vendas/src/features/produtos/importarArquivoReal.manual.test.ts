import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analisarLinhas, converter } from "./importarPlanilha";

/**
 * Validação pontual contra o arquivo real fornecido (não faz parte do CI de rotina,
 * já que depende de um arquivo fora do repositório versionado). Roda com:
 *   npx vitest run src/features/produtos/importarArquivoReal.manual.test.ts
 */
describe.skipIf(!process.env.ARQUIVO_TABELA_REAL)("arquivo real da tabela de preços", () => {
  it("é reconhecido como matriz e produz combinações plausíveis", async () => {
    const XLSX = await import("xlsx");
    const buffer = readFileSync(process.env.ARQUIVO_TABELA_REAL!);
    const pasta = XLSX.read(buffer, { type: "buffer", raw: true });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });

    const planilha = analisarLinhas(linhas);
    expect(planilha.formato).toBe("matriz");
    expect(planilha.colunasMatriz.produto).not.toBeNull();
    expect(planilha.colunasMatriz.embalagens.length).toBeGreaterThan(10);

    const { produtos, ignorados } = converter(planilha);
    expect(produtos.length).toBeGreaterThan(100);
    console.log("produtos:", produtos.length, "ignorados:", ignorados.length);
    console.log("amostra:", produtos.slice(0, 5));
    if (ignorados.length) console.log("avisos:", ignorados.slice(0, 10));
  });
});
