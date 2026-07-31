import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./features/home/HomePage";
import { ClientesPage } from "./features/clientes/ClientesPage";
import { ClienteFormPage } from "./features/clientes/ClienteFormPage";
import { ProdutosPage } from "./features/produtos/ProdutosPage";
import { ProdutoFormPage } from "./features/produtos/ProdutoFormPage";
import { ImportarProdutosPage } from "./features/produtos/ImportarProdutosPage";
import { NovoPedidoPage } from "./features/pedidos/NovoPedidoPage";
import { PedidoPage } from "./features/pedidos/PedidoPage";
import { ItemPedidoPage } from "./features/pedidos/ItemPedidoPage";
import { ResumoPedidoPage } from "./features/pedidos/ResumoPedidoPage";
import { FinalizarPedidoPage } from "./features/pedidos/FinalizarPedidoPage";
import { HistoricoPage } from "./features/pedidos/HistoricoPage";
import { ConfigPage } from "./features/config/ConfigPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/clientes" element={<ClientesPage />} />
      <Route path="/clientes/novo" element={<ClienteFormPage />} />
      <Route path="/clientes/:id" element={<ClienteFormPage />} />

      <Route path="/produtos" element={<ProdutosPage />} />
      <Route path="/produtos/importar" element={<ImportarProdutosPage />} />
      <Route path="/produtos/novo" element={<ProdutoFormPage />} />
      <Route path="/produtos/:id" element={<ProdutoFormPage />} />

      <Route path="/pedidos" element={<HistoricoPage />} />
      <Route path="/pedidos/novo" element={<NovoPedidoPage />} />
      <Route path="/pedidos/:id" element={<PedidoPage />} />
      <Route path="/pedidos/:id/item/:indice" element={<ItemPedidoPage />} />
      <Route path="/pedidos/:id/resumo" element={<ResumoPedidoPage />} />
      <Route path="/pedidos/:id/finalizar" element={<FinalizarPedidoPage />} />

      <Route path="/config" element={<ConfigPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
