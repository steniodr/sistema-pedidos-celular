import { useEffect, useState } from "react";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button, LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Cartao, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararTelefone } from "../../domain/cpfCnpj";
import type { Representante } from "../../domain/types";
import { semearClientesTeste } from "../clientes/clientesTeste";
import { avaliarBase, formatarDataHora } from "../produtos/statusBase";

const VAZIO: Representante = { nome: "", telefone: "", email: "" };

export function ConfigPage() {
  const repo = useRepository();
  const toast = useToast();
  const [form, setForm] = useState<Representante>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [semeando, setSemeando] = useState(false);

  const { dados: salvo } = useDados(() => repo.obterRepresentante(), [repo]);
  const { dados: importacao } = useDados(() => repo.obterUltimaImportacao(), [repo]);
  const statusBase = avaliarBase(importacao);

  useEffect(() => {
    if (salvo) setForm(salvo);
  }, [salvo]);

  async function salvar() {
    setSalvando(true);
    try {
      await repo.salvarRepresentante(form);
      toast.sucesso("Dados do representante salvos.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function criarClientesTeste() {
    setSemeando(true);
    try {
      const criados = await semearClientesTeste(repo);
      toast.sucesso(
        criados > 0
          ? `${criados} cliente(s) de teste criado(s).`
          : "Os clientes de teste já existem.",
      );
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Não foi possível criar os clientes de teste.");
    } finally {
      setSemeando(false);
    }
  }

  return (
    <Tela titulo="Configurações" voltar="/" comBarraInferior>
      <h2 className="secao-titulo">Representante</h2>
      <p className="texto-suave">
        Preenchido automaticamente no rodapé de todo pedido novo.
      </p>
      <Input
        rotulo="Nome"
        value={form.nome}
        onChange={(e) => setForm({ ...form, nome: e.target.value })}
      />
      <Input
        rotulo="Telefone"
        inputMode="tel"
        value={mascararTelefone(form.telefone)}
        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
      />
      <Input
        rotulo="E-mail"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <h2 className="secao-titulo">Base de produtos</h2>
      <Cartao>
        <p className="texto-suave">
          {importacao
            ? `${importacao.totalProdutos} produtos · última importação em ${formatarDataHora(importacao.quandoEm)} (${statusBase.mensagem.toLowerCase()})`
            : "Nenhuma base importada ainda."}
        </p>
      </Cartao>
      <LinkButton to="/produtos/importar" variante="secundario">
        Importar base de produtos
      </LinkButton>

      <h2 className="secao-titulo">Testes</h2>
      <p className="texto-suave">
        Cria 2 clientes de exemplo (“(teste)” no nome) para experimentar o app sem
        digitar dados. Depois, abra o cliente em Clientes e toque em “Excluir
        cliente” para remover.
      </p>
      <Button variante="secundario" onClick={criarClientesTeste} disabled={semeando}>
        {semeando ? "Criando…" : "Criar clientes de teste"}
      </Button>

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
