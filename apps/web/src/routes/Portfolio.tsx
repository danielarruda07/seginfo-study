import { useMemo, type ReactNode } from 'react';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listTrilhas, getStatusMap, listTopicos } from '@/services/catalog';
import { listLabs, getProgressoLab } from '@/services/inventario';
import { DOMINIO_LAB } from '@/theme/status';
import { montarPortfolio, NIVEL_LABEL } from './portfolio/regras';
import { PortfolioDrawer } from './portfolio/PortfolioDrawer';
import '@/styles/telas/carreira.css';

export function Portfolio() {
  const p = useMemo(() => montarPortfolio({
    trilhas: listTrilhas(), topicos: listTopicos({ rows: 10_000 }).items, status: getStatusMap(), labs: listLabs(), progressoLab: getProgressoLab,
  }), []);
  const sel = useDrawerSelection(p.todos);

  return (
    <main className="portfolio-page">
      <div className="portfolio-toolbar ca-toolbar">
        <PageHeader title="Portfólio de estudos" subtitle="Resumo compartilhável das trilhas e práticas concluídas. Não inclui dados do inventário." />
        <Button label="Imprimir / Salvar PDF" icon="pi pi-print" onClick={() => window.print()} />
      </div>
      <section className="portfolio-cover">
        <span>SEGINFO STUDY</span>
        <h1>Portfólio de aprendizagem</h1>
        <p>Daniel Arruda · Segurança da Informação</p>
        <small>Gerado em {new Date().toLocaleDateString('pt-BR')} · {p.trilhas.length} trilhas, {p.labs.length} labs e {p.topicos.length} tópicos concluídos</small>
      </section>

      <Secao titulo="Trilhas concluídas" vazio="Nenhuma trilha concluída integralmente até agora.">
        {p.trilhas.map((t) => (
          <ClickCard key={t.id} onOpen={() => sel.open(t.id)} selected={sel.isOpen(t.id)} label={`Abrir trilha ${t.trilha.titulo}`}>
            <strong>{t.trilha.titulo}</strong>
            <p className="iv-muted ca-small ca-clamp-2 ca-mb0">{t.topicos.length} tópicos · {t.trilha.descricao}</p>
          </ClickCard>
        ))}
      </Secao>

      <Secao titulo="Labs concluídos" vazio="Nenhum lab concluído registrado.">
        {p.labs.map(({ id, lab, progresso }) => (
          <ClickCard key={id} onOpen={() => sel.open(id)} selected={sel.isOpen(id)} label={`Abrir lab ${lab.titulo}`}>
            <div className="ca-post__meta">
              <strong className="ca-flex1">{lab.titulo}</strong>
              <Pill label={DOMINIO_LAB[lab.dominio].label} color={DOMINIO_LAB[lab.dominio].color} />
            </div>
            {progresso.concluidoEm && <div className="iv-muted ca-small">Concluído em {progresso.concluidoEm}</div>}
            {progresso.aprendizado && <p className="ca-small ca-clamp-3 ca-mb0">{progresso.aprendizado}</p>}
          </ClickCard>
        ))}
      </Secao>

      <Secao titulo="Tópicos concluídos" vazio="Nenhum tópico concluído ainda." compacta>
        {p.topicos.map(({ id, topico, trilha }) => (
          <ClickCard key={id} onOpen={() => sel.open(id)} selected={sel.isOpen(id)} label={`Abrir tópico ${topico.titulo}`} className="ca-port-topico">
            <strong className="ca-small">{topico.titulo}</strong>
            <div className="iv-muted ca-mini">{trilha?.titulo ?? ''} · {NIVEL_LABEL[topico.nivel]}</div>
          </ClickCard>
        ))}
      </Secao>

      <p className="portfolio-note">Este portfólio reflete progresso de estudo registrado no aplicativo; não declara certificações obtidas.</p>
      {sel.item && <PortfolioDrawer item={sel.item} nav={sel.nav} />}
    </main>
  );
}

function Secao({ titulo, vazio, compacta, children }: { titulo: string; vazio: string; compacta?: boolean; children: ReactNode[] }) {
  return (
    <section className="iv-card iv-mt ca-port-secao">
      <h2 className="ca-port-titulo">{titulo} <span className="iv-muted">({children.length})</span></h2>
      {children.length ? <div className={compacta ? 'ca-port-grid ca-port-grid--compacta' : 'ca-port-grid'}>{children}</div> : <p className="iv-muted ca-mb0">{vazio}</p>}
    </section>
  );
}
