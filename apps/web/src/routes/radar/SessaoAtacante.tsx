import { useQuery } from '@tanstack/react-query';
import { Message } from 'primereact/message';
import { DetailSection } from '@/components/ui/Detail';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { getRadarSessao, type RadarEvento } from '@/services/radar';
import { useAmbiente } from '@/services/ambiente';
import { ETAPA, duracaoTexto, etapaDoComando, resumirSessao } from './sessao';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const str = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === 'string' ? (d[k] as string) : null);

/** Uma linha da linha do tempo: o que aconteceu naquele segundo. */
function Passo({ e }: { e: RadarEvento }) {
  const d = e.detalhes;
  let rotulo: string; let cor: string; let texto: string | null = null; let dica: string | null = null;
  switch (e.acao) {
    case 'conexao': rotulo = 'conectou'; cor = '#64748b'; break;
    case 'login_falha': rotulo = 'senha errada'; cor = '#f59e0b'; texto = e.usuarioTentado; break;
    case 'login_ok': rotulo = 'entrou'; cor = '#dc2626'; texto = e.usuarioTentado; break;
    case 'download': rotulo = 'arquivo'; cor = '#b91c1c'; texto = str(d, 'url'); break;
    case 'tunel': rotulo = 'túnel'; cor = '#0f766e'; texto = str(d, 'destino'); dica = 'Tentou usar o SSH como proxy para a internet (testar saída ou esconder a origem).'; break;
    case 'comando': {
      texto = str(d, 'comando');
      const et = ETAPA[etapaDoComando(texto ?? '')];
      rotulo = et.rotulo; cor = et.cor; dica = et.dica || null;
      break;
    }
    default: rotulo = e.acao.replace('_', ' '); cor = '#94a3b8';
  }
  return (
    <li className="sessao-passo">
      <span className="sessao-hora">{hora(e.ocorridoEm)}</span>
      <span title={dica ?? undefined}><Pill label={rotulo} color={cor} /></span>
      {texto && <code className="sessao-texto">{texto}</code>}
    </li>
  );
}

/**
 * História da sessão de um atacante no honeypot: do primeiro contato ao último comando,
 * com o resumo do que ele tentou e cada comando classificado pela intenção.
 */
export function SessaoAtacante({ sessao, ip }: { sessao: string; ip: string }) {
  const [ambiente] = useAmbiente();
  const q = useQuery({ queryKey: ['radar-sessao', sessao, ip, ambiente], queryFn: () => getRadarSessao(sessao, ip) });
  if (q.isLoading) return <DetailSection title="Sessão do atacante"><p className="iv-muted">Carregando a sessão…</p></DetailSection>;
  if (q.isError) return <Message severity="warn" text="Não foi possível carregar a sessão." />;
  const itens = q.data?.items ?? [];
  if (itens.length === 0) return null;
  const r = resumirSessao(itens);

  return (
    <>
      <DetailSection title="O que ele fez nesta sessão">
        <ul className="sessao-resumo">
          <li><strong>{duracaoTexto(r.duracaoSeg)}</strong> conectado · {r.tentativasLogin} tentativa(s) de senha
            {r.loginAceito ? <> · entrou como <strong>{r.loginAceito.usuario ?? '?'}</strong></> : ' · não entrou'}</li>
          {r.comandos > 0 && <li><strong>{r.comandos}</strong> comando(s) executado(s)</li>}
          {r.arquivos.length > 0 && <li><strong>{r.arquivos.length}</strong> arquivo(s) enviado(s) ou baixado(s)</li>}
          {r.tuneis.length > 0 && <li>tentou túnel para <code>{r.tuneis.join(', ')}</code></li>}
        </ul>
        {r.etapas.length > 0 && (
          <p className="iv-row iv-wrap" style={{ gap: 6, margin: '.4rem 0 0' }}>
            {r.etapas.map((et, i) => (
              <span key={et} title={ETAPA[et].dica}>{i > 0 && <span className="iv-muted" aria-hidden="true">→ </span>}<Pill label={ETAPA[et].rotulo} color={ETAPA[et].cor} /></span>
            ))}
          </p>
        )}
      </DetailSection>

      {r.arquivos.length > 0 && (
        <DetailSection title="Arquivos (o malware)">
          {r.arquivos.map((a, i) => (
            <div key={`${a.nome}${i}`} style={{ marginBottom: '.5rem' }}>
              <code style={{ wordBreak: 'break-all' }}>{a.nome}</code>
              {a.sha256 && <div style={{ fontSize: '.8rem' }}>
                SHA-256 <code style={{ wordBreak: 'break-all' }}>{a.sha256}</code>{' '}
                <a href={`https://www.virustotal.com/gui/file/${a.sha256}`} target="_blank" rel="noreferrer noopener">ver no VirusTotal</a>
              </div>}
            </div>
          ))}
          <p className="iv-muted" style={{ fontSize: '.8rem', margin: 0 }}>
            O link só consulta o hash; o arquivo não sai do honeypot. Se o VirusTotal não conhecer o hash, é amostra nova.
          </p>
        </DetailSection>
      )}

      <DetailSection title={`Linha do tempo (${itens.length} eventos)`}>
        {q.data?.truncado && <StatusStrip tone="warn" icon="pi-info-circle">Sessão longa: mostrando os primeiros {itens.length} eventos.</StatusStrip>}
        <ol className="sessao-lista">
          {itens.map((e) => <Passo key={e.id} e={e} />)}
        </ol>
        <p className="iv-muted" style={{ fontSize: '.8rem', margin: '.4rem 0 0' }}>Passe o mouse no rótulo para ver o que aquela etapa significa.</p>
      </DetailSection>
    </>
  );
}
