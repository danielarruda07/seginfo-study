import type { FastifyInstance } from 'fastify';
import { iaConfigurada, MODELO } from './ia.js';
import { proxmoxFaltando, proxmoxIdentidade } from './proxmox.js';
import { fortigateFaltando } from './fortigate.js';
import { catalystFaltando } from './catalyst.js';
import { wazuhFaltando } from './wazuh.js';
import { zabbixChamar, zabbixFaltando } from './zabbix.js';
import { proxmoxGet } from './proxmox.js';
import { fortigateGet } from './fortigate.js';
import { catalystExecutar, ultimaImpressaoDigital } from './catalyst.js';
import { wazuhApi } from './wazuh.js';
import { wazuhBuscarAlertas, wazuhIndexadorFaltando } from './wazuhIndexador.js';
import { coolifyChamar, coolifyFaltando } from './coolify.js';
import { mcpFaltando } from './mcp.js';

/**
 * Como o servidor se conecta a cada sistema do laboratório, para a tela Meu Ambiente.
 *
 * Mostra endereço, identidade usada, modo de TLS e o que falta configurar. NUNCA devolve
 * segredo: token, senha, chave e CA ficam só nas variáveis de ambiente do serviço da API.
 * As rotas herdam a autenticação do Cloudflare Access (registradas dentro das rotas de estado).
 */

export const IDS_INTEGRACAO = ['proxmox', 'fortigate', 'catalyst', 'wazuh', 'wazuh-indexador', 'zabbix', 'coolify', 'mcp', 'claude'] as const;
export type IdIntegracao = (typeof IDS_INTEGRACAO)[number];

export interface Integracao {
  id: IdIntegracao;
  nome: string;
  /** para que os agentes usam esta conexão */
  uso: string;
  configurada: boolean;
  /** host:porta, sem caminho; null se não definido */
  endereco: string | null;
  /** quem o servidor usa para se autenticar, sem o segredo */
  identidade: string | null;
  /** como o certificado é tratado */
  tls: string | null;
  /** variáveis que faltam (nomes, nunca valores) */
  faltando: string[];
  /** variáveis de ambiente envolvidas, para saber o que editar no Coolify */
  variaveis: string[];
}

function enderecoDe(url: string | undefined, portaPadrao: number): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || portaPadrao}`;
  } catch {
    return 'URL inválida';
  }
}

function tlsDe(inseguro: string | undefined, ca: string | undefined): string {
  if (inseguro === 'true') return 'Sem verificação do certificado (modo laboratório)';
  if (ca) return 'Verificado pela CA configurada';
  return 'Verificado pelas CAs públicas do sistema';
}

export function listarIntegracoes(): Integracao[] {
  const e = process.env;
  const proxmoxF = proxmoxFaltando();
  const fortigateF = fortigateFaltando();
  const catalystF = catalystFaltando();
  const wazuhF = wazuhFaltando();
  const zabbixF = zabbixFaltando();
  return [
    {
      id: 'proxmox', nome: 'Proxmox VE', uso: 'Consultar e operar VMs, containers, snapshots e armazenamento.',
      configurada: proxmoxF.length === 0 && proxmoxIdentidade() !== null,
      endereco: enderecoDe(e.PROXMOX_URL, 8006),
      identidade: proxmoxIdentidade() ?? (e.PROXMOX_TOKEN ? 'token em formato inválido' : null),
      tls: e.PROXMOX_URL ? tlsDe(e.PROXMOX_TLS_INSEGURO, e.PROXMOX_CA_B64) : null,
      faltando: proxmoxF,
      variaveis: ['PROXMOX_URL', 'PROXMOX_TOKEN', 'PROXMOX_CA_B64', 'PROXMOX_TLS_INSEGURO'],
    },
    {
      id: 'fortigate', nome: 'FortiGate', uso: 'Consultar e alterar a configuração do firewall pela API REST.',
      configurada: fortigateF.length === 0,
      endereco: enderecoDe(e.FORTIGATE_URL, 443),
      identidade: e.FORTIGATE_TOKEN ? 'token de API (administrador REST)' : null,
      tls: e.FORTIGATE_URL ? tlsDe(e.FORTIGATE_TLS_INSEGURO, undefined) : null,
      faltando: fortigateF,
      variaveis: ['FORTIGATE_URL', 'FORTIGATE_TOKEN', 'FORTIGATE_TLS_INSEGURO'],
    },
    {
      id: 'catalyst', nome: 'Catalyst 2960', uso: 'Consultar e configurar o switch por SSH.',
      configurada: catalystF.length === 0,
      endereco: e.CATALYST_HOST ? `${e.CATALYST_HOST}:${e.CATALYST_PORT || 22}` : null,
      identidade: e.CATALYST_USER
        ? `${e.CATALYST_USER} (${e.CATALYST_PRIVATE_KEY_B64 ? 'chave SSH' : e.CATALYST_PASSWORD ? 'senha' : 'sem senha nem chave'})`
        : null,
      tls: e.CATALYST_HOST ? (e.CATALYST_HOST_KEY_SHA256 ? 'SSH com a chave do switch fixada' : 'SSH (chave do switch não fixada: o teste mostra qual fixar)') : null,
      faltando: catalystF,
      variaveis: ['CATALYST_HOST', 'CATALYST_USER', 'CATALYST_PASSWORD', 'CATALYST_PRIVATE_KEY_B64', 'CATALYST_ENABLE_PASSWORD', 'CATALYST_HOST_KEY_SHA256'],
    },
    {
      id: 'wazuh', nome: 'Wazuh', uso: 'Consultar manager/agentes e solicitar reinícios aprovados pelo agente.',
      configurada: wazuhF.length === 0,
      endereco: enderecoDe(e.WAZUH_API_URL, 55000),
      identidade: e.WAZUH_API_USERNAME || null,
      tls: e.WAZUH_API_URL ? tlsDe(e.WAZUH_API_TLS_INSEGURO, e.WAZUH_API_CA_B64) : null,
      faltando: wazuhF,
      variaveis: ['WAZUH_API_URL', 'WAZUH_API_USERNAME', 'WAZUH_API_PASSWORD', 'WAZUH_API_CA_B64', 'WAZUH_API_TLS_INSEGURO'],
    },
    {
      id: 'wazuh-indexador', nome: 'Wazuh: indexador (alertas)', uso: 'Buscar alertas do Wazuh (índice wazuh-alerts).',
      configurada: wazuhIndexadorFaltando().length === 0,
      endereco: enderecoDe(e.WAZUH_INDEXER_URL, 9200),
      identidade: e.WAZUH_INDEXER_USERNAME || null,
      tls: e.WAZUH_INDEXER_URL ? tlsDe(e.WAZUH_INDEXER_TLS_INSEGURO, e.WAZUH_INDEXER_CA_B64) : null,
      faltando: wazuhIndexadorFaltando(),
      variaveis: ['WAZUH_INDEXER_URL', 'WAZUH_INDEXER_USERNAME', 'WAZUH_INDEXER_PASSWORD', 'WAZUH_INDEXER_CA_B64', 'WAZUH_INDEXER_TLS_INSEGURO'],
    },
    {
      id: 'zabbix', nome: 'Zabbix', uso: 'Consultar hosts, grupos, templates e problemas; criar hosts/templates e vincular templates.',
      configurada: zabbixF.length === 0,
      endereco: enderecoDe(e.ZABBIX_API_URL, 443),
      identidade: e.ZABBIX_API_TOKEN ? 'token de API' : null,
      tls: e.ZABBIX_API_URL ? tlsDe(e.ZABBIX_TLS_INSEGURO, e.ZABBIX_CA_B64) : null,
      faltando: zabbixF,
      variaveis: ['ZABBIX_API_URL', 'ZABBIX_API_TOKEN', 'ZABBIX_CA_B64', 'ZABBIX_TLS_INSEGURO'],
    },
    {
      id: 'coolify', nome: 'Coolify', uso: 'Listar aplicações e serviços; reiniciar e fazer deploy.',
      configurada: coolifyFaltando().length === 0,
      endereco: enderecoDe(e.COOLIFY_URL, 8000),
      identidade: e.COOLIFY_API_TOKEN ? 'token de API' : null,
      tls: e.COOLIFY_URL ? (e.COOLIFY_URL.startsWith('https:') ? tlsDe(e.COOLIFY_TLS_INSEGURO, undefined) : 'HTTP na rede interna') : null,
      faltando: coolifyFaltando(),
      variaveis: ['COOLIFY_URL', 'COOLIFY_API_TOKEN', 'COOLIFY_TLS_INSEGURO'],
    },
    {
      id: 'mcp', nome: 'Servidor MCP (Claude Code de qualquer computador)', uso: 'Oferece as mesmas ferramentas dos agentes em /api/mcp.',
      configurada: mcpFaltando().length === 0,
      endereco: e.PUBLIC_BASE_URL ? `${e.PUBLIC_BASE_URL.replace(/\/+$/, '')}/api/mcp` : '/api/mcp',
      identidade: e.MCP_TOKEN ? `token MCP + Service Token do Access · ações destrutivas ${e.MCP_DESTRUTIVAS === 'bloquear' ? 'bloqueadas' : 'liberadas (o cliente pede permissão)'}` : null,
      tls: 'Cloudflare (borda)',
      faltando: mcpFaltando(),
      variaveis: ['MCP_TOKEN', 'MCP_OWNER_EMAIL', 'CF_ACCESS_MCP_AUD', 'CF_ACCESS_MCP_CLIENT_ID', 'MCP_DESTRUTIVAS'],
    },
    {
      id: 'claude', nome: 'Claude API (Anthropic)', uso: 'Modelo que roda os agentes e a IA do LinkedIn.',
      configurada: iaConfigurada(),
      endereco: 'api.anthropic.com:443',
      identidade: iaConfigurada() ? `chave de API · modelo ${MODELO}` : null,
      tls: 'Verificado pelas CAs públicas do sistema',
      faltando: iaConfigurada() ? [] : ['ANTHROPIC_API_KEY'],
      variaveis: ['ANTHROPIC_API_KEY'],
    },
  ];
}

export interface TesteConexao {
  ok: boolean;
  /** o que a consulta mínima devolveu, ou o erro real (sem segredo) */
  detalhe: string;
  ms: number;
}

/** Consulta mínima e só leitura em cada sistema: prova rede, certificado e credencial de uma vez. */
const TESTES: Partial<Record<IdIntegracao, () => Promise<string>>> = {
  proxmox: async () => {
    const v = (await proxmoxGet('/version')) as { version?: string };
    const nos = (await proxmoxGet('/nodes')) as { node?: string; status?: string }[];
    return `Proxmox VE ${v?.version ?? '?'} · nós: ${(Array.isArray(nos) ? nos : []).map((n) => `${n.node} (${n.status})`).join(', ')}`;
  },
  fortigate: async () => {
    const r = (await fortigateGet('/api/v2/monitor/system/status')) as { version?: string; results?: { hostname?: string; model_name?: string } };
    return `FortiOS ${r?.version ?? '?'} · ${r?.results?.model_name ?? ''} ${r?.results?.hostname ?? ''}`.trim();
  },
  catalyst: async () => {
    const saida = await catalystExecutar(['show version | include uptime|IOS']);
    const linhas = saida.split(/\r?\n/).filter((l) => /uptime|IOS/i.test(l) && !/show version/.test(l)).slice(0, 3).join(' · ');
    return `${linhas || 'conectado'} · chave do switch SHA256:${ultimaImpressaoDigital ?? '?'}`;
  },
  wazuh: async () => {
    const r = (await wazuhApi('GET', '/manager/info')) as { data?: { affected_items?: { version?: string }[] } };
    return `Wazuh manager ${r?.data?.affected_items?.[0]?.version ?? 'respondeu'}`;
  },
  'wazuh-indexador': async () => {
    const r = (await wazuhBuscarAlertas({ horas: 24, nivelMinimo: 0, limite: 1 })) as { total?: number };
    return `${r?.total ?? 0} alertas nas últimas 24 h`;
  },
  zabbix: async () => {
    const hosts = await zabbixChamar('host.get', { countOutput: true });
    return `Zabbix respondeu · ${String(hosts)} hosts`;
  },
  coolify: async () => {
    const apps = await coolifyChamar('GET', '/applications');
    return `Coolify respondeu · ${Array.isArray(apps) ? apps.length : '?'} aplicações`;
  },
};

export async function testarIntegracao(id: IdIntegracao): Promise<TesteConexao> {
  const t0 = Date.now();
  const teste = TESTES[id];
  if (!teste) return { ok: false, detalhe: 'Esta integração não tem teste de conexão.', ms: 0 };
  const faltando = listarIntegracoes().find((i) => i.id === id)?.faltando ?? [];
  if (faltando.length) return { ok: false, detalhe: `Falta configurar: ${faltando.join(', ')}.`, ms: 0 };
  try {
    return { ok: true, detalhe: await teste(), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, detalhe: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  }
}

export async function registerIntegracoesRoutes(app: FastifyInstance) {
  app.get('/api/integracoes', async () => ({ integracoes: listarIntegracoes() }));

  // Só leitura, mas toca a rede de verdade: fica dentro das rotas autenticadas (POST exige Origin).
  app.post('/api/integracoes/:id/testar', async (req, reply) => {
    const id = (req.params as { id: string }).id as IdIntegracao;
    if (!IDS_INTEGRACAO.includes(id)) return reply.status(404).send({ error: 'integração desconhecida' });
    return testarIntegracao(id);
  });
}
