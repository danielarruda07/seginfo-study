/** Dias a partir dos quais uma informação confirmada é tratada como desatualizada. */
export const DIAS_CONFIRMACAO_VELHA = 90;

export interface IdadeConfirmacao {
  texto: string;
  /** true quando nunca foi confirmada ou a confirmação passou do prazo. */
  rever: boolean;
}

/** Descreve há quanto tempo uma informação (ativo, credencial) foi confirmada. `data` em YYYY-MM-DD. */
export function idadeConfirmacao(data: string | undefined, hoje: Date = new Date()): IdadeConfirmacao {
  if (!data || !/^\d{4}-\d{2}-\d{2}/.test(data)) return { texto: 'Não confirmado', rever: true };
  const [a, m, d] = data.slice(0, 10).split('-').map(Number) as [number, number, number];
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const dias = Math.round((inicioHoje - new Date(a, m - 1, d).getTime()) / 86_400_000);
  const dataBr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  return { texto: `${dataBr} (${quando})`, rever: dias > DIAS_CONFIRMACAO_VELHA };
}
