import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getGreynoise, getRadarEventos, type RadarEventosFiltro } from '@/services/radar';
import { EXPLICACAO_GREYNOISE, SeloGreynoise } from './Greynoise';
import { ExtLink } from '../ExtLink';
import { acaoMeta, formatarUtc } from '../regras';
import type { TopItem } from './TopList';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;
export type Dimensao = 'ip' | 'servico' | 'usuario' | 'pais';

const META: Record<Dimensao, { icon: string; tipo: string; filtro: string; dica: string }> = {
  ip: { icon: 'pi-globe', tipo: 'IP de origem', filtro: 'Filtrar eventos por este IP',
    dica: 'Muitos eventos do mesmo IP indicam automação. Se ele aparece em serviços reais (não só honeypot), bloqueie no firewall e confira se algum login foi aceito.' },
  servico: { icon: 'pi-server', tipo: 'Serviço visado', filtro: 'Filtrar eventos por este serviço',
    dica: 'Confirme se este serviço precisa mesmo estar exposto. Se sim, restrinja origem, exija MFA e limite tentativas.' },
  usuario: { icon: 'pi-user', tipo: 'Usuário tentado', filtro: 'Buscar eventos com este usuário',
    dica: 'Se o usuário existe de verdade no seu ambiente, use senha forte e única, MFA e considere renomear contas padrão.' },
  pais: { icon: 'pi-flag', tipo: 'País de origem', filtro: 'Filtrar eventos deste país',
    dica: 'País de origem diz pouco sobre o atacante (VPN e proxies). Use para priorizar, não como prova; geobloqueio ajuda a reduzir ruído.' },
};

const filtroDe = (dim: Dimensao, valor: string): Partial<RadarEventosFiltro> =>
  dim === 'usuario' ? { q: valor } : { [dim]: valor };

/** Ficha de um indicador do Radar (IP, serviço, usuário ou país) com os eventos mais recentes dele. */
export function IndicadorDrawer({ dim, item, totalPeriodo, periodo, nav, onFiltrar }: {
  dim: Dimensao; item: TopItem; totalPeriodo: number; periodo: string; nav: Nav; onFiltrar: (dim: Dimensao, valor: string) => void;
}) {
  const m = META[dim];
  const recentes = useQuery({
    queryKey: ['radar-eventos', 'indicador', dim, item.rotulo],
    queryFn: () => getRadarEventos({ ...filtroDe(dim, item.rotulo), page: 0, limit: 8 }),
  });
  const gn = useMutation({ mutationFn: getGreynoise });
  const pct = totalPeriodo ? Math.round((item.total / totalPeriodo) * 100) : 0;

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha de ${m.tipo} ${item.rotulo}`} kind={{ icon: m.icon, label: m.tipo }}
      title={<span className={dim === 'pais' ? undefined : 'mono'}>{item.rotulo}</span>}
      subtitle={`${item.total} evento(s) em ${periodo} · ${pct}% do total${item.extra ? ` · ${item.extra}` : ''}`}
      actions={<>
        <Button label={m.filtro} icon="pi pi-filter" onClick={() => onFiltrar(dim, item.rotulo)} />
        {dim === 'ip' && <Button label="Copiar IP" icon="pi pi-copy" outlined onClick={() => copyToClipboard(item.rotulo)} />}
      </>}
    >
      <section>
        <h3 className="iv-section-label">O que fazer</h3>
        <p className="in-prose">{m.dica}</p>
      </section>

      <section>
        <h3 className="iv-section-label">Eventos mais recentes</h3>
        {recentes.isLoading && <p className="in-muted-p">Carregando…</p>}
        {recentes.isError && <p className="in-muted-p">Não foi possível carregar os eventos agora.</p>}
        {recentes.data && recentes.data.items.length === 0 && <p className="in-muted-p">Nenhum evento encontrado.</p>}
        {recentes.data && recentes.data.items.length > 0 && (
          <ul className="in-list">
            {recentes.data.items.map((e) => {
              const a = acaoMeta(e.acao);
              return (
                <li key={e.id} className="in-evento">
                  <span className="tabular iv-muted">{formatarUtc(e.ocorridoEm)}</span>
                  <Pill label={a.label} tone={a.tone} icon={a.icon} />
                  <span className="mono">{dim === 'ip' ? (e.servico ?? e.portaDestino ?? '—') : (e.ipOrigem ?? '—')}</span>
                  {e.usuarioTentado && dim !== 'usuario' && <span className="iv-muted">usuário <span className="mono">{e.usuarioTentado}</span></span>}
                </li>
              );
            })}
          </ul>
        )}
        {recentes.data && recentes.data.total > recentes.data.items.length && (
          <p className="in-muted-p">Mostrando {recentes.data.items.length} de {recentes.data.total}. Use “{m.filtro}” para ver todos na tabela.</p>
        )}
      </section>

      {dim === 'ip' && (
        <section>
          <h3 className="iv-section-label">Investigar a origem</h3>
          <p className="in-prose">Consultas externas enviam o IP a terceiros; use só para IPs de atacantes, nunca da sua rede.</p>
          <div className="iv-row iv-wrap">
            <ExtLink href={`https://www.abuseipdb.com/check/${encodeURIComponent(item.rotulo)}`}>Reputação no AbuseIPDB</ExtLink>
            <ExtLink href={`https://rdap.org/ip/${encodeURIComponent(item.rotulo)}`}>Dono do bloco (RDAP)</ExtLink>
            <ExtLink href={`https://viz.greynoise.io/ip/${encodeURIComponent(item.rotulo)}`}>GreyNoise</ExtLink>
          </div>
          <p className="in-prose iv-mt">{EXPLICACAO_GREYNOISE}</p>
          <div className="iv-row iv-wrap">
            <Button label="Classificar com GreyNoise" icon="pi pi-filter" size="small" outlined loading={gn.isPending}
              disabled={gn.data?.ip === item.rotulo} onClick={() => gn.mutate(item.rotulo)} />
            {gn.data?.ip === item.rotulo && <SeloGreynoise c={gn.data} />}
            {gn.isError && <span className="iv-muted">GreyNoise indisponível (IP privado ou sem resposta).</span>}
          </div>
        </section>
      )}
    </DetailDrawer>
  );
}
