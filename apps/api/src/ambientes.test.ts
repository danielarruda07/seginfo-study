import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ambienteDoAtivo, ambienteDoEvento, AtaqueEventoInSchema } from '@seginfo/shared';
import { escopoDoIp } from './radarEscopo.js';
const db = vi.hoisted(() => ({ raw: vi.fn(async () => []), count: vi.fn(async () => 0), findMany: vi.fn(async () => []) }));
vi.mock('./db.js', () => ({ prisma: { $queryRaw: db.raw, ataqueEvento: { count: db.count, findMany: db.findMany } } }));
import { registerRadarRoutes } from './radar.js';
beforeEach(() => vi.clearAllMocks());
describe('separação de ambientes', () => {
  it('usa labels antes de prefixos e suporta formato de lista da API', () => {
    expect(ambienteDoAtivo({ name: 'range-test', labels: { environment: 'production' } })).toBe('producao');
    expect(ambienteDoAtivo({ name: 'outro', labels: [{ key: 'environment', value: 'production' }] })).toBe('producao');
    expect(ambienteDoAtivo({ group: ['prod-linux'] })).toBe('producao');
    expect(ambienteDoAtivo({ group: ['range-windows'] })).toBe('laboratorio');
  });
  it('IP privado não implica laboratório', () => {
    expect(escopoDoIp('192.168.1.20')).toBe('interno');
    expect(ambienteDoEvento({ fonte: 'wazuh', alvo: 'prod-workstation' })).toBe('producao');
    expect(ambienteDoEvento({ fonte: 'windows', alvo: 'range-workstation' })).toBe('laboratorio');
  });
  it('não classifica o firewall pelo nome do manager que o recebeu', () => {
    expect(ambienteDoEvento({ fonte: 'fortigate', detalhes: { sensor: 'range-wazuh' } })).toBe('nao_classificado');
    expect(ambienteDoAtivo({ id: '000', name: 'range-wazuh' })).toBe('nao_classificado');
    expect(ambienteDoEvento({ fonte: 'fortigate', ambiente: 'laboratorio' })).toBe('laboratorio');
  });
  it('não inventa IP em eventos locais de produção e mantém a validação legada', () => {
    const event = { fonte: 'wazuh', ambiente: 'producao', ocorridoEm: '2026-11-15T00:00:00Z', acao: 'outro' };
    expect(AtaqueEventoInSchema.safeParse(event).success).toBe(true);
    expect(AtaqueEventoInSchema.safeParse({ ...event, ambiente: 'laboratorio' }).success).toBe(false);
    expect(AtaqueEventoInSchema.safeParse({ ...event, fonte: 'cowrie' }).success).toBe(false);
  });

  it('aceita sem IP só o arquivo detectado na isca web (FIM), não qualquer download', () => {
    const fim = { fonte: 'isca', ocorridoEm: '2026-11-16T00:00:00Z', acao: 'download', detalhes: { arquivo: '/srv/site/x.php' } };
    expect(AtaqueEventoInSchema.safeParse(fim).success).toBe(true);
    expect(AtaqueEventoInSchema.safeParse({ ...fim, detalhes: {} }).success).toBe(false);
    expect(AtaqueEventoInSchema.safeParse({ ...fim, fonte: 'cowrie' }).success).toBe(false);
  });
  it('aplica ambiente em todas as agregações do resumo, preservando o dono dos dados', async () => {
    const app = Fastify(); app.addHook('preHandler', async (r) => { (r as any).usuarioId = 'dono'; }); await registerRadarRoutes(app);
    const r = await app.inject('/api/radar/resumo?ambiente=producao&escopo=todos');
    expect(r.statusCode).toBe(200);
    expect(r.json().ambiente).toBe('producao');
    const parametros = (v: unknown): unknown[] => Array.isArray(v) ? v.flatMap(parametros)
      : v && typeof v === 'object' && 'values' in v ? parametros(v.values) : [v];
    for (const call of db.raw.mock.calls) {
      expect(parametros(call)).toContain('dono'); expect(parametros(call)).toContain('producao');
    }
    await app.close();
  });
  it('filtra lista por ambiente e rejeita filtros inválidos', async () => {
    const app = Fastify(); app.addHook('preHandler', async (r) => { (r as any).usuarioId = 'dono'; }); await registerRadarRoutes(app);
    expect((await app.inject('/api/radar/eventos?ambiente=laboratorio')).statusCode).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usuarioId: 'dono', ambiente: 'laboratorio' }) }));
    expect((await app.inject('/api/wazuh/alertas?ambiente=qualquer')).statusCode).toBe(400);
    await app.close();
  });
});
