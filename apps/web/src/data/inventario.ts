import type { Ativo, TipoAtivo } from '@seginfo/shared';
import { LABS } from './labs';

/**
 * Seed demonstrativo: não inclua topologia, endereços, domínios ou riscos reais
 * neste arquivo. Ativos reais devem ser cadastrados pelo usuário na interface.
 * 192.0.2.0/24 é uma faixa reservada para documentação (TEST-NET-1).
 */
const ids = [...new Set(LABS.flatMap((lab) => lab.ativosAlvo))];
const tipoPorId = (id: string): TipoAtivo => {
  if (id.includes('vlan')) return 'vlan';
  if (id.includes('pm')) return 'host';
  if (id.includes('vm')) return 'vm';
  if (id.includes('ct')) return 'container';
  if (id.includes('nas') || id.includes('linstor')) return 'storage';
  if (id.includes('vip') || id.includes('fg')) return 'firewall_policy';
  if (id.includes('2960')) return 'switch';
  return 'servico';
};

export const INVENTARIO_SEED: Ativo[] = ids.map((id, index) => ({
  id,
  ambiente: 'criecomia',
  tipo: tipoPorId(id),
  nome: `Ativo demonstrativo ${String(index + 1).padStart(2, '0')}`,
  endereco: `192.0.2.${index + 10}`,
  funcao: 'Exemplo fictício. Substitua pelos seus dados na tela do inventário.',
  estado: 'planejado',
  tags: ['exemplo', 'ficticio'],
  labsRelacionados: LABS.filter((lab) => lab.ativosAlvo.includes(id)).map((lab) => lab.id),
  detalhes: { aviso: 'Registro demonstrativo, não representa equipamento real.' },
}));
