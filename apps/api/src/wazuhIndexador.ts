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

interface Bucket { key: string; doc_count: number; [k: string]: unknown }
type RespostaBusca = {
  hits?: { total?: { value?: number }; hits?: { _source?: unknown }[] };
  aggregations?: Record<string, { buckets?: Bucket[] }>;
};

const BUSCA = '/wazuh-alerts-*/_search';

/**
 * Dois jeitos de chegar ao indexador:
 * - direto: WAZUH_INDEXER_URL=https://manager:9200 (o indexador precisa escutar fora do 127.0.0.1);
 * - pelo dashboard: WAZUH_INDEXER_URL=https://manager/api/console/proxy, o proxy de console do
 *   OpenSearch Dashboards (porta 443). Serve para instalações all-in-one, em que o indexador só
 *   escuta no 127.0.0.1; usa o mesmo usuário do indexador e exige o cabeçalho osd-xsrf.
 */
export function rotaDoIndexador(base: URL): { porta: number; caminho: string; cabecalhos: Record<string, string> } {
  if (base.pathname.replace(/\/+$/, '').endsWith('/api/console/proxy')) {
    return {
      porta: Number(base.port) || 443,
      caminho: `${base.pathname.replace(/\/+$/, '')}?path=${encodeURIComponent(BUSCA)}&method=POST`,
      cabecalhos: { 'osd-xsrf': 'true' },
    };
  }
  return { porta: Number(base.port) || 9200, caminho: BUSCA, cabecalhos: {} };
}

/** POST /wazuh-alerts-*\/_search com o corpo dado; devolve o JSON bruto do OpenSearch. */
function buscarNoIndexador(consulta: Record<string, unknown>): Promise<RespostaBusca> {
  const faltando = wazuhIndexadorFaltando();
  if (faltando.length) return Promise.reject(new Error(`Indexador do Wazuh não configurado no servidor: falta definir ${faltando.join(', ')}.`));
  let base: URL;
  try { base = new URL(process.env.WAZUH_INDEXER_URL as string); } catch { return Promise.reject(new Error('WAZUH_INDEXER_URL inválida. Use https://endereco:9200.')); }
  const inseguro = process.env.WAZUH_INDEXER_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  try { if (!inseguro && process.env.WAZUH_INDEXER_CA_B64) ca = Buffer.from(process.env.WAZUH_INDEXER_CA_B64, 'base64').toString('utf8'); }
  catch { return Promise.reject(new Error('WAZUH_INDEXER_CA_B64 inválida.')); }
  const auth = Buffer.from(`${process.env.WAZUH_INDEXER_USERNAME}:${process.env.WAZUH_INDEXER_PASSWORD}`).toString('base64');
  const corpo = JSON.stringify(consulta);
  const destino = rotaDoIndexador(base);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base.hostname, port: destino.porta, path: destino.caminho, method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo), ...destino.cabecalhos },
      timeout: 15_000, ca, rejectUnauthorized: !inseguro,
    }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status === 401 || status === 403) return reject(new Error(`O indexador do Wazuh recusou o acesso (HTTP ${status}); confira usuário e senha.`));
        if (status >= 400) return reject(new Error(`Indexador do Wazuh respondeu HTTP ${status}.`));
        try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8')) as RespostaBusca); }
        catch { reject(new Error('O indexador do Wazuh devolveu uma resposta inválida.')); }
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

export async function wazuhBuscarAlertas(f: FiltroAlertas): Promise<unknown> {
  const r = await buscarNoIndexador(consultaDeAlertas(f));
  const resumo = (k: string) => (r.aggregations?.[k]?.buckets ?? []).map((b) => ({ valor: b.key, total: b.doc_count }));
  return {
    total: r.hits?.total?.value ?? 0,
    principaisRegras: resumo('por_regra'),
    principaisAgentes: resumo('por_agente'),
    alertas: (r.hits?.hits ?? []).map((h) => h._source),
  };
}

// ---------------------------------------------------------------- alertas por técnica ATT&CK

export interface RegraDaTecnica { id: string; descricao: string; nivel: number; alertas: number }
export interface AlertasDaTecnica { id: string; alertas: number; ultimo: string | null; regras: RegraDaTecnica[]; agentes: string[] }

/**
 * Ambiente pelo nome do agente: os agentes de produção seguem o padrão "prod-<nome>" (grupos prod-* no
 * manager); todos os outros são do laboratório. "todos" não filtra.
 */
export type AmbienteWazuh = 'todos' | 'laboratorio' | 'producao';
export const PREFIXO_PRODUCAO = 'prod-';

/** Alertas dos últimos N dias agrupados por rule.mitre.id, com as principais regras e agentes de cada técnica. */
export function consultaPorTecnica(dias: number, ambiente: AmbienteWazuh = 'todos'): Record<string, unknown> {
  const prod = { prefix: { 'agent.name': PREFIXO_PRODUCAO } };
  const filtros: unknown[] = [{ range: { timestamp: { gte: `now-${dias}d` } } }, { exists: { field: 'rule.mitre.id' } }];
  if (ambiente === 'producao') filtros.push(prod);
  return {
    size: 0,
    track_total_hits: true,
    query: { bool: { filter: filtros, must_not: ambiente === 'laboratorio' ? [prod] : [] } },
    aggs: {
      tecnicas: {
        terms: { field: 'rule.mitre.id', size: 300 },
        aggs: {
          ultimo: { max: { field: 'timestamp' } },
          agentes: { terms: { field: 'agent.name', size: 5 } },
          regras: {
            terms: { field: 'rule.id', size: 5 },
            aggs: { descricao: { terms: { field: 'rule.description', size: 1 } }, nivel: { max: { field: 'rule.level' } } },
          },
        },
      },
    },
  };
}

/** Subtécnica conta para a técnica-mãe (a Matriz trabalha no nível T1234). */
export const tecnicaMae = (id: string) => id.trim().toUpperCase().split('.')[0];

const baldes = (x: unknown): Bucket[] => (x as { buckets?: Bucket[] } | undefined)?.buckets ?? [];

/** Junta os baldes do OpenSearch por técnica-mãe (T1110.001 e T1110 viram T1110). */
export function agruparPorTecnica(r: RespostaBusca): AlertasDaTecnica[] {
  const mapa = new Map<string, AlertasDaTecnica>();
  for (const b of r.aggregations?.tecnicas?.buckets ?? []) {
    if (!/^T\d{4}(\.\d{3})?$/i.test(String(b.key))) continue;
    const id = tecnicaMae(String(b.key));
    const atual = mapa.get(id) ?? { id, alertas: 0, ultimo: null, regras: [], agentes: [] };
    atual.alertas += b.doc_count;
    const ult = (b.ultimo as { value_as_string?: string } | undefined)?.value_as_string ?? null;
    if (ult && (!atual.ultimo || ult > atual.ultimo)) atual.ultimo = ult;
    for (const a of baldes(b.agentes)) if (!atual.agentes.includes(String(a.key))) atual.agentes.push(String(a.key));
    for (const rg of baldes(b.regras)) {
      const existente = atual.regras.find((x) => x.id === String(rg.key));
      if (existente) { existente.alertas += rg.doc_count; continue; }
      atual.regras.push({
        id: String(rg.key),
        descricao: String(baldes(rg.descricao)[0]?.key ?? ''),
        nivel: Number((rg.nivel as { value?: number } | undefined)?.value ?? 0),
        alertas: rg.doc_count,
      });
    }
    mapa.set(id, atual);
  }
  return [...mapa.values()]
    .map((t) => ({ ...t, regras: t.regras.sort((a, b) => b.alertas - a.alertas).slice(0, 5), agentes: t.agentes.slice(0, 5) }))
    .sort((a, b) => b.alertas - a.alertas);
}

const cachePorTecnica = new Map<string, { em: number; valor: { total: number; tecnicas: AlertasDaTecnica[] } }>();

/** Alertas do Wazuh por técnica, com cache de 5 minutos por janela e ambiente (a Matriz recarrega com frequência). */
export async function wazuhAlertasPorTecnica(dias: number, ambiente: AmbienteWazuh = 'todos'): Promise<{ total: number; tecnicas: AlertasDaTecnica[] }> {
  const chave = `${dias}:${ambiente}`;
  const c = cachePorTecnica.get(chave);
  if (c && Date.now() - c.em < 5 * 60_000) return c.valor;
  const r = await buscarNoIndexador(consultaPorTecnica(dias, ambiente));
  const valor = { total: r.hits?.total?.value ?? 0, tecnicas: agruparPorTecnica(r) };
  cachePorTecnica.set(chave, { em: Date.now(), valor });
  return valor;
}
