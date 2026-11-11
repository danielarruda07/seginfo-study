import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { getKev, getTermos, setTermos, TERMOS_PADRAO } from '@/services/kev';

const PERIODOS = [
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
  { dias: 365, label: '1 ano' },
  { dias: 0, label: 'Tudo' },
];

export function Ameacas() {
  const [termos, setTermosState] = useState<string[]>(getTermos);
  const [novo, setNovo] = useState('');
  const [dias, setDias] = useState(90);
  const [termoFiltro, setTermoFiltro] = useState<string | null>(null);

  const kev = useQuery({ queryKey: ['kev', termos, dias], queryFn: () => getKev(termos, dias), enabled: termos.length > 0, retry: false, staleTime: 3_600_000 });

  const salvar = (lista: string[]) => { setTermos(lista); setTermosState(getTermos()); setTermoFiltro(null); };
  const adicionar = () => { if (novo.trim().length >= 2) { salvar([...termos, novo]); setNovo(''); } };

  const itens = (kev.data?.itens ?? []).filter((i) => !termoFiltro || i.termo === termoFiltro.toLowerCase());
  const hoje = new Date().toISOString().slice(0, 10);
  const ransomware = itens.filter((i) => i.ransomware).length;
  const recentes = itens.filter((i) => i.adicionadoEm >= new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)).length;

  return (
    <div>
      <PageHeader title="Ameaças (CISA KEV)"
        subtitle="Vulnerabilidades exploradas ativamente que afetam os produtos que você usa. Priorize estas antes do resto." />

      <section className="iv-card">
        <h3 style={{ marginTop: 0 }}>Produtos e fabricantes acompanhados</h3>
        <p className="iv-muted" style={{ marginTop: 0 }}>Use os nomes como aparecem no catálogo (ex.: Fortinet, Cisco IOS). Fica salvo neste navegador.</p>
        <div className="iv-row iv-wrap">
          {termos.map((t) => (
            <Chip key={t} label={t} icon="pi-times" onClick={() => salvar(termos.filter((x) => x !== t))} />
          ))}
        </div>
        <div className="iv-row iv-wrap iv-mt">
          <InputText value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={60} placeholder="Adicionar produto…"
            aria-label="Adicionar produto" onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }} />
          <Button label="Adicionar" icon="pi pi-plus" onClick={adicionar} />
          <Button label="Restaurar padrão" severity="secondary" text onClick={() => salvar(TERMOS_PADRAO)} />
        </div>
      </section>

      <div className="iv-row iv-wrap iv-mt">
        {PERIODOS.map((p) => <Chip key={p.dias} label={`Adicionadas em: ${p.label}`} active={dias === p.dias} onClick={() => setDias(p.dias)} />)}
      </div>

      {kev.isError && (
        <StatusStrip tone="crit" icon="pi-exclamation-triangle">
          Não foi possível consultar o catálogo. Esta página precisa da API (modo servidor) e de acesso à internet no servidor.
        </StatusStrip>
      )}
      {kev.data?.desatualizado && (
        <StatusStrip tone="warn" icon="pi-clock">A CISA não respondeu agora; mostrando o último catálogo baixado.</StatusStrip>
      )}

      {kev.data && (
        <>
          <div className="iv-kpis iv-mt">
            <Kpi label="Encontradas" value={itens.length} hint={`de ${kev.data.totalCatalogo} no catálogo`} />
            <Kpi label="Últimos 30 dias" value={recentes} hint="entraram recentemente" />
            <Kpi label="Usadas por ransomware" value={ransomware} hint="campanhas conhecidas" />
            <Kpi label="Catálogo" value={kev.data.versao} hint={`publicado em ${kev.data.publicadoEm.slice(0, 10)}`} />
          </div>

          <div className="iv-row iv-wrap iv-mt">
            <Chip label="Todos os produtos" active={!termoFiltro} onClick={() => setTermoFiltro(null)} />
            {termos.map((t) => {
              const n = kev.data.itens.filter((i) => i.termo === t.toLowerCase()).length;
              return n > 0 ? <Chip key={t} label={`${t} (${n})`} active={termoFiltro === t} onClick={() => setTermoFiltro(t)} /> : null;
            })}
          </div>

          {itens.length === 0 && (
            <StatusStrip tone="ok" icon="pi-check-circle">Nenhuma vulnerabilidade explorada ativamente para esses produtos no período.</StatusStrip>
          )}

          <div className="iv-col iv-mt">
            {itens.map((i) => (
              <article key={i.cve} className="iv-card kev-item">
                <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
                  <a href={`https://nvd.nist.gov/vuln/detail/${i.cve}`} target="_blank" rel="noreferrer noopener"><strong style={{ fontFamily: 'monospace' }}>{i.cve}</strong></a>
                  <div className="iv-row iv-wrap">
                    <Pill label={`${i.fabricante} · ${i.produto}`} />
                    {i.ransomware && <Pill label="Ransomware" color="#ef4444" icon="pi-exclamation-triangle" />}
                    {i.prazo && <Pill label={`Prazo CISA: ${i.prazo}`} color={i.prazo < hoje ? '#64748b' : '#f59e0b'} />}
                  </div>
                </div>
                <h4>{i.nome}</h4>
                <p>{i.descricao}</p>
                <p className="iv-muted"><strong>Ação:</strong> {i.acao}</p>
                <p className="iv-muted">Entrou no KEV em {i.adicionadoEm}.</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
