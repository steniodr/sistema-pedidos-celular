import "fake-indexeddb/auto";

// jsdom não implementa URL.createObjectURL/revokeObjectURL — usados só para
// disparar o download do arquivo exportado (Excel/PDF/backup), sem relevância
// para o que os testes de tela verificam.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}
