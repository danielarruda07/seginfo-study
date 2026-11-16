import { describe, expect, it } from 'vitest';
import { agruparPorTecnica, consultaPorTecnica, rotaDoIndexador, tecnicaMae } from './wazuhIndexador.js';

describe('rota até o indexador', () => {
  it('direto na 9200 por padrão', () => {
    expect(rotaDoIndexador(new URL('https://manager:9200'))).toEqual({ porta: 9200, caminho: '/wazuh-alerts-*/_search', cabecalhos: {} });
    expect(rotaDoIndexador(new URL('https://manager')).porta).toBe(9200);
  });

  it('pelo proxy de console do dashboard na 443, com osd-xsrf', () => {
    const r = rotaDoIndexador(new URL('https://manager/api/console/proxy'));
    expect(r.porta).toBe(443);
    expect(r.caminho).toBe('/api/console/proxy?path=%2Fwazuh-alerts-*%2F_search&method=POST');
    expect(r.cabecalhos).toEqual({ 'osd-xsrf': 'true' });
  });
});

describe('alertas do Wazuh por técnica ATT&CK', () => {
  it('consulta só alertas com rule.mitre.id na janela pedida, sem documentos', () => {
    const c = consultaPorTecnica(30) as { size: number; query: { bool: { filter: unknown[] } } };
    expect(c.size).toBe(0);
    expect(JSON.stringify(c.query)).toContain('now-30d');
    expect(JSON.stringify(c.query)).toContain('rule.mitre.id');
  });

  it('separa produção (agentes prod-*) do laboratório', () => {
    const prod = JSON.stringify(consultaPorTecnica(30, 'producao'));
    const lab = consultaPorTecnica(30, 'laboratorio') as { query: { bool: { must_not: unknown[] } } };
    expect(prod).toContain('"prefix":{"agent.name":"prod-"}');
    expect(JSON.stringify(lab.query.bool.must_not)).toContain('prod-');
    expect((consultaPorTecnica(30) as { query: { bool: { must_not: unknown[] } } }).query.bool.must_not).toEqual([]);
  });

  it('subtécnica conta para a técnica-mãe', () => {
    expect(tecnicaMae('t1110.001')).toBe('T1110');
    expect(tecnicaMae('T1046')).toBe('T1046');
  });

  it('junta subtécnicas, soma regras repetidas e ignora IDs inválidos', () => {
    const regra = (id: string, n: number, desc: string, nivel: number) =>
      ({ key: id, doc_count: n, descricao: { buckets: [{ key: desc, doc_count: n }] }, nivel: { value: nivel } });
    const r = agruparPorTecnica({
      aggregations: {
        tecnicas: {
          buckets: [
            { key: 'T1110.001', doc_count: 40, ultimo: { value_as_string: '2026-11-15T10:00:00.000Z' }, agentes: { buckets: [{ key: 'range-honeypot', doc_count: 40 }] },
              regras: { buckets: [regra('5712', 30, 'sshd: brute force', 10), regra('5710', 10, 'sshd: usuário inexistente', 5)] } },
            { key: 'T1110', doc_count: 5, ultimo: { value_as_string: '2026-11-15T12:00:00.000Z' }, agentes: { buckets: [{ key: 'win-vitima', doc_count: 5 }] },
              regras: { buckets: [regra('5712', 5, 'sshd: brute force', 10)] } },
            { key: 'T1046', doc_count: 3, ultimo: { value_as_string: '2026-11-14T00:00:00.000Z' }, agentes: { buckets: [] }, regras: { buckets: [regra('40101', 3, 'scan', 6)] } },
            { key: 'lixo', doc_count: 99 },
          ],
        },
      },
    });
    expect(r.map((t) => t.id)).toEqual(['T1110', 'T1046']);
    const t1110 = r[0];
    expect(t1110.alertas).toBe(45);
    expect(t1110.ultimo).toBe('2026-11-15T12:00:00.000Z');
    expect(t1110.agentes).toEqual(['range-honeypot', 'win-vitima']);
    expect(t1110.regras[0]).toEqual({ id: '5712', descricao: 'sshd: brute force', nivel: 10, alertas: 35 });
  });

  it('resposta sem agregações vira lista vazia', () => {
    expect(agruparPorTecnica({})).toEqual([]);
  });
});
