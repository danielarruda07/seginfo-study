import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip, Pill, StatusStrip } from '@/components/InfraKit';
import {
  ARTEX_RESUMO, ARTEX_SINAIS, ARTEX_MARCADORES, ARTEX_FONTES,
  CAMADA_ARTEX, CONFIANCA_ARTEX, type SinalArtex, type CamadaArtex,
} from '@/data/ameacaArtex';
import { getTecnica } from '@/data/attack';
import { ComoUsar } from '@/components/ComoUsar';

const CAMADAS: CamadaArtex[] = ['comportamento', 'web', 'identidade', 'host', 'nuvem'];

function SinalCard({ s }: { s: SinalArtex }) {
  const conf = CONFIANCA_ARTEX[s.confianca];
  return (
    <li className="iv-card" style={{ marginBottom: '0.6rem' }}>
      <div className="iv-row iv-wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <strong>{s.titulo}</strong>
        <Pill tone={conf.tone} label={conf.label} />
      </div>
      <p className="iv-muted" style={{ marginTop: '0.35rem' }}>{s.descricao}</p>
      <p style={{ marginTop: '0.35rem' }}><strong>Como caçar:</strong> {s.comoCacar}</p>
      {s.mitreIds.length > 0 && (
        <p className="iv-muted" style={{ margin: 0 }}>
          ATT&CK:{' '}
          {s.mitreIds.map((id) => {
            const t = getTecnica(id);
            return <Chip key={id} label={t ? `${t.nome} (${id})` : id} />;
          })}
        </p>
      )}
    </li>
  );
}

export function ArtexCaca() {
  const [camada, setCamada] = useState<CamadaArtex | null>(null);
  const sinais = useMemo(() => (camada ? ARTEX_SINAIS.filter((s) => s.camada === camada) : ARTEX_SINAIS), [camada]);

  return (
    <div>
      <PageHeader title="Caça ao ARTEX (agêntico)"
        subtitle="Como detectar e caçar o uso do framework ofensivo agêntico ARTEX contra um alvo, mapeado à Matriz ATT&CK. Material defensivo — o framework não é embutido." />

      <StatusStrip tone="crit" icon="pi-compass">
        <strong>Cace por comportamento, não por IOC.</strong> Operadores trocam IP e User-Agent. Os marcadores no fim
        servem para busca retroativa com janela de tempo, nunca como blocklist viva.
      </StatusStrip>

      <div className="iv-card iv-mt">
        <p>{ARTEX_RESUMO}</p>
        <p className="iv-muted" style={{ margin: 0 }}>
          Veja também a <Link to="/attack" className="attack-link">Matriz ATT&CK</Link> e o{' '}
          <Link to="/scanner" className="attack-link">Scanner de endpoints</Link> (lado ofensivo seguro).
        </p>
      </div>

      <div className="iv-row iv-wrap iv-mt" style={{ gap: '0.4rem' }}>
        <Chip label="Todas as camadas" active={camada === null} onClick={() => setCamada(null)} />
        {CAMADAS.map((c) => (
          <Chip key={c} label={CAMADA_ARTEX[c].label} icon={CAMADA_ARTEX[c].icone} active={camada === c} onClick={() => setCamada(c)} />
        ))}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.8rem' }}>
        {sinais.map((s) => <SinalCard key={s.id} s={s} />)}
      </ul>

      <div className="iv-card iv-mt">
        <h2 className="iv-section-label">Marcadores (indícios — confirmar)</h2>
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          Fontes divergem sobre vários destes. Trate como ponto de partida para caça, não como prova.
        </StatusStrip>
        <ul>
          {ARTEX_MARCADORES.map((m) => (
            <li key={m.valor} style={{ marginBottom: '0.3rem' }}>
              <Pill tone="muted" label={m.tipo} /> <code>{m.valor}</code>
              <div className="iv-muted">{m.nota}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="iv-card iv-mt">
        <h2 className="iv-section-label">Fontes</h2>
        <ul>
          {ARTEX_FONTES.map((f) => (
            <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer noopener" className="attack-link">{f.nome}</a></li>
          ))}
        </ul>
      </div>
      <ComoUsar rota="/artex" />
    </div>
  );
}
