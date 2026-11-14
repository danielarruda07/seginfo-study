import type { FastifyInstance } from 'fastify';
import { iaConfigurada, MODELO } from './ia.js';
import { proxmoxFaltando, proxmoxIdentidade } from './proxmox.js';
import { fortigateFaltando } from './fortigate.js';
import { catalystFaltando } from './catalyst.js';
import { wazuhFaltando } from './wazuh.js';

/**
 * Como o servidor se conecta a cada sistema do laboratório, para a tela Meu Ambiente.
 *
 * Mostra endereço, identidade usada, modo de TLS e o que falta configurar. NUNCA devolve
 * segredo: token, senha, chave e CA ficam só nas variáveis de ambiente do serviço da API.
 * As rotas herdam a autenticação do Cloudflare Access (registradas dentro das rotas de estado).
 */

export interface Integracao {
  id: 'proxmox' | 'fortigate' | 'catalyst' | 'wazuh' | 'claude';
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
      tls: e.CATALYST_HOST ? 'SSH (chave do host não é fixada)' : null,
      faltando: catalystF,
      variaveis: ['CATALYST_HOST', 'CATALYST_USER', 'CATALYST_PASSWORD', 'CATALYST_PRIVATE_KEY_B64'],
    },
    {
      id: 'wazuh', nome: 'Wazuh', uso: 'Consultar saúde do manager e agentes; leitura somente.',
      configurada: wazuhF.length === 0,
      endereco: enderecoDe(e.WAZUH_API_URL, 55000),
      identidade: e.WAZUH_API_USERNAME || null,
      tls: e.WAZUH_API_URL ? tlsDe(e.WAZUH_API_TLS_INSEGURO, e.WAZUH_API_CA_B64) : null,
      faltando: wazuhF,
      variaveis: ['WAZUH_API_URL', 'WAZUH_API_USERNAME', 'WAZUH_API_PASSWORD', 'WAZUH_API_CA_B64', 'WAZUH_API_TLS_INSEGURO'],
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

export async function registerIntegracoesRoutes(app: FastifyInstance) {
  app.get('/api/integracoes', async () => ({ integracoes: listarIntegracoes() }));
}
