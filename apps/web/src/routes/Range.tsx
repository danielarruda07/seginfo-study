import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { TabView, TabPanel } from 'primereact/tabview';
import type { RangeProgressoItem } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bar, StatusStrip } from '@/components/InfraKit';
import {
  getLabVars, getProgressoChecklist, listProgressoChecklist, listRangeAlvos, listRangeChecklist, listRangeExercicios,
  saveLabVars, saveProgressoChecklist,
} from '@/services/range';
import { valorVar, type LabVars } from '@/services/rangePrompt';
import { LAB_VARS } from '@/data/rangeLab';
import { barraTone, pct } from './pratica/relacoes';
import { GRUPOS_PREPARACAO, type Progresso } from './range/meta';
import { AlvosPanel } from './range/AlvosPanel';
import { EtapasPanel } from './range/EtapasPanel';
import { LabVarsPanel } from './range/LabVarsPanel';
import '@/styles/telas/pratica.css';

const ABA = { configurar: 0, alvos: 1, checklist: 2, exercicios: 3 } as const;

export function Range() {
  const [aba, setAba] = useState<number>(ABA.configurar);
  const [vars, setVars] = useState<LabVars>(() => getLabVars());
  // progresso do checklist e dos exercícios num lugar só: o resumo do topo acompanha cada check
  const [progresso, setProgresso] = useState<Progresso>(() => listProgressoChecklist());
  const checklist = useMemo(() => listRangeChecklist(), []);
  const exercicios = useMemo(() => listRangeExercicios(), []);
  const totalAlvos = listRangeAlvos().length;

  const preenchidos = LAB_VARS.filter((v) => valorVar(v.chave, vars)).length;
  const feitos = (lista: { id: string }[]) => lista.filter((i) => progresso[i.id]?.concluido).length;
  const prep = { feitos: feitos(checklist), total: checklist.length };
  const exerc = { feitos: feitos(exercicios), total: exercicios.length };
  const prepPct = pct(prep.feitos, prep.total);

  function salvarVars(novas: LabVars) { saveLabVars(novas); setVars(novas); }
  function salvarEtapa(id: string, novo: RangeProgressoItem) {
    saveProgressoChecklist(id, novo);
    setProgresso((atual) => ({ ...atual, [id]: getProgressoChecklist(id) }));
  }
  const irConfigurar = () => setAba(ABA.configurar);

  const resumo = [
    { aba: ABA.configurar, rotulo: 'Ambiente configurado', p: pct(preenchidos, LAB_VARS.length), dica: preenchidos === LAB_VARS.length ? 'tudo preenchido' : `${LAB_VARS.length - preenchidos} em branco` },
    { aba: ABA.alvos, rotulo: 'Alvos do range', valor: String(totalAlvos), dica: 'VMs, serviços e segmentos' },
    { aba: ABA.checklist, rotulo: 'Checklist de preparação', p: prepPct, dica: `${prep.feitos} de ${prep.total}` },
    { aba: ABA.exercicios, rotulo: 'Exercícios', p: pct(exerc.feitos, exerc.total), dica: `${exerc.feitos} de ${exerc.total}` },
  ];

  return (
    <div>
      <PageHeader title="Range Vulnerável"
        subtitle="Ambiente controlado e propositalmente exposto para treinar Blue, Red e Purple Team no homelab, isolado de produção e da internet." />

      <StatusStrip tone="warn" icon="pi-exclamation-triangle">
        <strong>Regra de ouro:</strong> este segmento nunca tem rota para produção ou gerência nem saída direta para a internet.
        Use sempre uma VLAN própria, snapshots e credenciais exclusivas do range.
      </StatusStrip>
      <p className="pr-nota">
        Os modelos de operador (firewall, switch e Proxmox) em <Link to="/agents">Agents</Link> executam este checklist com a sua aprovação;
        eventos reais continuam no <Link to="/radar">Radar</Link>. Contexto completo em <code>docs/IDEIAS_LAB.md</code> (Labs 8 e 9).
      </p>

      <nav className="pr-progresso iv-mt" aria-label="Progresso do Range">
        {resumo.map((r) => (
          <button key={r.aba} type="button" className="pr-progresso__item" aria-current={aba === r.aba || undefined} onClick={() => setAba(r.aba)}>
            <span className="pr-progresso__rotulo">{r.rotulo}</span>
            <span className="pr-progresso__valor"><strong>{r.p !== undefined ? `${r.p}%` : r.valor}</strong><span>{r.dica}</span></span>
            {r.p !== undefined && <Bar pct={r.p} tone={barraTone(r.p)} />}
          </button>
        ))}
      </nav>

      <TabView className="iv-mt" activeIndex={aba} onTabChange={(e) => setAba(e.index)}>
        <TabPanel header="Configurar meu ambiente">
          <LabVarsPanel vars={vars} onChange={salvarVars} />
        </TabPanel>
        <TabPanel header="Alvos do range">
          <AlvosPanel prepPct={prepPct} onVerChecklist={() => setAba(ABA.checklist)} />
        </TabPanel>
        <TabPanel header="Checklist e documentação">
          <EtapasPanel itens={checklist} progresso={progresso} vars={vars} grupos={GRUPOS_PREPARACAO} rotulo="etapas"
            onSave={salvarEtapa} onAbrirLab={irConfigurar} />
        </TabPanel>
        <TabPanel header="Exercícios">
          <EtapasPanel itens={exercicios} progresso={progresso} vars={vars} rotulo="exercícios"
            onSave={salvarEtapa} onAbrirLab={irConfigurar}
            aviso={prepPct < 100 && (
              <StatusStrip tone="warn" icon="pi-shield">
                Exercícios ofensivos e purple (infecção simulada, emulação de adversário) só depois do checklist de preparação:
                hoje {prep.feitos} de {prep.total} ({prepPct}%). Tudo acontece só dentro da VLAN do range, nunca em produção.
              </StatusStrip>
            )} />
        </TabPanel>
      </TabView>
    </div>
  );
}
