import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getTecnica } from '@/data/attack';
import type { RadarEvento } from '@/services/radar';
import { ExtLink } from '../ExtLink';
import { SessaoAtacante } from '../../radar/SessaoAtacante';
import { FONTE_LABEL, FONTES_ISCA, MITRE_POR_ACAO, acaoDoEvento, formatarLocal, formatarUtc } from '../regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Técnicas que o coletor já trouxe (ex.: regra do Wazuh); senão, o mapeamento fixo por ação. */
function tecnicasDoEvento(ev: RadarEvento): { id: string; nome: string }[] {
  const d = ev.detalhes ?? {};
  const doColetor = Array.isArray(d.mitre)
    ? (d.mitre as { id?: unknown; nome?: unknown }[]).filter((m) => typeof m?.id === 'string')
      .map((m) => ({ id: String(m.id), nome: typeof m.nome === 'string' ? m.nome : getTecnica(String(m.id))?.nome ?? '' }))
    : [];
  if (doColetor.length) return doColetor;
  const t = MITRE_POR_ACAO[ev.acao] ? getTecnica(MITRE_POR_ACAO[ev.acao]) : undefined;
  return t ? [{ id: t.id, nome: t.nome }] : [];
}

/** Ficha de um evento do Radar: o que aconteceu, origem/alvo, técnica ATT&CK e próximos passos. */
export function EventoDrawer({ ev, nav, onFiltrarIp }: { ev: RadarEvento; nav: Nav; onFiltrarIp: (ip: string) => void }) {
  const meta = acaoDoEvento(ev);
  const tecnicas = tecnicasDoEvento(ev);
  const d = ev.detalhes ?? {};
  const txt = (k: string) => (typeof d[k] === 'string' || typeof d[k] === 'number' ? String(d[k]) : '');
  const isca = FONTES_ISCA.has(ev.fonte);
  const servico = ev.servico ? `${ev.servico}${ev.portaDestino ? `:${ev.portaDestino}` : ''}` : ev.portaDestino ? `porta ${ev.portaDestino}` : '';

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha do evento ${meta.label} de ${ev.ipOrigem ?? 'origem desconhecida'}`}
      kind={{ icon: 'pi-eye', label: 'Evento do Radar' }}
      status={<><Pill label={meta.label} tone={meta.tone} icon={meta.icon} /><Pill label={FONTE_LABEL[ev.fonte] ?? ev.fonte} /></>}
      title={<>{meta.label}{servico && <> em <span className="mono">{servico}</span></>}</>}
      subtitle={<span className="tabular">{formatarLocal(ev.ocorridoEm)} <span className="iv-muted">({formatarUtc(ev.ocorridoEm)} UTC)</span></span>}
      actions={ev.ipOrigem ? <>
        <Button label="Ver todos deste IP" icon="pi pi-filter" onClick={() => onFiltrarIp(ev.ipOrigem!)} />
        <Button label="Copiar IP" icon="pi pi-copy" outlined onClick={() => copyToClipboard(ev.ipOrigem!)} />
      </> : undefined}
    >
      {ev.acao === 'reflexao' && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          Tentativa de usar o seu IP como <strong>refletor</strong> de DDoS. O endereço de origem é falsificado:
          é a <strong>vítima</strong> que o atacante queria atingir. O firewall registrou e descartou; nada respondeu.
        </StatusStrip>
      )}
      {isca && ev.acao === 'login_ok' && (
        <StatusStrip icon="pi-info-circle">
          Isca: o honeypot aceita a senha de propósito. No SSH, a sessão é repassada a um <strong>Linux real descartável</strong>,
          sem saída para a internet e restaurado periodicamente. O que vale aqui é ver o que o atacante faz depois de entrar.
        </StatusStrip>
      )}

      <section>
        <h3 className="iv-section-label">O que fazer</h3>
        <p className="in-prose">{meta.dica}</p>
      </section>

      {(txt('comando') || txt('url') || txt('regra')) && (
        <section>
          <h3 className="iv-section-label">O que o atacante fez</h3>
          <DetailFields items={[
            ['Comando', txt('comando') ? <span className="mono in-quebra">{txt('comando')}</span> : ''],
            ['URL / arquivo', txt('url') ? <span className="mono in-quebra">{txt('url')}</span> : ''],
            ['Regra do Wazuh', txt('regra') ? [txt('regra'), txt('nivel') && `nível ${txt('nivel')}`, txt('descricao')].filter(Boolean).join(' · ') : ''],
          ].filter(([, v]) => v !== '') as [string, ReactNode][]} />
        </section>
      )}

      <section>
        <h3 className="iv-section-label">Origem e alvo</h3>
        <DetailFields items={[
          ['IP de origem', ev.ipOrigem
            ? <><span className="mono">{ev.ipOrigem}</span>{ev.escopo === 'interno' && <span className="iv-muted"> · rede interna (range)</span>}{ev.acao === 'reflexao' && <span className="iv-muted"> · falsificado (vítima)</span>}</>
            : ev.acao === 'lockout' ? 'Não informado (o bloqueio de conta do Windows não traz IP)' : ''],
          ['País', ev.paisOrigem ?? ''],
          ['Alvo', ev.alvo ?? ''],
          ['Serviço', ev.servico ?? ''],
          ['Porta', ev.portaDestino ? <span className="tabular">{ev.portaDestino}</span> : ''],
          ['Protocolo', ev.protocolo ?? ''],
          ['Usuário tentado', ev.usuarioTentado ? <span className="mono">{ev.usuarioTentado}</span> : ''],
          ['Coletor', FONTE_LABEL[ev.fonte] ?? ev.fonte],
        ]} />
        <p className="in-muted-p">Senhas tentadas não aparecem nesta ficha.</p>
      </section>

      {tecnicas.length > 0 && (
        <section>
          <h3 className="iv-section-label">{tecnicas.length === 1 ? 'Técnica' : 'Técnicas'} ATT&amp;CK</h3>
          <ul className="in-lista-simples">
            {tecnicas.map((t) => (
              <li key={t.id}>
                <span className="mono">{t.id}</span> · {t.nome}{' '}
                <ExtLink href={`https://attack.mitre.org/techniques/${t.id.replace('.', '/')}/`}>Ficha no MITRE</ExtLink>
              </li>
            ))}
          </ul>
          <Link to="/attack">Ver a sua cobertura na Matriz ATT&amp;CK</Link>
        </section>
      )}

      {ev.ipOrigem && typeof d.sessao === 'string' && <SessaoAtacante sessao={d.sessao} ip={ev.ipOrigem} />}

      {ev.ipOrigem && ev.escopo !== 'interno' && (
        <section>
          <h3 className="iv-section-label">Investigar a origem</h3>
          {ev.acao === 'reflexao'
            ? <p className="in-prose">Este IP é o da <strong>vítima</strong> (origem falsificada): não o trate como atacante nem o bloqueie por reputação.</p>
            : <p className="in-prose">Consultas externas enviam o IP a terceiros; use só para IPs de atacantes, nunca da sua rede.</p>}
          {ev.acao !== 'reflexao' && (
            <div className="iv-row iv-wrap">
              <ExtLink href={`https://www.abuseipdb.com/check/${encodeURIComponent(ev.ipOrigem)}`}>Reputação no AbuseIPDB</ExtLink>
              <ExtLink href={`https://rdap.org/ip/${encodeURIComponent(ev.ipOrigem)}`}>Dono do bloco (RDAP)</ExtLink>
            </div>
          )}
        </section>
      )}
    </DetailDrawer>
  );
}
