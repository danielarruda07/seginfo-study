import https from 'node:https';

/**
 * Busca de alertas no indexador do Wazuh (OpenSearch, porta 9200).
 *
 * A API do manager (55000) não devolve alertas: eles ficam no índice `wazuh-alerts-*` do indexador.
 * Variáveis: WAZUH_INDEXER_URL, WAZUH_INDEXER_USERNAME, WAZUH_INDEXER_PASSWORD (Secret) e,
 * para o certificado, WAZUH_INDEXER_CA_B64 ou WAZUH_INDEXER_TLS_INSEGURO=true (laboratório).
 * Só leitura: a consulta é montada aqui a partir de filtros validados, nunca escrita pelo modelo.
 */

const VARIAVEIS = ['WAZUH_INDEXER_URL', 'WAZUH_INDEXER_USERNAME', 'WAZUH_INDEXER_PASSWORD'] as const;

export const wazuhIndexadorFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

export interface FiltroAlertas {
  horas: number;
  nivelMinimo: number;
  agente?: string;
  regraId?: string;
  texto?: string;
  limite: number;
}

/** Corpo da busca: últimas N horas, nível mínimo e filtros opcionais, mais recentes primeiro. */
export function consultaDeAlertas(f: FiltroAlertas): Record<string, unknown> {
  const filtros: unknown[] = [
    { range: { timestamp: { gte: `now-${f.horas}h` } } },
    { range: { 'rule.level': { gte: f.nivelMinimo } } },
  ];
  if (f.agente) filtros.push({ term: { 'agent.name': f.agente } });
  if (f.regraId) filtros.push({ term: { 'rule.id': f.regraId } });
  const deve = f.texto ? [{ simple_query_string: { query: f.texto, fields: ['rule.description', 'full_log'], default_operator: 'and' } }] : [];
  return {
    size: f.limite,
    sort: [{ timestamp: { order: 'desc' } }],
    _source: ['timestamp', 'rule.id', 'rule.level', 'rule.description', 'rule.groups', 'rule.mitre.id', 'agent.id', 'agent.name', 'data.srcip', 'data.dstuser', 'location'],
    query: { bool: { filter: filtros, must: deve } },
    aggs: { por_regra: { terms: { field: 'rule.description', size: 10 } }, por_agente: { terms: { field: 'agent.name', size: 10 } } },
  };
}

export function wazuhBuscarAlertas(f: FiltroAlertas): Promise<unknown> {
  const faltando = wazuhIndexadorFaltando();
  if (faltando.length) return Promise.reject(new Error(`Indexador do Wazuh não configurado no servidor: falta definir ${faltando.join(', ')}.`));
  let base: URL;
  try { base = new URL(process.env.WAZUH_INDEXER_URL as string); } catch { return Promise.reject(new Error('WAZUH_INDEXER_URL inválida. Use https://endereco:9200.')); }
  const inseguro = process.env.WAZUH_INDEXER_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  try { if (!inseguro && process.env.WAZUH_INDEXER_CA_B64) ca = Buffer.from(process.env.WAZUH_INDEXER_CA_B64, 'base64').toString('utf8'); }
  catch { return Promise.reject(new Error('WAZUH_INDEXER_CA_B64 inválida.')); }
  const auth = Buffer.from(`${process.env.WAZUH_INDEXER_USERNAME}:${process.env.WAZUH_INDEXER_PASSWORD}`).toString('base64');
  const corpo = JSON.stringify(consultaDeAlertas(f));
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base.hostname, port: base.port || 9200, path: '/wazuh-alerts-*/_search', method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
      timeout: 15_000, ca, rejectUnauthorized: !inseguro,
    }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status === 401 || status === 403) return reject(new Error(`O indexador do Wazuh recusou o acesso (HTTP ${status}); confira usuário e senha.`));
        if (status >= 400) return reject(new Error(`Indexador do Wazuh respondeu HTTP ${status}.`));
        try {
          const r = JSON.parse(Buffer.concat(partes).toString('utf8')) as {
            hits?: { total?: { value?: number }; hits?: { _source?: unknown }[] };
            aggregations?: Record<string, { buckets?: { key: string; doc_count: number }[] }>;
          };
          const resumo = (k: string) => (r.aggregations?.[k]?.buckets ?? []).map((b) => ({ valor: b.key, total: b.doc_count }));
          resolve({
            total: r.hits?.total?.value ?? 0,
            principaisRegras: resumo('por_regra'),
            principaisAgentes: resumo('por_agente'),
            alertas: (r.hits?.hits ?? []).map((h) => h._source),
          });
        } catch { reject(new Error('O indexador do Wazuh devolveu uma resposta inválida.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('O indexador do Wazuh não respondeu em 15 s.')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e.message.startsWith('O indexador') || e.message.startsWith('Indexador')) return reject(e);
      if (e.code && /CERT|SELF_SIGNED|UNABLE_TO/.test(e.code)) return reject(new Error('Certificado do indexador do Wazuh não confiável: configure WAZUH_INDEXER_CA_B64 ou, no laboratório, WAZUH_INDEXER_TLS_INSEGURO=true.'));
      reject(new Error(`Não foi possível alcançar o indexador do Wazuh: ${e.message}`));
    });
    req.end(corpo);
  });
}
