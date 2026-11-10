import { PageHeader } from '@/components/ui/PageHeader';
import { listTrilhas, progressoPorTrilha, getStatusMap, getTopico } from '@/services/catalog';
import { listLabs, getProgressoLab, ESTADO_LAB_LABEL } from '@/services/inventario';
import { Button } from 'primereact/button';

export function Portfolio() {
  const trails = listTrilhas().map((t) => ({ ...t, progresso: progressoPorTrilha()[t.id] })).filter((t) => t.progresso.pct === 100 && t.progresso.total > 0);
  const labs = listLabs().map((lab) => ({ lab, progresso: getProgressoLab(lab.id) })).filter((x) => x.progresso.status === 'concluido');
  const concluido = Object.entries(getStatusMap()).filter(([, status]) => status === 'concluido').map(([id]) => getTopico(id)).filter(Boolean);
  return <main className="portfolio-page">
    <div className="portfolio-toolbar"><PageHeader title="Portfólio de estudos" subtitle="Resumo compartilhável das trilhas e práticas concluídas. Não inclui dados do inventário."/><Button label="Imprimir / Salvar PDF" icon="pi pi-print" onClick={() => window.print()} /></div>
    <section className="portfolio-cover"><span>SEGINFO STUDY</span><h1>Portfólio de aprendizagem</h1><p>Daniel Arruda · Segurança da Informação</p><small>Gerado em {new Date().toLocaleDateString('pt-BR')}</small></section>
    <section className="iv-card iv-mt"><h2>Trilhas concluídas</h2>{trails.length ? <ul>{trails.map((t) => <li key={t.id}><strong>{t.titulo}</strong> — {t.progresso.total} tópicos</li>)}</ul> : <p className="iv-muted">Nenhuma trilha concluída integralmente até agora.</p>}</section>
    <section className="iv-card iv-mt"><h2>Labs concluídos</h2>{labs.length ? <ul>{labs.map(({ lab, progresso }) => <li key={lab.id}><strong>{lab.titulo}</strong>{progresso.concluidoEm ? ` — ${progresso.concluidoEm}` : ''}{progresso.aprendizado && <p>{progresso.aprendizado}</p>}</li>)}</ul> : <p className="iv-muted">Nenhum lab concluído registrado.</p>}</section>
    <section className="iv-card iv-mt"><h2>Tópicos concluídos</h2>{concluido.length ? <p>{concluido.map((t) => t!.titulo).join(' · ')}</p> : <p className="iv-muted">Nenhum tópico concluído ainda.</p>}</section>
    <p className="portfolio-note">Este portfólio reflete progresso de estudo registrado no aplicativo; não declara certificações obtidas.</p>
  </main>;
}
