import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, Pill, StatusStrip, EmptyState } from '@/components/InfraKit';
import {
  escanearEndpoint, listarHistorico, removerDoHistorico, contarSeveridade,
  type ScanRelatorio, type Severidade,
} from '@/services/scanner';

const TOM: Record<Severidade, 'danger' | 'warning' | 'info' | 'muted'> = {
  alta: 'danger', media: 'warning', baixa: 'info', info: 'muted',
};
const SEV_LABEL: Record<Severidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa', info: 'Info' };

function Relatorio({ r }: { r: ScanRelatorio }) {
  const c = contarSeveridade(r.achados);
  return (
    <div className="iv-card iv-mt">
      <div className="iv-row iv-wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <h2 className="iv-section-label" style={{ margin: 0 }}>{r.url}</h2>
        <Pill tone={r.escopo === 'interno' ? 'warning' : r.escopo === 'externo' ? 'info' : 'muted'}
          label={`Escopo: ${r.escopo}${r.ipResolvido ? ` (${r.ipResolvido})` : ''}`} />
        {r.status != null && <Pill label={`HTTP ${r.status}`} />}
        <Pill tone={r.autenticacao === 'exigida' ? 'ok' : r.autenticacao === 'aberta' ? 'warning' : 'muted'}
          label={`Auth: ${r.autenticacao}`} />
      </div>

      {!r.alcancavel && <StatusStrip tone="warn" icon="pi-exclamation-triangle">Não foi possível alcançar o alvo: {r.erro ?? 'sem resposta'}.</StatusStrip>}

      <div className="iv-kpis iv-mt">
        <Kpi label="Achados altos" icon="pi-exclamation-triangle" tone={c.alta ? 'danger' : undefined} value={c.alta} />
        <Kpi label="Médios" icon="pi-flag" tone={c.media ? 'warning' : undefined} value={c.media} />
        <Kpi label="Baixos/Info" icon="pi-info-circle" value={c.baixa + c.info} />
        <Kpi label="Tempo" icon="pi-clock" value={r.tempoMs != null ? `${r.tempoMs} ms` : '—'} hint={r.servidor ?? ''} />
      </div>

      {r.achados.length > 0 && (
        <>
          <h3 className="iv-section-label">Achados</h3>
          <ul>
            {r.achados.map((a) => (
              <li key={a.id} style={{ marginBottom: '0.4rem' }}>
                <Pill tone={TOM[a.severidade]} label={SEV_LABEL[a.severidade]} /> <strong>{a.titulo}</strong>
                <div className="iv-muted">{a.detalhe}{a.recomendacao ? ` — ${a.recomendacao}` : ''}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="iv-row iv-wrap" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
        {r.tls && (
          <div style={{ flex: '1 1 240px' }}>
            <h3 className="iv-section-label">TLS</h3>
            <ul className="iv-muted">
              <li>Protocolo: {r.tls.protocolo ?? '?'}</li>
              <li>Emissor: {r.tls.emissor}</li>
              <li>Válido até: {r.tls.validoAte ?? '?'} {r.tls.diasRestantes != null && `(${r.tls.diasRestantes} dias)`}</li>
              <li>Cadeia: {r.tls.cadeiaConfiavel ? 'confiável' : `NÃO confiável${r.tls.erroCadeia ? ` (${r.tls.erroCadeia})` : ''}`}</li>
            </ul>
          </div>
        )}
        <div style={{ flex: '1 1 240px' }}>
          <h3 className="iv-section-label">Cabeçalhos de segurança</h3>
          <ul>
            {r.cabecalhos.map((h) => (
              <li key={h.nome} className={h.presente ? '' : 'iv-muted'}>
                <i className={`pi ${h.presente ? 'pi-check' : 'pi-times'}`} aria-hidden="true" /> {h.nome}
                {!h.presente && <span className="iv-muted"> — falta: {h.dica}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {r.metodos && r.metodos.permitidos.length > 0 && (
        <p className="iv-muted">Métodos (OPTIONS): {r.metodos.permitidos.join(', ')}{r.metodos.arriscados.length ? ` · sensíveis: ${r.metodos.arriscados.join(', ')}` : ''}</p>
      )}
      {r.exposicoes.length > 0 && (
        <p className="iv-muted">Exposições sondadas: {r.exposicoes.map((e) => `${e.caminho} (${e.status}${e.acessivel ? ', acessível' : ''})`).join(' · ')}</p>
      )}
      {r.redirects.length > 0 && (
        <p className="iv-muted">Redirecionamentos: {r.redirects.map((x) => `${x.status}→${x.para}`).join(' · ')}</p>
      )}
    </div>
  );
}

export function Scanner() {
  const [url, setUrl] = useState('');
  const [exposicoes, setExposicoes] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<ScanRelatorio | null>(null);
  const [hist, setHist] = useState(listarHistorico());

  async function rodar() {
    const alvo = url.trim();
    if (!alvo) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await escanearEndpoint(alvo, exposicoes);
      setAtual(r);
      setHist(listarHistorico());
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string });
      setErro(msg.response?.data?.error ?? msg.message ?? 'Falha no scan. O scanner precisa do servidor (homelab); em modo local ele não roda.');
    } finally {
      setCarregando(false);
    }
  }

  function remover(id: string) {
    removerDoHistorico(id);
    setHist(listarHistorico());
  }

  return (
    <div>
      <PageHeader title="Scanner de endpoints"
        subtitle="Checagem de higiene de URLs de API e endpoints publicados (internos e externos): TLS, cabeçalhos, métodos, exposições comuns e autenticação. Não destrutivo — só GET/HEAD/OPTIONS." />

      <StatusStrip tone="crit" icon="pi-shield">
        <strong>Uso autorizado apenas.</strong> Escaneie somente alvos que você tem autorização por escrito para testar
        (seus sistemas ou os do cliente, dentro do escopo). O scanner roda no servidor do homelab, atrás do seu Access.
      </StatusStrip>

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap" style={{ gap: '0.75rem', alignItems: 'center' }}>
          <span className="p-input-icon-left" style={{ flex: '1 1 320px' }}>
            <i className="pi pi-link" />
            <InputText value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.exemplo.com/v1/health"
              style={{ width: '100%' }} onKeyDown={(e) => e.key === 'Enter' && rodar()} aria-label="URL do endpoint" />
          </span>
          <label className="iv-row" style={{ gap: '0.4rem', alignItems: 'center' }}>
            <Checkbox checked={exposicoes} onChange={(e) => setExposicoes(!!e.checked)} />
            <span>Sondar exposições comuns (.git, .env, swagger…)</span>
          </label>
          <Button label={carregando ? 'Escaneando…' : 'Escanear'} icon="pi pi-bolt" onClick={rodar} disabled={carregando || !url.trim()} />
        </div>
        {erro && <StatusStrip tone="warn" icon="pi-exclamation-triangle">{erro}</StatusStrip>}
      </div>

      {atual && <Relatorio r={atual} />}

      <div className="iv-card iv-mt">
        <h2 className="iv-section-label">Histórico (local)</h2>
        {hist.length === 0 ? (
          <EmptyState icon="pi-history" title="Nenhum scan ainda" text="Os scans ficam só neste navegador." />
        ) : (
          <ul>
            {hist.map((r) => {
              const c = contarSeveridade(r.achados);
              return (
                <li key={r.id} style={{ marginBottom: '0.3rem' }}>
                  <button type="button" className="attack-link" onClick={() => setAtual(r)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit', textDecoration: 'underline' }}>
                    {r.url}
                  </button>{' '}
                  <span className="iv-muted">· {new Date(r.em).toLocaleString('pt-BR')} · {c.alta} alto(s), {c.media} médio(s) · {r.escopo}</span>{' '}
                  <Button icon="pi pi-trash" text rounded aria-label="Remover do histórico" onClick={() => remover(r.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
