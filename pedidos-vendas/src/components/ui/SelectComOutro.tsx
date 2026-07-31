import { useEffect, useState } from "react";
import { Input, Select } from "./Field";

const OUTRO = "__outro__";

/**
 * Lista pré-carregada com opção "Outro" que revela um campo de texto livre.
 * Existe porque `<input list="...">` (datalist) não abre a lista em navegadores
 * mobile — só no desktop — então listas fechadas-mas-extensíveis usam `<select>`
 * nativo, que sempre abre.
 */
export function SelectComOutro({
  rotulo,
  obrigatorio,
  ajuda,
  opcoes,
  value,
  onChange,
  placeholderOutro,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: string;
  opcoes: string[];
  value: string;
  onChange: (valor: string) => void;
  placeholderOutro?: string;
}) {
  const [outro, setOutro] = useState(() => value.trim() !== "" && !opcoes.includes(value));

  // Reconcilia quando o valor chega depois (ex.: formulário carregado de forma assíncrona)
  // sem forçar saída do modo "Outro" enquanto o usuário digita um valor vazio temporário.
  useEffect(() => {
    if (value.trim() !== "" && !opcoes.includes(value)) setOutro(true);
  }, [value, opcoes]);

  function aoMudarSelect(valorEscolhido: string) {
    if (valorEscolhido === OUTRO) {
      setOutro(true);
      if (opcoes.includes(value)) onChange("");
    } else {
      setOutro(false);
      onChange(valorEscolhido);
    }
  }

  return (
    <>
      <Select
        rotulo={rotulo}
        obrigatorio={obrigatorio}
        ajuda={outro ? undefined : ajuda}
        value={outro ? OUTRO : opcoes.includes(value) ? value : ""}
        onChange={(e) => aoMudarSelect(e.target.value)}
      >
        <option value="" disabled>
          Selecione…
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
        <option value={OUTRO}>Outro</option>
      </Select>
      {outro && (
        <Input
          rotulo={`${rotulo} (outro)`}
          placeholder={placeholderOutro}
          value={value}
          ajuda={ajuda}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}
