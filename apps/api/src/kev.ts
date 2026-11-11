import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * Catálogo CISA KEV (vulnerabilidades exploradas ativamente), filtrado pelos produtos que
 * o usuário acompanha. Registrado DENTRO do plugin de rotas de estado (exige identidade).
 *
 * - URL FIXA, nunca vinda do cliente: não há vetor de SSRF.
 * - Cache em memória de 12 h; se a CISA falhar, devolve o último catálogo válido.
 * - Corpo limitado a 10 MB e validado com Zod antes de ser usado.
 */

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const TTL_MS = 12 * 3_600_000;
const MAX_BYTES = 10 * 1024 * 1024;

const Vuln = z.object({
  cveID: z.string(),
  vendorProject: z.string(),
  product: z.string(),
  vulnerabilityName: z.string(),
  dateAdded: z.string(),
  shortDescription: z.string(),
  requiredAction: z.string(),
  dueDate: z.string().optional(),
  knownRansomwareCampaignUse: z.string().optional(),
});
const Catalogo = z.object({
  catalogVersion: z.string(),
  dateReleased: z.string(),
  vulnerabilities: z.array(Vuln),
});
type Catalogo = z.infer<typeof Catalogo>;

let cache: { em: number; dados: Catalogo } | null = null;
let emAndamento: Promise<Catalogo> | null = null;

async function baixar(): Promise<Catalogo> {
  const res = await fetch(KEV_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'SegInfoStudy/0.1 (estudo pessoal)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`CISA KEV respondeu HTTP ${res.status}.`);
  const tamanho = Number(res.headers.get('content-length') ?? 0);
  if (tamanho > MAX_BYTES) throw new Error('Catálogo KEV maior que o esperado.');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('Catálogo KEV maior que o esperado.');
  const parsed = Catalogo.safeParse(JSON.parse(new TextDecoder().decode(buf)));
  if (!parsed.success) throw new Error('Formato inesperado no catálogo KEV.');
  return parsed.data;
}

async function obterCatalogo(): Promise<{ dados: Catalogo; desatualizado: boolean }> {
  if (cache && Date.now() - cache.em < TTL_MS) return { dados: cache.dados, desatualizado: false };
  try {
    emAndamento ??= baixar().finally(() => { emAndamento = null; });
    const dados = await emAndamento;
    cache = { em: Date.now(), dados };
    return { dados, desatualizado: false };
  } catch (e) {
    if (cache) return { dados: cache.dados, desatualizado: true }; // melhor um catálogo antigo que nenhum
    throw e;
  }
}

const Query = z.object({
  termos: z.string().max(600).default(''),
  dias: z.coerce.number().int().min(0).max(3650).default(0),
});

export async function registerKevRoutes(app: FastifyInstance) {
  app.get('/api/kev', async (req, reply) => {
    const q = Query.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });

    const termos = [...new Set(q.data.termos.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2))].slice(0, 25);
    if (termos.length === 0) return reply.status(400).send({ error: 'Informe ao menos um produto ou fabricante.' });

    let catalogo: Awaited<ReturnType<typeof obterCatalogo>>;
    try {
      catalogo = await obterCatalogo();
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'kev: falha ao baixar o catálogo');
      return reply.status(502).send({ error: 'Não foi possível baixar o catálogo da CISA agora.' });
    }

    const desde = q.data.dias > 0 ? new Date(Date.now() - q.data.dias * 86_400_000).toISOString().slice(0, 10) : '';
    const itens = catalogo.dados.vulnerabilities
      .filter((v) => !desde || v.dateAdded >= desde)
      .map((v) => {
        const alvo = `${v.vendorProject} ${v.product}`.toLowerCase();
        return { v, termo: termos.find((t) => alvo.includes(t)) };
      })
      .filter((x) => x.termo)
      .sort((a, b) => b.v.dateAdded.localeCompare(a.v.dateAdded))
      .slice(0, 300)
      .map(({ v, termo }) => ({
        cve: v.cveID, fabricante: v.vendorProject, produto: v.product, nome: v.vulnerabilityName,
        adicionadoEm: v.dateAdded, prazo: v.dueDate ?? null, descricao: v.shortDescription,
        acao: v.requiredAction, ransomware: v.knownRansomwareCampaignUse === 'Known', termo,
      }));

    return {
      versao: catalogo.dados.catalogVersion,
      publicadoEm: catalogo.dados.dateReleased,
      totalCatalogo: catalogo.dados.vulnerabilities.length,
      desatualizado: catalogo.desatualizado,
      itens,
    };
  });
}
