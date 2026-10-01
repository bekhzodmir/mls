/**
 * An export is requested with its purpose (§18.1 purpose limitation, §38.6
 * item 7): the purpose is written to the journal next to the export.
 */
export const MIN_PURPOSE_LENGTH = 5;

export function purposeError(purpose: string): "required" | "short" | undefined {
  const text = purpose.trim();
  if (text === "") return "required";
  return text.length < MIN_PURPOSE_LENGTH ? "short" : undefined;
}
