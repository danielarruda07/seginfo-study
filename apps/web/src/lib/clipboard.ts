/** Copia texto para a área de transferência (silencioso se a API não existir). */
export function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text);
}

let clearSensitiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Copia um segredo e tenta limpá-lo após 30 s, sem apagar conteúdo copiado depois. */
export async function copySensitiveToClipboard(secret: string): Promise<void> {
  if (!navigator.clipboard?.writeText) return;
  try { await navigator.clipboard.writeText(secret); } catch { return; }
  if (clearSensitiveTimer) clearTimeout(clearSensitiveTimer);
  clearSensitiveTimer = setTimeout(async () => {
    try {
      if (navigator.clipboard.readText && await navigator.clipboard.readText() === secret) {
        await navigator.clipboard.writeText('');
      }
    } catch {
      // Se o navegador negar leitura, não apagamos conteúdo copiado por outra ação.
    }
    clearSensitiveTimer = null;
  }, 30_000);
}
