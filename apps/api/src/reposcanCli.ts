#!/usr/bin/env node
/**
 * CLI de análise estática de repositório clonado (DevSecOps).
 *
 * Uso (na raiz do SegInfo):
 *   npx tsx apps/api/src/reposcanCli.ts <pasta-do-repo-clonado> [--json] [--html arquivo.html] [--fail-on alta|media|baixa]
 *
 * Só LÊ arquivos — não instala dependências nem roda a suíte do repositório.
 * Sai 0 se nada atingir o limiar de --fail-on (padrão: alta); 1 caso contrário; 2 em erro de uso.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  analisarSegredos, analisarCodigo, analisarInfra, analisarManifesto, analisarInjecao, analisarJwt,
  ordenarAchados, contarRepo, type AchadoRepo, type SeveridadeRepo,
} from './reposcan.js';
import { gerarHtmlRelatorio, type RelatorioExport } from '@seginfo/shared';

const IGNORAR_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', 'vendor', '__pycache__', '.venv', 'venv', 'target', '.turbo', '.cache']);
const EXT_CODIGO = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.java', '.php']);
const MAX_BYTES = 1_048_576; // 1 MB por arquivo

function ehBinario(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function* andar(raiz: string): Generator<string> {
  const pilha = [raiz];
  while (pilha.length) {
    const dir = pilha.pop()!;
    let entradas: fs.Dirent[];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!IGNORAR_DIR.has(e.name)) pilha.push(full); }
      else if (e.isFile()) yield full;
    }
  }
}

function analisarArquivo(rel: string, conteudo: string): AchadoRepo[] {
  const nome = rel.replace(/\\/g, '/').toLowerCase();
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  const out: AchadoRepo[] = [];
  out.push(...analisarSegredos(rel, conteudo));
  if (EXT_CODIGO.has(ext)) { out.push(...analisarCodigo(rel, conteudo)); out.push(...analisarInjecao(rel, conteudo)); out.push(...analisarJwt(rel, conteudo)); }
  if (/dockerfile/.test(nome) || /docker-compose|compose\.ya?ml$/.test(nome) || /\.github\/workflows\//.test(nome)) out.push(...analisarInfra(rel, conteudo));
  if (nome.endsWith('package.json') || nome.endsWith('requirements.txt')) out.push(...analisarManifesto(rel, conteudo).achados);
  return out;
}

function main(): number {
  const args = process.argv.slice(2);
  // o alvo é o primeiro argumento posicional que não é o valor de --fail-on ou --html
  const pular = new Set<number>();
  for (const opcao of ['--fail-on', '--html']) {
    const k = args.indexOf(opcao);
    if (k >= 0) pular.add(k + 1);
  }
  const alvo = args.find((a, i) => !a.startsWith('-') && !pular.has(i));
  const json = args.includes('--json');
  const failIdx = args.indexOf('--fail-on');
  const failOn = (failIdx >= 0 ? args[failIdx + 1] : 'alta') as SeveridadeRepo;
  const htmlIdx = args.indexOf('--html');
  const htmlArq = htmlIdx >= 0 ? args[htmlIdx + 1] : undefined;
  if (htmlIdx >= 0 && (!htmlArq || htmlArq.startsWith('-'))) { console.error('--html exige o caminho do arquivo de saída'); return 2; }
  if (!alvo) { console.error('Uso: reposcanCli <pasta-do-repo> [--json] [--html arquivo.html] [--fail-on alta|media|baixa]'); return 2; }
  const raiz = path.resolve(alvo);
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) { console.error(`Pasta não encontrada: ${raiz}`); return 2; }

  const achados: AchadoRepo[] = [];
  let arquivos = 0, dependencias = 0;
  for (const full of andar(raiz)) {
    let buf: Buffer;
    try { buf = fs.readFileSync(full); } catch { continue; }
    if (buf.length > MAX_BYTES || ehBinario(buf)) continue;
    arquivos++;
    const rel = path.relative(raiz, full);
    const conteudo = buf.toString('utf8');
    achados.push(...analisarArquivo(rel, conteudo));
    const nome = rel.replace(/\\/g, '/').toLowerCase();
    if (nome.endsWith('package.json') || nome.endsWith('requirements.txt')) dependencias += analisarManifesto(rel, conteudo).dependencias;
  }

  const ordenados = ordenarAchados(achados);
  const c = contarRepo(ordenados);
  const limiar: Record<SeveridadeRepo, number> = { alta: 0, media: 1, baixa: 2, info: 3 };
  const reprovou = ordenados.some((a) => limiar[a.severidade] <= limiar[failOn]);

  if (htmlArq) {
    fs.writeFileSync(htmlArq, gerarHtmlRelatorio(relatorioDoRepo(raiz, arquivos, dependencias, ordenados, reprovou, failOn)));
    console.error(`Relatório HTML: ${path.resolve(htmlArq)}`);
  }

  if (json) {
    console.log(JSON.stringify({ alvo: raiz, arquivos, dependencias, contagem: c, reprovou, achados: ordenados }, null, 2));
    return reprovou ? 1 : 0;
  }

  const ICONE: Record<SeveridadeRepo, string> = { alta: '🔴', media: '🟠', baixa: '🟡', info: 'ℹ️' };
  console.log(`\n== Análise de repositório: ${raiz} ==`);
  console.log(`${arquivos} arquivo(s) lido(s), ${dependencias} dependência(s) inventariada(s).`);
  console.log(`Achados: ${c.alta} alto(s), ${c.media} médio(s), ${c.baixa} baixo(s), ${c.info} info.\n`);
  const porCat: Record<string, AchadoRepo[]> = {};
  for (const a of ordenados) (porCat[a.categoria] ??= []).push(a);
  const NOME_CAT: Record<string, string> = { segredo: 'SEGREDOS', injecao: 'INJEÇÃO (SQL/NoSQL/template/cmd/prompt)', jwt: 'JWT', infra: 'DOCKER/IaC/CI', dependencia: 'DEPENDÊNCIAS', codigo: 'CÓDIGO' };
  for (const cat of ['segredo', 'injecao', 'jwt', 'infra', 'dependencia', 'codigo']) {
    const lista = porCat[cat];
    if (!lista?.length) continue;
    console.log(`--- ${NOME_CAT[cat]} (${lista.length}) ---`);
    for (const a of lista) {
      const loc = a.linha ? `${a.arquivo}:${a.linha}` : a.arquivo;
      console.log(`${ICONE[a.severidade]} ${a.titulo} — ${loc}`);
      if (a.trecho) console.log(`    ${a.trecho}`);
      console.log(`    → ${a.recomendacao}`);
    }
    console.log('');
  }
  console.log(reprovou ? `REPROVOU (limiar --fail-on ${failOn})` : 'OK');
  return reprovou ? 1 : 0;
}

const NOME_CAT_REL: Record<string, string> = { segredo: 'Segredos', injecao: 'Injeção (SQL/NoSQL/template/cmd/prompt)', jwt: 'JWT', infra: 'Docker / IaC / CI', dependencia: 'Dependências', codigo: 'Código' };

/** Relatório HTML do scan de repositório (mesmo modelo dos testes da aplicação). */
function relatorioDoRepo(raiz: string, arquivos: number, dependencias: number, achados: AchadoRepo[], reprovou: boolean, failOn: SeveridadeRepo): RelatorioExport {
  const c = contarRepo(achados);
  const porCat = new Map<string, AchadoRepo[]>();
  for (const a of achados) porCat.set(a.categoria, [...(porCat.get(a.categoria) ?? []), a]);
  return {
    titulo: 'Análise estática de repositório',
    subtitulo: raiz,
    confidencial: true,
    meta: [
      ['Repositório', raiz], ['Data', new Date().toLocaleString('pt-BR')], ['Arquivos lidos', String(arquivos)],
      ['Dependências inventariadas', String(dependencias)], ['Veredito', reprovou ? `REPROVOU (limiar ${failOn})` : 'OK'],
      ['Método', 'Análise estática por padrões — lê os arquivos, não executa o código. Achados heurísticos: confirmar.'],
    ],
    resumo: { alta: c.alta, media: c.media, baixa: c.baixa, info: c.info },
    secoes: ['segredo', 'injecao', 'jwt', 'infra', 'dependencia', 'codigo']
      .filter((cat) => porCat.has(cat))
      .map((cat) => ({
        titulo: `${NOME_CAT_REL[cat]} (${porCat.get(cat)!.length})`,
        itens: porCat.get(cat)!.map((a) => ({
          severidade: a.severidade, titulo: a.titulo,
          local: a.linha ? `${a.arquivo}:${a.linha}` : a.arquivo,
          detalhe: a.trecho, recomendacao: a.recomendacao,
        })),
      })),
  };
}

process.exit(main());
