import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useToast } from "./components/ui/Toast";
import { aoAtualizarDisponivel, aplicarAtualizacao, haAtualizacaoDisponivel } from "./pwa";
import { HomePage } from "./features/home/HomePage";
import { ClientesPage } from "./features/clientes/ClientesPage";
import { ClienteFormPage } from "./features/clientes/ClienteFormPage";
import { ImportarClientesPage } from "./features/clientes/ImportarClientesPage";
import { ProdutosPage } from "./features/produtos/ProdutosPage";
import { ProdutoFormPage } from "./features/produtos/ProdutoFormPage";
import { ImportarProdutosPage } from "./features/produtos/ImportarProdutosPage";
import { NovoPedidoPage } from "./features/pedidos/NovoPedidoPage";
import { PedidoPage } from "./features/pedidos/PedidoPage";
import { ItemPedidoPage } from "./features/pedidos/ItemPedidoPage";
import { ResumoPedidoPage } from "./features/pedidos/ResumoPedidoPage";
import { FinalizarPedidoPage } from "./features/pedidos/FinalizarPedidoPage";
import { HistoricoPage } from "./features/pedidos/HistoricoPage";
import { CheckInsPage } from "./features/checkin/CheckInsPage";
import { CheckInFormPage } from "./features/checkin/CheckInFormPage";
import { RelatoriosPage } from "./features/relatorios/RelatoriosPage";
import { ConfigPage } from "./features/config/ConfigPage";
import { RepresentanteFormPage } from "./features/config/RepresentanteFormPage";

export function App() {
  const toast = useToast();

  useEffect(() => {
    function avisar() {
      toast.acao("Nova versão do app disponível.", "Atualizar agora", () => {
        void aplicarAtualizacao();
      });
    }
    if (haAtualizacaoDisponivel()) avisar();
    return aoAtualizarDisponivel(avisar);
  }, [toast]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/clientes" element={<ClientesPage />} />
      <Route path="/clientes/novo" element={<ClienteFormPage />} />
      <Route path="/clientes/importar" element={<ImportarClientesPage />} />
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

      <Route path="/checkins" element={<CheckInsPage />} />
      <Route path="/checkins/novo" element={<CheckInFormPage />} />
      <Route path="/checkins/:id" element={<CheckInFormPage />} />

      <Route path="/relatorios" element={<RelatoriosPage />} />

      <Route path="/config" element={<ConfigPage />} />
      <Route path="/config/representante" element={<RepresentanteFormPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
