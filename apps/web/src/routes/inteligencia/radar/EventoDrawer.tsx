import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getTecnica } from '@/data/attack';
import type { RadarEvento } from '@/services/radar';
import { ExtLink } from '../ExtLink';
import { FONTE_LABEL, MITRE_POR_ACAO, acaoMeta, formatarUtc } from '../regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de um evento do Radar: o que aconteceu, origem/alvo, técnica ATT&CK e próximos passos. */
export function EventoDrawer({ ev, nav, onFiltrarIp }: { ev: RadarEvento; nav: Nav; onFiltrarIp: (ip: string) => void }) {
  const meta = acaoMeta(ev.acao);
  const tecnica = MITRE_POR_ACAO[ev.acao] ? getTecnica(MITRE_POR_ACAO[ev.acao]) : undefined;
  const servico = ev.servico ? `${ev.servico}${ev.portaDestino ? `:${ev.portaDestino}` : ''}` : ev.portaDestino ? `porta ${ev.portaDestino}` : '';

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha do evento ${meta.label} de ${ev.ipOrigem ?? 'origem desconhecida'}`}
      kind={{ icon: 'pi-eye', label: 'Evento do Radar' }}
      status={<><Pill label={meta.label} tone={meta.tone} icon={meta.icon} /><Pill label={FONTE_LABEL[ev.fonte] ?? ev.fonte} /></>}
      title={<>{meta.label}{servico && <> em <span className="mono">{servico}</span></>}</>}
      subtitle={<span className="tabular">{formatarUtc(ev.ocorridoEm)} UTC</span>}
      actions={ev.ipOrigem ? <>
        <Button label="Ver todos deste IP" icon="pi pi-filter" onClick={() => onFiltrarIp(ev.ipOrigem!)} />
        <Button label="Copiar IP" icon="pi pi-copy" outlined onClick={() => copyToClipboard(ev.ipOrigem!)} />
      </> : undefined}
    >
      <section>
        <h3 className="iv-section-label">O que fazer</h3>
        <p className="in-prose">{meta.dica}</p>
      </section>

      <section>
        <h3 className="iv-section-label">Origem e alvo</h3>
        <DetailFields items={[
          ['IP de origem', ev.ipOrigem ? <span className="mono">{ev.ipOrigem}</span> : ev.acao === 'lockout' ? 'Não informado (o bloqueio de conta do Windows não traz IP)' : ''],
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

      {tecnica && (
        <section>
          <h3 className="iv-section-label">Técnica ATT&amp;CK</h3>
          <DetailFields items={[
            ['Técnica', <><span className="mono">{tecnica.id}</span> · {tecnica.nome}</>],
            ['Sua cobertura', <Link to="/attack">Ver na Matriz ATT&amp;CK</Link>],
            ['Referência', <ExtLink href={`https://attack.mitre.org/techniques/${tecnica.id}/`}>Ficha no MITRE</ExtLink>],
          ]} />
        </section>
      )}

      {ev.ipOrigem && (
        <section>
          <h3 className="iv-section-label">Investigar a origem</h3>
          <p className="in-prose">Consultas externas enviam o IP a terceiros; use só para IPs de atacantes, nunca da sua rede.</p>
          <div className="iv-row iv-wrap">
            <ExtLink href={`https://www.abuseipdb.com/check/${encodeURIComponent(ev.ipOrigem)}`}>Reputação no AbuseIPDB</ExtLink>
            <ExtLink href={`https://rdap.org/ip/${encodeURIComponent(ev.ipOrigem)}`}>Dono do bloco (RDAP)</ExtLink>
          </div>
        </section>
      )}
    </DetailDrawer>
  );
}
