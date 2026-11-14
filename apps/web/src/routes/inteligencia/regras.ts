import type { Ativo } from '@seginfo/shared';
import type { Tone } from '@/theme/status';
import type { KevItem } from '@/services/kev';
import type { CoberturaTecnica } from '@/services/attack';
import type { PurpleExercise } from '@/services/exerciciosPurple';

/* Regras puras das telas de Inteligência (Radar, Matriz ATT&CK, Ameaças KEV). */

// ---------------------------------------------------------------- Radar

export interface AcaoMeta { label: string; tone?: Tone; icon: string; dica: string }

/** Ações normalizadas pelos coletores do Radar (apps/api). Tom só onde pede ação. */
export const ACAO_META: Record<string, AcaoMeta> = {
  login_ok: { label: 'Login aceito', tone: 'danger', icon: 'pi-unlock', dica: 'Alguém de fora entrou com usuário e senha válidos. Confirme se foi você; se não, troque a senha, encerre sessões e revise o acesso.' },
  lockout: { label: 'Conta bloqueada', tone: 'serious', icon: 'pi-lock', dica: 'A conta foi travada por excesso de tentativas. Verifique se é ataque de força bruta e se o bloqueio está atrapalhando o uso legítimo.' },
  comando: { label: 'Comando executado', tone: 'serious', icon: 'pi-code', dica: 'O atacante executou comandos (normalmente no honeypot). Leia os comandos para entender o objetivo e procure os mesmos indicadores nos ativos reais.' },
  login_falha: { label: 'Falha de login', tone: 'warning', icon: 'pi-user-minus', dica: 'Tentativa de senha errada. Muitas do mesmo IP indicam força bruta: considere bloquear o IP ou limitar tentativas.' },
  download: { label: 'Download de ferramenta', tone: 'danger', icon: 'pi-download', dica: 'O atacante baixou um arquivo (malware, script, minerador). Veja a URL, procure o mesmo indicador nos ativos reais e bloqueie o domínio/IP de origem.' },
  tunel: { label: 'Túnel / proxy', tone: 'serious', icon: 'pi-directions', dica: 'Tentativa de usar o alvo como ponte para outro destino (proxy, port forwarding). Confirme que o honeypot não tem saída e bloqueie o padrão no firewall.' },
  reflexao: { label: 'Reflexão UDP', tone: 'warning', icon: 'pi-replay', dica: 'Tentativa de usar o seu IP como refletor de DDoS. A origem é falsificada: é a vítima que o atacante queria atingir. Garanta que nada responde a esses serviços UDP.' },
  scan: { label: 'Varredura', tone: 'info', icon: 'pi-search', dica: 'Reconhecimento de portas e serviços. Confira se só o que precisa estar exposto responde.' },
  bloqueio: { label: 'Bloqueado', icon: 'pi-ban', dica: 'O firewall barrou a conexão. Nada a fazer além de acompanhar volume e origem.' },
  conexao: { label: 'Conexão', icon: 'pi-arrows-h', dica: 'Conexão registrada sem ação maliciosa clara.' },
  outro: { label: 'Outro', icon: 'pi-circle', dica: 'Evento sem classificação específica.' },
};

export const acaoMeta = (acao: string): AcaoMeta =>
  ACAO_META[acao] ?? { label: acao.replaceAll('_', ' '), icon: 'pi-circle', dica: 'Evento sem classificação específica.' };

export const FONTE_LABEL: Record<string, string> = {
  fortigate: 'FortiGate', windows: 'Windows', cowrie: 'Cowrie (honeypot SSH)', dionaea: 'Dionaea (honeypot)', heralding: 'Heralding (honeypot de credenciais)',
  isca: 'Iscas (Redis/ES/Docker)', opencanary: 'OpenCanary (honeypot)', outro: 'Outro',
};

/** Espelho do mapeamento ação → técnica feito pela API do Radar (apps/api/src/radar.ts). */
export const MITRE_POR_ACAO: Record<string, string> = {
  login_falha: 'T1110', lockout: 'T1110', scan: 'T1046', login_ok: 'T1078', comando: 'T1059',
  download: 'T1105', tunel: 'T1090', reflexao: 'T1498.002',
};

/** Honeypots são iscas: login "aceito" ali é de propósito e não dá acesso a nada real. */
export const FONTES_ISCA = new Set(['cowrie', 'dionaea', 'opencanary', 'heralding', 'isca']);

/** Rótulo e tom do evento, rebaixando o login aceito em isca (esperado) para informativo. */
export function acaoDoEvento(e: { acao: string; fonte: string }): AcaoMeta {
  const m = acaoMeta(e.acao);
  if (e.acao === 'login_ok' && FONTES_ISCA.has(e.fonte)) {
    return { ...m, label: 'Login aceito (isca)', tone: 'info', dica: 'O honeypot aceita a senha de propósito. O que importa é o que o atacante faz depois de entrar: veja os comandos e downloads da sessão.' };
  }
  return m;
}

/** Resumo curto do que o atacante fez (comando, URL ou IPs), para a tabela. */
export function resumoDetalhe(detalhes: Record<string, unknown> | null | undefined, max = 70): string {
  const d = detalhes ?? {};
  const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  const txt = s('comando') || s('url') || s('ips');
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}

/** Data e hora no fuso do navegador. */
export const formatarLocal = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Ações do Radar que geram eventos de uma técnica. */
export const acoesDaTecnica = (tecnicaId: string) =>
  Object.entries(MITRE_POR_ACAO).filter(([, id]) => id === tecnicaId).map(([acao]) => acao);

/** "2026-11-13T08:05:09.000Z" → "2026-11-13 08:05:09". */
export const formatarUtc = (iso: string) => iso.replace('T', ' ').slice(0, 19);

// ---------------------------------------------------------------- Matriz ATT&CK

// Keep the legacy learning filters readable for older links and existing tests/data.
export type Camada = 'observada' | 'alerta' | 'validada' | 'respondida' | 'estudada' | 'praticada' | 'detectada';
export const CAMADAS: { id: Camada; label: string }[] = [
  { id: 'observada', label: 'Observação · Radar real' },
  { id: 'alerta', label: 'Alerta · exercício' },
  { id: 'validada', label: 'Validação · regra testada' },
  { id: 'respondida', label: 'Resposta documentada' },
];

export const temCamada = (t: CoberturaTecnica, c: Camada) =>
  c === 'observada' ? t.observada > 0
    : c === 'alerta' ? t.alerta
      : c === 'validada' ? !!t.detectada
        : c === 'respondida' ? !!t.respondida
          : c === 'estudada' ? t.estudada
            : c === 'praticada' ? t.praticada
              : !!t.detectada;

/** Técnica passa no filtro de camada e na busca por ID/nome. */
export function tecnicaVisivel(t: CoberturaTecnica, camada: Camada | null, busca: string) {
  if (camada && !temCamada(t, camada)) return false;
  const q = normalizar(busca.trim());
  return !q || normalizar(`${t.id} ${t.nome}`).includes(q);
}

export interface Passo { texto: string; tone?: Tone }

/**
 * Próximo passo sugerido pela progressão observação → alerta → validação → resposta
 * (docs/INTELIGENCIA.md). `praticada` (indicador de estudo/prática, fora do ciclo das
 * quatro etapas) entra como um segundo critério: sem nenhuma das quatro etapas, mas já
 * praticada em lab, o próximo passo é gerar o evento/alerta real, não "iniciar do zero".
 */
export function proximoPassoTecnica(t: CoberturaTecnica): Passo {
  if (!t.observada && !t.alerta && !t.detectada && !t.respondida) {
    if (t.praticada) return { texto: 'Já praticada em lab, mas sem evento real ou alerta de exercício registrado. Gere o evento no Radar ou registre um alerta no diário Red × Blue para iniciar o ciclo.', tone: 'serious' };
    if (t.estudada) return { texto: 'Já estudada, mas ainda sem prática registrada. Pratique esta técnica em um lab autorizado para iniciar o ciclo operacional.', tone: 'info' };
    return { texto: 'Sem registro operacional para esta técnica. Estude-a na base MITRE ATT&CK e gere um evento controlado em um lab autorizado para iniciar o ciclo.', tone: 'info' };
  }
  if (t.observada && !t.alerta) return { texto: 'Há eventos reais no Radar, mas nenhum alerta foi registrado em exercício ligado a esta técnica. Verifique a telemetria e teste uma regra no lab.', tone: 'danger' };
  if (t.alerta && !t.detectada) return { texto: 'Um exercício gerou sinal. Valide a regra com evidência, confirme se o alerta é correto e registre falsos positivos.', tone: 'serious' };
  if (t.detectada && !t.respondida) return { texto: 'A regra foi validada, mas falta documentar a triagem e a resposta: contenção, recuperação e tempos.', tone: 'warning' };
  if (t.respondida) return { texto: 'Ciclo documentado. Revise a resposta após mudanças de regra, ativos ou telemetria.' };
  return { texto: 'Sem alerta confirmado no exercício. Revise a regra e a cobertura dos logs antes de concluir o teste.', tone: 'warning' };
}

/** CVEs citadas em exercícios Red × Blue (campo "referência do achado"). */
export const cvesDosExercicios = (ex: PurpleExercise[]) =>
  [...new Set(ex.map((e) => e.findingReference.trim().toUpperCase()).filter((r) => /^CVE-\d{4}-\d+$/.test(r)))];

export const DETECCAO_LABEL: Record<PurpleExercise['detection'], string> = {
  detectado: 'detectado', parcial: 'parcial', nao_detectado: 'não detectado', nao_testado: 'não testado',
};

// ---------------------------------------------------------------- Ameaças (CISA KEV)

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sugestão por nome/tag: ativos cujo texto cita o produto, o fabricante ou o termo acompanhado. */
export function ativosRelacionados(i: Pick<KevItem, 'fabricante' | 'produto' | 'termo'>, ativos: Ativo[]): Ativo[] {
  const palavras = [i.produto, i.fabricante, i.termo].flatMap((v) => normalizar(v).split(/[^a-z0-9]+/)).filter((v) => v.length >= 4);
  if (!palavras.length) return [];
  return ativos.filter((a) => {
    const texto = normalizar([a.nome, a.funcao, ...a.tags, ...Object.values(a.detalhes)].join(' '));
    return palavras.some((p) => texto.includes(p));
  });
}

const DIA = 86_400_000;
export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);

/** Situação do prazo da CISA (referência federal dos EUA; para o homelab serve de régua). */
export function prazoKev(prazo: string | null, hoje: string): { texto: string; tone?: Tone } {
  if (!prazo) return { texto: 'Sem prazo definido' };
  const d = diasEntre(hoje, prazo);
  if (d < 0) return { texto: `Prazo passou há ${-d} dia(s) (${prazo})`, tone: 'muted' };
  if (d === 0) return { texto: `Prazo vence hoje (${prazo})`, tone: 'serious' };
  return { texto: `Faltam ${d} dia(s) (${prazo})`, tone: d <= 14 ? 'serious' : undefined };
}

/** Tom do cartão: ativo possivelmente afetado + ransomware é o pior caso. */
export function tomKev(ransomware: boolean, nAtivos: number): Tone | undefined {
  if (nAtivos > 0 && ransomware) return 'danger';
  if (nAtivos > 0) return 'serious';
  if (ransomware) return 'warning';
  return undefined;
}

const PESO: Record<string, number> = { danger: 0, serious: 1, warning: 2 };
/** Ordena o que pede ação primeiro; depois as que entraram no catálogo mais recentemente. */
export function ordenarKev<T extends { item: KevItem; tone?: Tone }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => (PESO[a.tone ?? ''] ?? 9) - (PESO[b.tone ?? ''] ?? 9) || b.item.adicionadoEm.localeCompare(a.item.adicionadoEm));
}

export const kevCasaBusca = (i: KevItem, busca: string) => {
  const q = normalizar(busca.trim());
  return !q || normalizar(`${i.cve} ${i.nome} ${i.fabricante} ${i.produto} ${i.descricao}`).includes(q);
};

export const exerciciosDoCve = (cve: string, ex: PurpleExercise[]) =>
  ex.filter((e) => e.findingReference.trim().toUpperCase() === cve.toUpperCase());

export const tecnicasDosExercicios = (ex: PurpleExercise[]) =>
  [...new Set(ex.flatMap((e) => e.techniques.map((t) => t.trim().toUpperCase().split('.')[0])))];
