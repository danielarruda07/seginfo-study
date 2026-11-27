import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { Kpi, Pill, EmptyState } from '@/components/InfraKit';
import { listarHistorico, contarSeveridade } from '@/services/scanner';

/** Ferramentas agrupadas por função — a página inicial da plataforma. */
const GRUPOS = [
  {
    titulo: 'Testes de segurança',
    itens: [
      { to: '/scanner', icone: 'pi-bolt', nome: 'Scanner de endpoints', desc: 'TLS, cabeçalhos, CORS, OpenAPI, exposições, testes ativos seguros e análise de JWT. Exporta HTML/PDF.' },
      { to: '/revisao-codigo', icone: 'pi-code', nome: 'Revisão de código (IA)', desc: 'Varredura profunda de repositório com o plugin oficial claude-security: authn/authz, injeção, lógica, patches sugeridos.' },
      { to: '/exposicao', icone: 'pi-globe', nome: 'Minha exposição', desc: 'Superfície externa por OSINT passivo e saúde dos sites publicados.' },
    ],
  },
  {
    titulo: 'Detecção e resposta',
    itens: [
      { to: '/radar', icone: 'pi-eye', nome: 'Radar de ataques', desc: 'Eventos dos sensores e honeypots, por origem, serviço e técnica.' },
      { to: '/wazuh', icone: 'pi-shield', nome: 'Wazuh', desc: 'Saúde do SIEM, agentes e alertas encaminhados.' },
      { to: '/investigacoes', icone: 'pi-search', nome: 'Investigações', desc: 'Linha do tempo e evidências de cada caso.' },
      { to: '/laudos', icone: 'pi-file-check', nome: 'Laudos dos alvos', desc: 'Perícia dos alvos atacados, com técnicas MITRE.' },
      { to: '/artex', icone: 'pi-compass', nome: 'Caça a ataques agênticos', desc: 'Sinais de detecção e hunting do ARTEX e afins.' },
    ],
  },
  {
    titulo: 'Inteligência de ameaças',
    itens: [
      { to: '/ameacas', icone: 'pi-exclamation-triangle', nome: 'Ameaças (KEV)', desc: 'Vulnerabilidades exploradas ativamente, cruzadas com o inventário.' },
      { to: '/attack', icone: 'pi-table', nome: 'Matriz ATT&CK', desc: 'Táticas e técnicas, com cobertura de detecção.' },
      { to: '/artefatos', icone: 'pi-folder-open', nome: 'Biblioteca de artefatos', desc: 'Amostras e evidências preservadas.' },
    ],
  },
  {
    titulo: 'Método e operação',
    itens: [
      { to: '/metodologia', icone: 'pi-compass', nome: 'Metodologia de pentest', desc: 'Ciclo de 7 fases ligado ao ATT&CK, com checklist e cuidados.' },
      { to: '/ferramentas', icone: 'pi-wrench', nome: 'Arsenal de ferramentas', desc: 'Catálogo de ferramentas por fase do teste.' },
      { to: '/ambiente', icone: 'pi-server', nome: 'Meu ambiente', desc: 'Inventário de ativos e serviços.' },
      { to: '/range', icone: 'pi-bullseye', nome: 'Range vulnerável', desc: 'Alvos de laboratório para validar técnicas com segurança.' },
    ],
  },
] as const;

export function Central() {
  const navigate = useNavigate();
  const historico = useMemo(() => listarHistorico(), []);
  const ultimos = historico.slice(0, 5);
  const totais = useMemo(() => contarSeveridade(historico.flatMap((r) => r.achados)), [historico]);

  return (
    <div>
      <PageHeader title="Central de segurança"
        subtitle="Testes, detecção, inteligência e método em um só lugar. Uso restrito a alvos autorizados."
        actions={<Button label="Como usar" icon="pi pi-question-circle" outlined size="small" onClick={() => navigate({ to: '/ajuda' })} />} />

      <div className="iv-kpis iv-mt">
        <Kpi label="Varreduras registradas" icon="pi-bolt" value={historico.length} hint="neste navegador" />
        <Kpi label="Achados altos" icon="pi-exclamation-triangle" tone={totais.alta ? 'danger' : undefined} value={totais.alta} />
        <Kpi label="Achados médios" icon="pi-flag" tone={totais.media ? 'warning' : undefined} value={totais.media} />
        <Kpi label="Baixos / info" icon="pi-info-circle" value={totais.baixa + totais.info} />
      </div>

      {GRUPOS.map((g) => (
        <section key={g.titulo} className="iv-mt" aria-labelledby={`grp-${g.titulo}`}>
          <h2 id={`grp-${g.titulo}`} className="iv-section-label">{g.titulo}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {g.itens.map((it) => (
              <ClickCard key={it.to} label={`Abrir ${it.nome}`} onOpen={() => navigate({ to: it.to })}>
                <div className="iv-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                  <i className={`pi ${it.icone}`} aria-hidden="true" />
                  <strong>{it.nome}</strong>
                </div>
                <p className="iv-muted" style={{ margin: '0.4rem 0 0' }}>{it.desc}</p>
              </ClickCard>
            ))}
          </div>
        </section>
      ))}

      <section className="iv-card iv-mt" aria-labelledby="ult-scans">
        <h2 id="ult-scans" className="iv-section-label">Últimas varreduras</h2>
        {ultimos.length === 0 ? (
          <EmptyState icon="pi-bolt" title="Nenhuma varredura ainda" text="Rode um teste no Scanner de endpoints." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {ultimos.map((r) => {
              const c = contarSeveridade(r.achados);
              return (
                <li key={r.id} style={{ marginBottom: '0.3rem' }}>
                  <span style={{ wordBreak: 'break-all' }}>{r.url}</span>{' '}
                  {c.alta > 0 && <Pill tone="danger" label={`${c.alta} alto(s)`} />}{' '}
                  {c.media > 0 && <Pill tone="warning" label={`${c.media} médio(s)`} />}{' '}
                  <span className="iv-muted">· {new Date(r.em).toLocaleString('pt-BR')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
