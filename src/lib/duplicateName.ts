/**
 * Utilitários para gerar nomes de cópias de forma limpa,
 * evitando acúmulos como "Tarefa (cópia) (cópia) (cópia)".
 */

const COPY_SUFFIX_REGEX = /\s*\(cópia(?:\s+(\d+))?\)\s*$/i;

/** Remove todos os sufixos "(cópia)" / "(cópia N)" do final do nome. */
export const stripCopySuffix = (name: string): string => {
  let base = name.trim();
  while (COPY_SUFFIX_REGEX.test(base)) {
    base = base.replace(COPY_SUFFIX_REGEX, "").trim();
  }
  return base || name.trim();
};

/** Monta o rótulo da cópia para um determinado índice (1 = "(cópia)"). */
const buildLabel = (base: string, index: number): string =>
  index <= 1 ? `${base} (cópia)` : `${base} (cópia ${index})`;

/**
 * Gera o próximo nome de cópia disponível, considerando os nomes já existentes.
 * Ex.: "Trabalho" -> "Trabalho (cópia)" -> "Trabalho (cópia 2)" -> "Trabalho (cópia 3)"
 */
export const buildCopyName = (originalName: string, existingNames: Iterable<string>): string => {
  const base = stripCopySuffix(originalName);
  const taken = new Set(
    Array.from(existingNames, (name) => name.trim().toLowerCase())
  );

  let index = 1;
  let candidate = buildLabel(base, index);
  while (taken.has(candidate.toLowerCase())) {
    index += 1;
    candidate = buildLabel(base, index);
  }
  return candidate;
};
