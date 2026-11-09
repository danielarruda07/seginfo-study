import type { ArsenalItem } from '@seginfo/shared';

const AGORA = '2026-11-08T00:00:00.000Z';

/**
 * Seed do Arsenal de IA — prompts, skills e agentes de segurança do Daniel.
 * Começa com os exemplos reais. Novos itens são adicionados pela UI.
 */
export const ARSENAL_SEED: ArsenalItem[] = [
  {
    id: 'skill-pentest-api',
    tipo: 'skill',
    nome: 'pentest-api',
    slug: 'pentest-api',
    dominio: 'appsec',
    resumo:
      'Campanha de pentest em bancada Docker local isolada contra uma API (ex: Fastify + Prisma + gateway LDAP). Foca ~80% em lógica de autenticação/autorização e ~20% em misconfig, reproduzindo cada achado de ponta a ponta e verificando no alvo (LDAP/DB).',
    conteudo:
      'Objetivo: avaliar com rigor autenticação, autorização e operações destrutivas de uma API, sem tocar em ambientes reais.\n\n' +
      'Setup: subir bancada efêmera em rede Docker dedicada (app via tsx em modo normal, Postgres, e dependências simuladas — ex: 2x OpenLDAP com schema AD-like). Nenhum contato com DCs/produção.\n\n' +
      'Atores: forjar admin (isAdmin:true), usuário de baixo privilégio (roles:[\'user\']) e usar os usuários de seed.\n\n' +
      'Técnicas: recon por análise de código; testes dinâmicos de auth/authz com atores forjados; triagem de injeção (LDAP filter, SQLi, command injection); inspeção de headers (CSP, HSTS).\n\n' +
      'Regra de ouro: cada achado "comprovado" deve ser reproduzido por requisição HTTP real e verificado no diretório/banco. Classificar refutados também (boa engenharia).\n\n' +
      'Saída: relatório HTML com placar de achados (sev/classe/estado), evidências por achado, hipóteses refutadas, limitações e plano de remediação priorizado (P0/P1/P2).',
    quandoUsar:
      'Antes de promover a produção uma API que opera recursos sensíveis (AD, pagamentos, dados pessoais). Especialmente quando a segurança depende de config de deploy e de dados no banco (permissões).',
    requisitos: ['Docker + rede dedicada', 'Node/tsx', 'Postgres', 'OpenLDAP (quando houver gateway LDAP)', 'jwt (forja HS256)', 'curl/httpie'],
    tags: ['pentest', 'api', 'authz', 'authn', 'ldap', 'owasp', 'bancada'],
    artefatos: [
      {
        id: 'art-gestao-ad',
        titulo: 'Relatório de Pentest — gestao-ad (Migração AD CBL→Embaré)',
        tipo: 'relatorio',
        formato: 'html',
        conteudo:
          '<!-- Relatório gerado pela skill pentest-api contra a bancada local do gestao-ad. ' +
          '3 Críticos (F1 Forja de JWT, F2 bootstrap-admin sem auth, F3 authz fail-open) e 3 Altos ' +
          '(F4 leitura AD sem authz, F5 directory traversal, F6 SSRF). Cole aqui o HTML completo do relatório. -->',
        criadoEm: '2026-11-05T00:00:00.000Z',
      },
    ],
    favorito: true,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  },
  {
    id: 'prompt-triagem-cve',
    tipo: 'prompt',
    nome: 'Triagem de CVE por exploração real',
    slug: 'triagem-cve',
    dominio: 'blue',
    resumo:
      'Prompt para priorizar vulnerabilidades combinando CVSS com sinais de exploração real (CISA KEV, EPSS) e contexto do ambiente.',
    conteudo:
      'Você é um analista de gestão de vulnerabilidades. Para cada CVE que eu colar, produza:\n' +
      '1. Resumo em 1 linha do que é e o vetor.\n' +
      '2. CVSS (base) e severidade.\n' +
      '3. Está no catálogo CISA KEV? Qual o score EPSS (probabilidade de exploração)?\n' +
      '4. Dado MEU contexto (informo os ativos afetados), o ativo está exposto à internet?\n' +
      '5. Prioridade final: P0/P1/P2/P3 com justificativa (exploração real > CVSS isolado).\n' +
      '6. Ação recomendada e janela de remediação.\n\n' +
      'Não invente dados de fontes; se não tiver certeza do EPSS/KEV, diga explicitamente.',
    quandoUsar:
      'Ao receber um lote de CVEs de um scanner (Nessus/Nuclei) e precisar decidir o que corrigir primeiro sem se afogar no volume.',
    requisitos: ['Acesso a NVD', 'CISA KEV', 'EPSS'],
    tags: ['cve', 'cvss', 'kev', 'epss', 'priorizacao', 'vuln-mgmt'],
    artefatos: [],
    favorito: false,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  },
];
