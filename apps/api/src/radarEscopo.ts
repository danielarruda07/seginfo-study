import { BlockList, isIP } from 'node:net';

/**
 * Escopo do evento de ataque:
 *  - `internet`: origem em IP público (o que de fato chega de fora);
 *  - `interno`: origem em rede privada/reservada (exercícios do range, Kali, testes) ou sem IP
 *    (lockout do Windows, que não informa origem).
 *
 * Gravado na ingestão (coluna `escopo`). A migration 20261114000000_ataque_escopo aplica as
 * mesmas faixas aos eventos antigos; mantenha as duas listas iguais.
 */
export type EscopoAtaque = 'internet' | 'interno';

export const FAIXAS_INTERNAS: [string, number, 'ipv4' | 'ipv6'][] = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
];

const internas = new BlockList();
for (const [rede, prefixo, tipo] of FAIXAS_INTERNAS) internas.addSubnet(rede, prefixo, tipo);

export function escopoDoIp(ip: string | null | undefined): EscopoAtaque {
  if (!ip) return 'interno';
  const v = isIP(ip);
  if (v === 0) return 'interno';
  // IPv4 mapeado em IPv6 (::ffff:10.0.0.1) é avaliado como IPv4
  const mapeado = v === 6 ? /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1] : undefined;
  if (mapeado) return internas.check(mapeado, 'ipv4') ? 'interno' : 'internet';
  return internas.check(ip, v === 4 ? 'ipv4' : 'ipv6') ? 'interno' : 'internet';
}
