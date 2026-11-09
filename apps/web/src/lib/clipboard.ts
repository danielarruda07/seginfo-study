/** Copia texto para a área de transferência (silencioso se a API não existir). */
export function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text);
}
