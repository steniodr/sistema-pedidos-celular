import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryContext";
import { useDados } from "../../hooks/useDados";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BarraInferior, Tela } from "../../components/ui/Layout";
import { useToast } from "../../components/ui/Toast";
import { mascararTelefone } from "../../domain/cpfCnpj";
import { mensagemErro } from "../../domain/erros";
import type { Representante } from "../../domain/types";

const VAZIO: Representante = { nome: "", telefone: "", email: "" };

export function RepresentanteFormPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<Representante>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const { dados: salvo } = useDados(() => repo.obterRepresentante(), [repo]);

  useEffect(() => {
    if (salvo) setForm(salvo);
  }, [salvo]);

  async function salvar() {
    setSalvando(true);
    try {
      await repo.salvarRepresentante(form);
      toast.sucesso("Dados do representante salvos.");
      navigate(-1);
    } catch (e) {
      toast.erro(mensagemErro(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela titulo="Representante" voltar={true} comBarraInferior>
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

      <BarraInferior>
        <Button bloco onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </BarraInferior>
    </Tela>
  );
}
