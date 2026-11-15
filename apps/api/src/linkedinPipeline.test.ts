import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avaliarAgendamento, bloqueiosDoPreflight, diaLocal, exposicaoNoTexto, horaLocal, pendenciasNoTexto, preflightLiberado,
  preflightPost, textoDoPost, type SugestaoPauta,
} from '@seginfo/shared';
import { filtrarPauta, fimDoPeriodo } from './ia.js';
import { paraLittleText, variaveisFaltando, versaoApi } from './linkedinApi.js';
import { bloqueiosDoServidor } from './linkedinAgendador.js';
import { briefingDoRadar } from './linkedinRadar.js';

afterEach(() => vi.unstubAllEnvs());

const CORPO = 'Montei um laboratório para observar tentativas de login.\n\nAprendi que senha fraca cai em minutos.\n\nO que você mediria?';

describe('preflight (regras que liberam um post)', () => {
  it('libera um texto limpo', () => {
    const itens = preflightPost({ gancho: 'O que 7 dias de honeypot me ensinaram', corpo: CORPO });
    expect(preflightLiberado(itens)).toBe(true);
    expect(bloqueiosDoPreflight(itens)).toEqual([]);
  });

  it('bloqueia campo entre colchetes que a IA deixou para preencher', () => {
    const itens = preflightPost({ gancho: 'Fiquei a uma questão da certificação', corpo: `${CORPO}\n\nSituação atual: [CONFIRMAR: situação da certificação]` });
    expect(preflightLiberado(itens)).toBe(false);
    expect(pendenciasNoTexto('a [CONFIRMAR: x] b [A] c')).toEqual(['[CONFIRMAR: x]', '[A]']);
  });

  it('bloqueia endereço IP, faixa privada e domínio interno; não confunde versão com IP', () => {
    expect(exposicaoNoTexto('acessei 192.0.2.10 pelo painel')).toContain('endereço IP ou de rede');
    expect(exposicaoNoTexto('a rede 10.10.82 ficou isolada')).toContain('endereço IP ou de rede');
    expect(exposicaoNoTexto('o host srv01.empresa.local caiu')).toContain('domínio do ambiente');
    expect(exposicaoNoTexto('atualizei para a versão 10.5 e o top 10. Depois medi.')).toEqual([]);
    expect(exposicaoNoTexto('painel em app.exemplo.example', ['exemplo.example'])).toContain('domínio do ambiente');
  });

  it('termo sensível avisa, mas não bloqueia', () => {
    const itens = preflightPost({ gancho: 'Um serviço exposto é achado em horas', corpo: CORPO });
    expect(itens.find((i) => i.id === 'sensivel')?.ok).toBe(false);
    expect(preflightLiberado(itens)).toBe(true);
  });

  it('bloqueia acima de 3.000 caracteres, texto curto demais e ativo citado pelo navegador', () => {
    expect(preflightLiberado(preflightPost({ gancho: 'Um gancho com tamanho suficiente', corpo: 'x'.repeat(3_100) }))).toBe(false);
    expect(preflightLiberado(preflightPost({ gancho: 'curto', corpo: 'curto' }))).toBe(false);
    const itens = preflightPost({ gancho: 'O que 7 dias de honeypot me ensinaram', corpo: CORPO }, { riscosExtras: ['fw-borda'] });
    expect(bloqueiosDoPreflight(itens)).toEqual(['Cita fw-borda']);
  });

  it('o servidor soma os domínios do ambiente definidos por variável', () => {
    vi.stubEnv('LINKEDIN_DOMINIOS_BLOQUEADOS', 'lab.example, outro.example');
    expect(bloqueiosDoServidor({ gancho: 'O que 7 dias de honeypot me ensinaram', corpo: `${CORPO}\n\nPainel em painel.lab.example` })).toHaveLength(1);
    expect(bloqueiosDoServidor({ gancho: 'O que 7 dias de honeypot me ensinaram', corpo: CORPO })).toEqual([]);
  });

  it('monta o texto como vai para o LinkedIn', () => {
    expect(textoDoPost('  Gancho ', ' Corpo\n')).toBe('Gancho\n\nCorpo');
  });
});

describe('agendamento', () => {
  const agora = new Date('2026-11-16T12:00:00.000Z');

  it('converte o instante para dia e hora no fuso do dono', () => {
    expect(diaLocal('2026-11-17T01:30:00.000Z', 'America/Fortaleza')).toBe('2026-11-16');
    expect(horaLocal('2026-11-17T01:30:00.000Z', 'America/Fortaleza')).toBe(22);
  });

  it('recusa horário no passado, em cima da hora ou longe demais', () => {
    expect(avaliarAgendamento('2026-11-16T11:00:00.000Z', agora, []).erro).toMatch(/2 minutos/);
    expect(avaliarAgendamento('2026-11-16T12:01:00.000Z', agora, []).erro).toMatch(/2 minutos/);
    expect(avaliarAgendamento('2027-11-16T12:00:00.000Z', agora, []).erro).toMatch(/6 meses/);
    expect(avaliarAgendamento('não é data', agora, []).erro).toMatch(/inválidas/);
  });

  it('aponta conflito quando o dia local já tem post, e não quando é dia vizinho', () => {
    // 01:30 UTC do dia 18 ainda é dia 17 em Fortaleza
    const ocupado = ['2026-11-17T15:00:00.000Z'];
    expect(avaliarAgendamento('2026-11-18T01:30:00.000Z', agora, ocupado).conflito).toMatch(/17\/11\/2026/);
    expect(avaliarAgendamento('2026-11-18T13:00:00.000Z', agora, ocupado).conflito).toBeNull();
  });

  it('avisa sobre horário de pouca audiência, sem impedir', () => {
    const madrugada = avaliarAgendamento('2026-11-17T06:00:00.000Z', agora, []); // 03:00 em Fortaleza
    expect(madrugada.erro).toBeNull();
    expect(madrugada.avisos).toHaveLength(1);
    expect(avaliarAgendamento('2026-11-17T13:00:00.000Z', agora, []).avisos).toEqual([]);
  });
});

describe('texto para a API do LinkedIn (little text)', () => {
  it('escapa os caracteres reservados', () => {
    expect(paraLittleText('custo (aprox.) de 10* e a_b [x] <y> {z} | ~ok')).toBe('custo \\(aprox.\\) de 10\\* e a\\_b \\[x\\] \\<y\\> \\{z\\} \\| \\~ok');
    expect(paraLittleText('caminho C:\\temp e fale com @fulano')).toBe('caminho C:\\\\temp e fale com \\@fulano');
  });

  it('transforma hashtags no modelo da API e mantém quebras de linha', () => {
    expect(paraLittleText('Fim do post.\n\n#BlueTeam #segurança_da_informação')).toBe('Fim do post.\n\n{hashtag|\\#|BlueTeam} {hashtag|\\#|segurança_da_informação}');
    expect(paraLittleText('#inicio do texto')).toBe('{hashtag|\\#|inicio} do texto');
  });

  it('um # solto ou no meio de uma palavra é só escapado', () => {
    expect(paraLittleText('item # 3 e C#')).toBe('item \\# 3 e C\\#');
  });
});

describe('conexão com o LinkedIn', () => {
  it('usa a versão conhecida enquanto ela é recente; depois, a de dois meses atrás (sem dezembro)', () => {
    vi.stubEnv('LINKEDIN_API_VERSION', '');
    expect(versaoApi(new Date('2026-11-15T00:00:00Z'))).toBe('202610');
    expect(versaoApi(new Date('2027-07-20T00:00:00Z'))).toBe('202610');
    expect(versaoApi(new Date('2027-09-10T00:00:00Z'))).toBe('202707');
    expect(versaoApi(new Date('2028-02-10T00:00:00Z'))).toBe('202711');
    vi.stubEnv('LINKEDIN_API_VERSION', '202701');
    expect(versaoApi(new Date('2026-11-15T00:00:00Z'))).toBe('202701');
  });

  it('lista só os nomes das variáveis que faltam', () => {
    for (const k of ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'PUBLIC_BASE_URL', 'STORAGE_TOKEN_KEY']) vi.stubEnv(k, '');
    expect(variaveisFaltando()).toEqual(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'PUBLIC_BASE_URL', 'STORAGE_TOKEN_KEY']);
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'abc');
    expect(variaveisFaltando()).not.toContain('LINKEDIN_CLIENT_ID');
  });
});

describe('planejador', () => {
  const sugestao = (dia: string, projetoId = ''): SugestaoPauta => ({ titulo: 't', briefing: 'b', pilar: 'p', projetoId, formato: 'texto', dia, porque: 'x' });
  const pedido = { inicio: '2026-11-17', dias: 7, projetos: [{ id: 'proj1', nome: 'Honeypot', objetivo: '', pilar: null, diasSemPost: 3 }], diasOcupados: ['2026-11-19'] };

  it('calcula o último dia do período', () => {
    expect(fimDoPeriodo('2026-11-17', 7)).toBe('2026-11-23');
    expect(fimDoPeriodo('2026-12-30', 3)).toBe('2027-01-01');
  });

  it('descarta sugestão fora do período, em dia ocupado, repetida no mesmo dia ou com data inválida', () => {
    const r = filtrarPauta([
      sugestao('2026-11-18', 'proj1'), sugestao('2026-11-18'), sugestao('2026-11-19'), sugestao('2026-11-16'),
      sugestao('2026-11-24'), sugestao('amanhã'), sugestao('2026-11-20', 'inventado'),
    ], pedido);
    expect(r.map((s) => s.dia)).toEqual(['2026-11-18', '2026-11-20']);
    expect(r.map((s) => s.projetoId)).toEqual(['proj1', '']);
  });
});

describe('Radar → ideia', () => {
  it('monta o briefing só com números agregados e pede conferência', () => {
    const { titulo, briefing } = briefingDoRadar({
      dias: 7, total: 12_340, origensDistintas: 512,
      servicos: [['ssh', 9_000], ['rdp', 2_000]], paises: [['CN', 4_000]], usuarios: [['root', 5_000], ['admin', 900]],
      acoes: [['login_falha', 11_000], ['comando', 40]],
    }, '2026-11-15');
    expect(titulo).toContain('7 dias');
    expect(titulo).toContain('15/11/2026');
    expect(briefing).toContain('12.340 eventos');
    expect(briefing).toContain('512 origens distintas');
    expect(briefing).toContain('tentativas de login que falharam (11.000)');
    expect(briefing).toContain('root (5.000)');
    expect(briefing).toContain('[CONFIRMAR:');
    // nada que pareça endereço
    expect(briefing).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  });
});
