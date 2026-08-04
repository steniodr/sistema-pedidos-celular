import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import css from "./ui.module.css";

interface BaseCampo {
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: string;
  erro?: string;
}

function Envoltorio({
  rotulo,
  obrigatorio,
  ajuda,
  erro,
  id,
  children,
}: BaseCampo & { id: string; children: ReactNode }) {
  return (
    <div className={css.campo}>
      <label className={css.campoRotulo} htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className={css.campoObrigatorio}> *</span>}
      </label>
      {children}
      {erro ? (
        <span className={css.campoErro}>{erro}</span>
      ) : ajuda ? (
        <span className={css.campoAjuda}>{ajuda}</span>
      ) : null}
    </div>
  );
}

function classeControle(erro?: string): string {
  return [css.campoControle, erro ? css["campoControle--invalido"] : ""]
    .filter(Boolean)
    .join(" ");
}

export function Input({
  rotulo,
  obrigatorio,
  ajuda,
  erro,
  sugestoes,
  ...props
}: BaseCampo & InputHTMLAttributes<HTMLInputElement> & { sugestoes?: string[] }) {
  const id = useId();
  const idLista = `${id}-lista`;
  return (
    <Envoltorio rotulo={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} erro={erro} id={id}>
      <input
        id={id}
        className={classeControle(erro)}
        list={sugestoes?.length ? idLista : undefined}
        aria-invalid={erro ? true : undefined}
        {...props}
      />
      {sugestoes && sugestoes.length > 0 && (
        <datalist id={idLista}>
          {sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Envoltorio>
  );
}

export function Textarea({
  rotulo,
  obrigatorio,
  ajuda,
  erro,
  ...props
}: BaseCampo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Envoltorio rotulo={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} erro={erro} id={id}>
      <textarea id={id} rows={3} className={classeControle(erro)} {...props} />
    </Envoltorio>
  );
}

export function Checkbox({
  rotulo,
  checked,
  onChange,
  ajuda,
}: {
  rotulo: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  ajuda?: string;
}) {
  const id = useId();
  return (
    <div className={css.campo}>
      <label className={css.checkboxLinha} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className={css.checkboxControle}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{rotulo}</span>
      </label>
      {ajuda && <span className={css.campoAjuda}>{ajuda}</span>}
    </div>
  );
}

export function Select({
  rotulo,
  obrigatorio,
  ajuda,
  erro,
  children,
  ...props
}: BaseCampo & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Envoltorio rotulo={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} erro={erro} id={id}>
      <select id={id} className={classeControle(erro)} {...props}>
        {children}
      </select>
    </Envoltorio>
  );
}
