/**
 * Scanner de REPOSITÓRIO clonado — análise ESTÁTICA, não executa o código.
 *
 * Roda localmente (CLI) sobre uma pasta já clonada. Só lê arquivos; nunca instala
 * dependências nem roda a suíte do repositório (isso executaria código não confiável).
 * Quatro análises: segredos, dependências, Docker/IaC/CI e padrões de código perigosos.
 *
 * As funções de análise são puras (recebem caminho + conteúdo, devolvem achados) para
 * serem testáveis sem tocar no disco. O percurso de arquivos fica no CLI (reposcanCli.ts).
 */

export type SeveridadeRepo = 'alta' | 'media' | 'baixa' | 'info';
export type CategoriaRepo = 'segredo' | 'dependencia' | 'infra' | 'codigo';

export interface AchadoRepo {
  categoria: CategoriaRepo;
  severidade: SeveridadeRepo;
  regra: string;
  titulo: string;
  arquivo: string;
  linha?: number;
  trecho?: string;
  recomendacao: string;
}

const ORDEM_SEV: Record<SeveridadeRepo, number> = { alta: 0, media: 1, baixa: 2, info: 3 };

/** Oculta o miolo de um segredo, deixando só as pontas. */
export function redigir(valor: string): string {
  const v = valor.trim();
  if (v.length <= 8) return '****';
  return `${v.slice(0, 3)}…${v.slice(-2)} (${v.length} chars)`;
}

/** Palavras que indicam placeholder, para reduzir falso positivo em segredos. */
const PLACEHOLDERS = /example|placeholder|changeme|your[_-]?|dummy|sample|xxxx+|<[^>]+>|\.\.\.|TODO|FIXME|redacted|test[_-]?key/i;

interface RegraSegredo { regra: string; titulo: string; re: RegExp; sev: SeveridadeRepo }
const REGRAS_SEGREDO: RegraSegredo[] = [
  { regra: 'aws-akid', titulo: 'AWS Access Key ID', re: /\bAKIA[0-9A-Z]{16}\b/, sev: 'alta' },
  { regra: 'chave-privada', titulo: 'Bloco de chave privada', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, sev: 'alta' },
  { regra: 'github-pat', titulo: 'GitHub Personal Access Token', re: /\bghp_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,}\b/, sev: 'alta' },
  { regra: 'slack-token', titulo: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, sev: 'alta' },
  { regra: 'google-api', titulo: 'Google API key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/, sev: 'alta' },
  { regra: 'stripe-live', titulo: 'Stripe live secret key', re: /\bsk_live_[0-9A-Za-z]{24,}\b/, sev: 'alta' },
  { regra: 'jwt', titulo: 'Possível JWT embutido', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/, sev: 'media' },
];

/** Atribuição genérica a nome sensível: senha/token/secret = "valor". */
const RE_ATRIB_SENSIVEL = /\b(pass(?:word|wd)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|auth)\b\s*[:=]\s*['"]([^'"\s]{8,})['"]/i;

/** Acha segredos numa linha. Pura. */
export function analisarSegredos(rel: string, conteudo: string): AchadoRepo[] {
  const achados: AchadoRepo[] = [];
  const linhas = conteudo.split(/\r?\n/);
  const ehEnv = /(^|\/)\.env(\.|$)|\.env\./.test(rel) || /(^|\/)\.env$/.test(rel);
  linhas.forEach((linha, i) => {
    if (linha.length > 500) return; // minificado/huge: pula
    for (const r of REGRAS_SEGREDO) {
      const m = r.re.exec(linha);
      if (m) achados.push({ categoria: 'segredo', severidade: r.sev, regra: r.regra, titulo: r.titulo, arquivo: rel, linha: i + 1, trecho: redigir(m[0]), recomendacao: 'Remover do código, rotacionar o segredo e usar variável de ambiente/secret manager.' });
    }
    const ga = RE_ATRIB_SENSIVEL.exec(linha);
    if (ga && !PLACEHOLDERS.test(ga[2]) && !/^\$\{|^process\.env|^os\.environ/.test(ga[2])) {
      achados.push({ categoria: 'segredo', severidade: 'media', regra: 'atrib-sensivel', titulo: `Valor sensível atribuído a "${ga[1]}"`, arquivo: rel, linha: i + 1, trecho: redigir(ga[2]), recomendacao: 'Não embutir segredo no código; ler de variável de ambiente/secret manager.' });
    }
    if (ehEnv) {
      const kv = /^\s*([A-Z0-9_]{3,})\s*=\s*(.+?)\s*$/.exec(linha);
      if (kv && kv[2] && !/^\$\{|^#/.test(kv[2]) && !PLACEHOLDERS.test(kv[2])) {
        achados.push({ categoria: 'segredo', severidade: 'media', regra: 'env-valor', titulo: `.env com valor preenchido: ${kv[1]}`, arquivo: rel, linha: i + 1, trecho: redigir(kv[2]), recomendacao: 'Versionar só um .env.example sem valores; manter o .env fora do git.' });
      }
    }
  });
  return achados;
}

interface RegraCodigo { regra: string; titulo: string; re: RegExp; sev: SeveridadeRepo; rec: string; exts: string[] }
const REGRAS_CODIGO: RegraCodigo[] = [
  { regra: 'js-eval', titulo: 'Uso de eval()', re: /\beval\s*\(/, sev: 'media', rec: 'Evitar eval; usar parsing/estruturas seguras.', exts: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'] },
  { regra: 'js-new-function', titulo: 'new Function() com string', re: /\bnew\s+Function\s*\(/, sev: 'media', rec: 'Evitar construir função a partir de string.', exts: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'] },
  { regra: 'js-exec-concat', titulo: 'exec de shell com concatenação/template', re: /\bexec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/, sev: 'alta', rec: 'Usar execFile com args em array; nunca concatenar entrada na linha de comando.', exts: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'] },
  { regra: 'js-innerhtml', titulo: 'Atribuição a innerHTML', re: /\.innerHTML\s*=/, sev: 'baixa', rec: 'Preferir textContent ou sanitizar o HTML.', exts: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'] },
  { regra: 'py-shell-true', titulo: 'subprocess com shell=True', re: /shell\s*=\s*True/, sev: 'alta', rec: 'Passar args em lista e shell=False.', exts: ['.py'] },
  { regra: 'py-pickle', titulo: 'pickle.loads (desserialização insegura)', re: /pickle\.loads?\s*\(/, sev: 'alta', rec: 'Não desserializar dados não confiáveis com pickle; usar JSON.', exts: ['.py'] },
  { regra: 'py-yaml-load', titulo: 'yaml.load sem SafeLoader', re: /yaml\.load\s*\((?![^)]*Safe)/, sev: 'media', rec: 'Usar yaml.safe_load.', exts: ['.py'] },
  { regra: 'py-oss', titulo: 'os.system()', re: /\bos\.system\s*\(/, sev: 'media', rec: 'Usar subprocess com args em lista.', exts: ['.py'] },
  { regra: 'crypto-fraco', titulo: 'Hash fraco (md5/sha1)', re: /\b(?:md5|sha1)\b/i, sev: 'baixa', rec: 'Para senhas usar bcrypt/argon2; para integridade, SHA-256+.', exts: ['.js', '.ts', '.py', '.go', '.rb', '.java'] },
];

/** Acha padrões de código perigosos. Pura. */
export function analisarCodigo(rel: string, conteudo: string): AchadoRepo[] {
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  const achados: AchadoRepo[] = [];
  const linhas = conteudo.split(/\r?\n/);
  linhas.forEach((linha, i) => {
    if (linha.length > 1000) return;
    for (const r of REGRAS_CODIGO) {
      if (!r.exts.includes(ext)) continue;
      if (r.re.test(linha)) achados.push({ categoria: 'codigo', severidade: r.sev, regra: r.regra, titulo: r.titulo, arquivo: rel, linha: i + 1, trecho: linha.trim().slice(0, 160), recomendacao: r.rec });
    }
  });
  return achados;
}

/** Nome-base do arquivo em minúsculas. */
function base(rel: string): string {
  const p = rel.replace(/\\/g, '/');
  return p.slice(p.lastIndexOf('/') + 1).toLowerCase();
}

/** Analisa Dockerfile, docker-compose e workflows de CI. Pura (despacha pelo nome). */
export function analisarInfra(rel: string, conteudo: string): AchadoRepo[] {
  const nome = base(rel);
  const p = rel.replace(/\\/g, '/');
  const achados: AchadoRepo[] = [];
  const add = (severidade: SeveridadeRepo, regra: string, titulo: string, recomendacao: string, linha?: number) =>
    achados.push({ categoria: 'infra', severidade, regra, titulo, arquivo: rel, linha, recomendacao });

  if (nome === 'dockerfile' || nome.startsWith('dockerfile.')) {
    const linhas = conteudo.split(/\r?\n/);
    let temUser = false;
    linhas.forEach((l, i) => {
      if (/^\s*USER\s+(?!root\b)\S+/i.test(l)) temUser = true;
      if (/^\s*FROM\s+\S+(?::latest)?\s*(?:AS\s+\S+)?\s*$/i.test(l) && !/:\S+/.test(l.replace(/\s+AS\s+\S+/i, ''))) add('baixa', 'docker-from-sem-tag', 'FROM sem tag fixa (vira latest)', 'Fixar a tag/digest da imagem base.', i + 1);
      if (/:latest\b/i.test(l) && /^\s*FROM/i.test(l)) add('baixa', 'docker-latest', 'Imagem base :latest', 'Fixar versão específica (ou digest).', i + 1);
      if (/^\s*ADD\s+https?:\/\//i.test(l)) add('media', 'docker-add-remoto', 'ADD de URL remota', 'Usar COPY de arquivo local; baixar com verificação de hash.', i + 1);
      if (/curl[^\n|]*\|\s*(?:sh|bash)/i.test(l) || /wget[^\n|]*\|\s*(?:sh|bash)/i.test(l)) add('media', 'docker-curl-bash', 'curl/wget | sh dentro do build', 'Baixar, verificar hash e então executar.', i + 1);
      if (/^\s*(?:ENV|ARG)\s+\w*(?:PASS|SECRET|TOKEN|KEY)\w*\s*=/i.test(l)) add('alta', 'docker-segredo-env', 'Possível segredo em ENV/ARG', 'Não passar segredo por ENV/ARG; usar secret do builder/runtime.', i + 1);
    });
    if (!temUser) add('media', 'docker-root', 'Container roda como root (sem USER)', 'Adicionar um USER não-root no Dockerfile.');
  }

  if (/docker-compose(\.\w+)?\.ya?ml$/.test(nome) || nome === 'compose.yaml' || nome === 'compose.yml') {
    const linhas = conteudo.split(/\r?\n/);
    linhas.forEach((l, i) => {
      if (/privileged\s*:\s*true/i.test(l)) add('alta', 'compose-privileged', 'Serviço privileged: true', 'Evitar privileged; conceder só as capabilities necessárias.', i + 1);
      if (/network_mode\s*:\s*["']?host/i.test(l)) add('media', 'compose-host-net', 'network_mode: host', 'Usar rede isolada em vez de host.', i + 1);
      if (/^\s*-?\s*["']?0\.0\.0\.0:/i.test(l)) add('baixa', 'compose-bind-all', 'Porta publicada em 0.0.0.0', 'Restringir o bind (127.0.0.1) quando possível.', i + 1);
      if (/\b\w*(?:PASS|SECRET|TOKEN|KEY)\w*\s*[:=]\s*(?!\$\{)\S+/i.test(l)) add('media', 'compose-segredo', 'Possível segredo inline no compose', 'Usar variável de ambiente/secret, não valor fixo.', i + 1);
    });
  }

  if (/\.github\/workflows\//.test(p) && /\.ya?ml$/.test(nome)) {
    const linhas = conteudo.split(/\r?\n/);
    if (/pull_request_target/.test(conteudo)) add('alta', 'ci-pr-target', 'Workflow usa pull_request_target', 'Com checkout do PR, isso roda código não confiável com segredos. Revisar com cuidado.');
    linhas.forEach((l, i) => {
      if (/uses:\s*[\w.-]+\/[\w.-]+@(?:v?\d+(?:\.\d+)*|main|master)\b/.test(l)) add('baixa', 'ci-action-sem-sha', 'Action fixada por tag, não por SHA', 'Fixar actions por commit SHA para evitar troca maliciosa da tag.', i + 1);
      if (/\$\{\{\s*github\.event\.[^}]*(?:body|title|message|ref|head_ref)[^}]*\}\}/.test(l) && /run:/.test(conteudo)) add('media', 'ci-injecao', 'Dado de evento usado em run (injeção)', 'Passar via env e aspas; não interpolar github.event direto no shell.', i + 1);
    });
  }

  return achados;
}

/** Analisa manifestos de dependência: inventário + especificadores arriscados. Pura. */
export function analisarManifesto(rel: string, conteudo: string): { achados: AchadoRepo[]; dependencias: number } {
  const nome = base(rel);
  const achados: AchadoRepo[] = [];
  let dependencias = 0;
  const add = (severidade: SeveridadeRepo, regra: string, titulo: string, recomendacao: string) =>
    achados.push({ categoria: 'dependencia', severidade, regra, titulo, arquivo: rel, recomendacao });

  if (nome === 'package.json') {
    let pkg: Record<string, unknown>;
    try { pkg = JSON.parse(conteudo); } catch { return { achados, dependencias }; }
    const deps = { ...(pkg.dependencies as Record<string, string> | undefined ?? {}), ...(pkg.devDependencies as Record<string, string> | undefined ?? {}) };
    for (const [nomeDep, spec] of Object.entries(deps)) {
      dependencias++;
      if (spec === '*' || spec === 'latest' || spec === '') add('media', 'dep-sem-pin', `Dependência sem versão fixa: ${nomeDep} (${spec || 'vazio'})`, 'Fixar faixa de versão para builds reprodutíveis.');
      else if (/^(?:git\+)?http:\/\//.test(spec)) add('media', 'dep-http', `Dependência por HTTP inseguro: ${nomeDep}`, 'Usar HTTPS/registro oficial.');
    }
    const scripts = pkg.scripts as Record<string, string> | undefined ?? {};
    for (const hook of ['preinstall', 'install', 'postinstall']) {
      if (scripts[hook]) add('media', 'dep-install-script', `Script de instalação presente: ${hook}`, 'Scripts de install executam na instalação; revisar (risco de supply-chain).');
    }
  } else if (nome === 'requirements.txt') {
    conteudo.split(/\r?\n/).forEach((l) => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return;
      dependencias++;
      if (/^-e\s+git\+http:\/\//.test(t)) add('media', 'dep-http', `Dependência editável por HTTP: ${t.slice(0, 40)}`, 'Usar HTTPS.');
      else if (!/[=<>~!]=|@/.test(t) && !/^-/.test(t)) add('baixa', 'dep-sem-pin', `Dependência sem versão fixa: ${t}`, 'Fixar a versão (==) para builds reprodutíveis.');
    });
  }
  return { achados, dependencias };
}

/** Ordena achados: severidade e depois arquivo. */
export function ordenarAchados(a: AchadoRepo[]): AchadoRepo[] {
  return a.slice().sort((x, y) => ORDEM_SEV[x.severidade] - ORDEM_SEV[y.severidade] || x.arquivo.localeCompare(y.arquivo));
}

/** Conta achados por severidade. */
export function contarRepo(a: AchadoRepo[]): Record<SeveridadeRepo, number> {
  const c: Record<SeveridadeRepo, number> = { alta: 0, media: 0, baixa: 0, info: 0 };
  for (const x of a) c[x.severidade]++;
  return c;
}
