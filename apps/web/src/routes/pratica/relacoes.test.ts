import { describe, expect, it } from 'vitest';
import type { FerramentaCatalogo, Lab, RangeAlvo } from '@seginfo/shared';
import {
  alvosComFerramenta, alvosDoLab, apelidos, barraTone, citaFerramenta, combina, exerciciosDoAlvo,
  ferramentasDoLab, labPedeAcao, labsDaFerramenta, pct, resumoRedBlue, toneEtapa,
} from './relacoes';

const fer = (p: Partial<FerramentaCatalogo>): FerramentaCatalogo => ({
  id: p.nome ?? 'f', nome: 'X', fase: 'varredura', dominio: 'red', descricao: '', kali: false, ...p,
});
const lab = (p: Partial<Lab>): Lab => ({
  id: 'lab', titulo: 'Lab', objetivo: '', dominio: 'blue', nivel: 'basico', ativosAlvo: [], passos: [], resultadoEsperado: '', ...p,
});
const alvo = (p: Partial<RangeAlvo>): RangeAlvo => ({
  id: 'a', nome: 'A', dominio: 'red', categoria: 'vm_vitima', descricao: '', portas: [], ferramentas: [], ...p,
});
const ex = (p: Partial<{ status: string; detection: string; retestResult: string; rangeTargetIds: string[] }>) => ({
  status: 'executado', detection: 'detectado', retestResult: 'pendente', rangeTargetIds: [] as string[], ...p,
});

describe('busca', () => {
  it('ignora acento, caixa e ordem dos termos', () => {
    expect(combina('varredura NMAP', 'Nmap', 'Varredura de rede')).toBe(true);
    expect(combina('pericia', 'Perícia & resposta')).toBe(true);
    expect(combina('', 'qualquer')).toBe(true);
    expect(combina('hydra', 'Nmap')).toBe(false);
  });
});

describe('ferramenta citada em texto', () => {
  it('gera apelidos úteis a partir do nome', () => {
    expect(apelidos('Dirb / Dirsearch')).toEqual(['Dirb', 'Dirsearch']);
    expect(apelidos('Social-Engineer Toolkit (SET)')).toEqual(['Social-Engineer Toolkit', 'SET']);
    expect(apelidos('Metasploit Framework')).toContain('Metasploit');
    expect(apelidos('Volatility 3')).toContain('Volatility');
    expect(apelidos('OWASP ZAP')).toContain('ZAP');
  });

  it('casa palavra inteira, sem confundir trechos', () => {
    expect(citaFerramenta({ nome: 'Nmap' }, ['Rodar nmap autorizado'])).toBe(true);
    expect(citaFerramenta({ nome: 'Nmap' }, ['zenmapper'])).toBe(false);
    expect(citaFerramenta({ nome: 'Aircrack-ng' }, ['use o aircrack-ng'])).toBe(true);
    expect(citaFerramenta({ nome: 'Wazuh' }, ['Agente Wazuh'])).toBe(true);
  });

  it('sigla curta só casa em maiúsculas', () => {
    expect(citaFerramenta({ nome: 'Social-Engineer Toolkit (SET)' }, ['set de regras'])).toBe(false);
    expect(citaFerramenta({ nome: 'Social-Engineer Toolkit (SET)' }, ['campanha com o SET'])).toBe(true);
  });
});

describe('relações entre lab, ferramenta e range', () => {
  const nmap = fer({ id: 'nmap', nome: 'Nmap', topicoId: 'red-nmap' });
  const hydra = fer({ id: 'hydra', nome: 'Hydra' });
  const wazuh = fer({ id: 'wazuh', nome: 'Wazuh', topicoId: 'siem' });

  it('ferramentas do lab vêm do tópico e dos passos, sem repetir', () => {
    const l = lab({ topicoId: 'siem', passos: ['Rodar nmap contra o alvo', 'Ver alerta no Wazuh'] });
    expect(ferramentasDoLab(l, [nmap, hydra, wazuh]).map((f) => f.id)).toEqual(['nmap', 'wazuh']);
  });

  it('labs da ferramenta vêm do tópico ou do texto', () => {
    const a = lab({ id: 'a', topicoId: 'red-nmap' });
    const b = lab({ id: 'b', passos: ['brute force com Hydra'] });
    expect(labsDaFerramenta(nmap, [a, b]).map((l) => l.id)).toEqual(['a']);
    expect(labsDaFerramenta(hydra, [a, b]).map((l) => l.id)).toEqual(['b']);
  });

  it('alvos do range com a ferramenta e do lab', () => {
    const v = alvo({ id: 'v', ferramentas: ['Agente Wazuh', 'Sysmon'], labId: 'lab-x' });
    const k = alvo({ id: 'k', ferramentas: ['nmap', 'Burp Suite'] });
    expect(alvosComFerramenta(wazuh, [v, k]).map((a) => a.id)).toEqual(['v']);
    expect(alvosComFerramenta(nmap, [v, k]).map((a) => a.id)).toEqual(['k']);
    expect(alvosDoLab('lab-x', [v, k]).map((a) => a.id)).toEqual(['v']);
  });

  it('exercícios do alvo', () => {
    expect(exerciciosDoAlvo('v', [ex({ rangeTargetIds: ['v'] }), ex({ rangeTargetIds: ['k'] })])).toHaveLength(1);
  });
});

describe('resumos e tons', () => {
  it('resume o registro Red × Blue ignorando planejados', () => {
    const r = resumoRedBlue([
      ex({ status: 'planejado', detection: 'nao_detectado' }),
      ex({ detection: 'detectado', retestResult: 'aprovado' }),
      ex({ detection: 'parcial' }),
    ]);
    expect(r).toEqual({ total: 3, executados: 2, detectados: 1, lacunas: 1, retestes: 1 });
  });

  it('lab pede ação só com lacuna sem reteste aprovado', () => {
    expect(labPedeAcao([ex({ detection: 'nao_detectado' })])).toBe(true);
    expect(labPedeAcao([ex({ detection: 'nao_detectado', retestResult: 'aprovado' })])).toBe(false);
    expect(labPedeAcao([ex({ status: 'planejado', detection: 'nao_detectado' })])).toBe(false);
  });

  it('etapa pendente de criticidade alta pede atenção; concluída fica neutra', () => {
    expect(toneEtapa('alta', false)).toBe('warning');
    expect(toneEtapa('alta', true)).toBeUndefined();
    expect(toneEtapa('media', false)).toBeUndefined();
  });

  it('percentual e barra', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBe(0);
    expect(barraTone(100)).toBe('ok');
    expect(barraTone(50)).toBeUndefined();
  });
});

describe('datas', () => {
  it('formata data ISO em pt-BR e tolera vazio', async () => {
    const { dataBR } = await import('./relacoes');
    expect(dataBR('2026-03-05')).toBe('05/03/2026');
    expect(dataBR('')).toBe('');
  });
});
