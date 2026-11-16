import { describe, expect, it } from 'vitest';
import type { Ativo } from '@seginfo/shared';
import type { CoberturaTecnica } from '@/services/attack';
import type { KevItem } from '@/services/kev';
import type { PurpleExercise } from '@/services/exerciciosPurple';
import {
  acaoMeta, acoesDaTecnica, ativosRelacionados, cvesDosExercicios, exerciciosDoCve, formatarUtc, kevCasaBusca,
  ordenarKev, prazoKev, proximoPassoTecnica, tecnicaVisivel, tecnicasDosExercicios, temCamada, tomKev,
} from './regras';

const ativo = (p: Partial<Ativo>): Ativo => ({
  id: p.nome ?? 'x', ambiente: 'criecomia', tipo: 'vm', nome: 'x', endereco: '', funcao: '',
  estado: 'ativo', detalhes: {}, tags: [], labsRelacionados: [], ...p,
});

const tec = (p: Partial<CoberturaTecnica>): CoberturaTecnica => ({
  id: 'T1110', nome: 'Brute Force', tatica: 'TA0006', estudada: false, praticada: false, detectada: null,
  observada: 0, topicos: [], labs: [], exercicios: [], ...p,
});

const kev = (p: Partial<KevItem>): KevItem => ({
  cve: 'CVE-2024-0001', fabricante: 'Fortinet', produto: 'FortiOS', nome: 'Falha X', adicionadoEm: '2026-01-01',
  prazo: null, descricao: 'desc', acao: 'aplicar patch', ransomware: false, termo: 'fortinet', ...p,
});

const ex = (p: Partial<PurpleExercise>) => ({ findingReference: '', techniques: [], ...p }) as PurpleExercise;

describe('Radar', () => {
  it('ação conhecida tem rótulo e tom; desconhecida vira texto legível sem tom', () => {
    expect(acaoMeta('login_ok')).toMatchObject({ label: 'Login aceito', tone: 'danger' });
    expect(acaoMeta('bloqueio').tone).toBeUndefined();
    expect(acaoMeta('nova_acao').label).toBe('nova acao');
    expect(acaoMeta('nova_acao').tone).toBeUndefined();
  });

  it('técnica lista as ações que a geram (espelho da API)', () => {
    expect(acoesDaTecnica('T1110').sort()).toEqual(['lockout', 'login_falha']);
    expect(acoesDaTecnica('T9999')).toEqual([]);
  });

  it('formata data UTC sem milissegundos', () => {
    expect(formatarUtc('2026-11-13T08:05:09.123Z')).toBe('2026-11-13 08:05:09');
  });
});

describe('Matriz ATT&CK', () => {
  it('camadas e filtro com busca', () => {
    const t = tec({ estudada: true, observada: 3 });
    expect(temCamada(t, 'observada')).toBe(true);
    expect(temCamada(t, 'detectada')).toBe(false);
    expect(tecnicaVisivel(t, 'estudada', 'brute')).toBe(true);
    expect(tecnicaVisivel(t, 'praticada', '')).toBe(false);
    expect(tecnicaVisivel(t, null, 't1110')).toBe(true);
    expect(tecnicaVisivel(t, null, 'phishing')).toBe(false);
  });

  it('próximo passo segue observação → alerta → validação → resposta', () => {
    const regra = { regra: 'r', testadoEm: '2026-01-01' };
    expect(proximoPassoTecnica(tec({ observada: 2 })).tone).toBe('danger');
    expect(proximoPassoTecnica(tec({ alerta: true })).tone).toBe('serious');
    expect(proximoPassoTecnica(tec({ alerta: true, detectada: regra })).tone).toBe('warning');
    expect(proximoPassoTecnica(tec({ alerta: true, detectada: regra, respondida: true })).tone).toBeUndefined();
    expect(proximoPassoTecnica(tec({ praticada: true })).tone).toBe('serious');
    expect(proximoPassoTecnica(tec({})).texto).toMatch(/MITRE/);
    expect(proximoPassoTecnica(tec({ estudada: true })).texto).toMatch(/Pratique/);
  });

  it('alerta real do Wazuh tira a técnica do vermelho e pede validação citando a regra', () => {
    const wz = { id: 'T1110', alertas: 120, ultimo: null, agentes: ['honeypot'], regras: [{ id: '100201', descricao: 'Cowrie: login falho', nivel: 5, alertas: 120 }] };
    const p = proximoPassoTecnica(tec({ observada: 50, alerta: true, alertaWazuh: wz, alertaExercicio: false }));
    expect(p.tone).toBe('serious');
    expect(p.texto).toMatch(/Wazuh já alerta.*100201/);
    expect(proximoPassoTecnica(tec({ observada: 50 })).texto).toMatch(/nenhuma regra do Wazuh/);
  });

  it('extrai CVEs válidas dos exercícios, sem repetir', () => {
    expect(cvesDosExercicios([ex({ findingReference: 'cve-2024-1234 ' }), ex({ findingReference: 'CVE-2024-1234' }), ex({ findingReference: 'achado interno' })]))
      .toEqual(['CVE-2024-1234']);
  });
});

describe('Ameaças KEV', () => {
  it('sugere ativos por produto/fabricante, ignorando acento e palavras curtas', () => {
    const lista = [ativo({ nome: 'fw-borda', tags: ['fortinet'] }), ativo({ nome: 'nas', funcao: 'Armazenamento' })];
    expect(ativosRelacionados(kev({}), lista).map((a) => a.nome)).toEqual(['fw-borda']);
    expect(ativosRelacionados(kev({ fabricante: 'HP', produto: 'X', termo: 'hp' }), lista)).toEqual([]);
  });

  it('prazo: vencido fica neutro, próximo pede atenção', () => {
    expect(prazoKev(null, '2026-11-13').tone).toBeUndefined();
    expect(prazoKev('2026-11-01', '2026-11-13')).toMatchObject({ tone: 'muted' });
    expect(prazoKev('2026-11-13', '2026-11-13').tone).toBe('serious');
    expect(prazoKev('2026-11-20', '2026-11-13')).toMatchObject({ tone: 'serious', texto: 'Faltam 7 dia(s) (2026-11-20)' });
    expect(prazoKev('2027-01-20', '2026-11-13').tone).toBeUndefined();
  });

  it('tom e ordem: ativo afetado + ransomware primeiro, depois mais recentes', () => {
    expect(tomKev(true, 1)).toBe('danger');
    expect(tomKev(false, 2)).toBe('serious');
    expect(tomKev(true, 0)).toBe('warning');
    expect(tomKev(false, 0)).toBeUndefined();
    const r = ordenarKev([
      { item: kev({ cve: 'a', adicionadoEm: '2026-03-01' }) },
      { item: kev({ cve: 'b', adicionadoEm: '2026-01-01' }), tone: 'warning' as const },
      { item: kev({ cve: 'c', adicionadoEm: '2026-05-01' }) },
      { item: kev({ cve: 'd' }), tone: 'danger' as const },
    ]);
    expect(r.map((x) => x.item.cve)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('busca por CVE/produto e liga exercícios pela referência do achado', () => {
    expect(kevCasaBusca(kev({}), 'fortios')).toBe(true);
    expect(kevCasaBusca(kev({}), 'cisco')).toBe(false);
    const lista = [ex({ findingReference: 'cve-2024-0001', techniques: ['T1190', 't1059.001'] }), ex({ findingReference: 'outro' })];
    const doCve = exerciciosDoCve('CVE-2024-0001', lista);
    expect(doCve).toHaveLength(1);
    expect(tecnicasDosExercicios(doCve)).toEqual(['T1190', 'T1059']);
  });
});
