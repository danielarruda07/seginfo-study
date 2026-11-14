import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Bar } from '@/components/InfraKit';
import { getTrilha } from '@/services/catalog';
import { useBaseEstudo } from './dados';
import { ListaSessoes } from './Listas';
import { SessaoRapida } from './SessaoRapida';
import { formatarMinutos, resumoSessoes, sessoesDaSemana } from './regras';

/** Ficha "Esta semana" do painel: ritmo dos últimos 7 dias, meta semanal, tempo por trilha e registro rápido. */
export function SemanaDrawer({ metaHoras, onClose }: { metaHoras: number; onClose: () => void }) {
  const base = useBaseEstudo();
  const navigate = useNavigate();
  const semana = sessoesDaSemana(base.sessoes, base.hoje);
  const r = resumoSessoes(semana);
  const horas = r.minutos / 60;
  const pct = metaHoras > 0 ? Math.round((horas / metaHoras) * 100) : 0;
  const porTrilha = Object.entries(semana.reduce<Record<string, number>>((acc, s) => {
    const k = s.trilhaId ?? '';
    acc[k] = (acc[k] ?? 0) + s.minutos;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <DetailDrawer
      onClose={onClose}
      kind={{ icon: 'pi-calendar', label: 'Ritmo' }}
      ariaLabel="Ficha da semana de estudo"
      title="Últimos 7 dias"
      subtitle={r.quantidade ? `${formatarMinutos(r.minutos)} em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'} de estudo` : 'Nenhuma sessão registrada nos últimos 7 dias.'}
      actions={<Button label="Ver todas as sessões" icon="pi pi-list" outlined onClick={() => navigate({ to: '/sessoes' })} />}
    >
      <section>
        <h3 className="iv-section-label">Meta semanal</h3>
        {metaHoras > 0 ? (
          <>
            <div className="es-progress"><Bar pct={pct} tone={pct >= 100 ? 'ok' : undefined} /><strong className="tabular">{pct}%</strong></div>
            <DetailFields items={[
              ['Meta', `${metaHoras} h`],
              ['Feito', `${horas.toFixed(1)} h`],
              ['Falta', horas >= metaHoras ? 'Meta da semana alcançada' : `${(metaHoras - horas).toFixed(1)} h`],
            ]} />
          </>
        ) : <p className="es-empty-line">Defina a meta semanal no cartão “Esta semana” para acompanhar aqui.</p>}
      </section>

      <section>
        <h3 className="iv-section-label">Tempo por trilha</h3>
        {porTrilha.length === 0 ? <p className="es-empty-line">Sem sessões na semana.</p> : (
          <DetailFields items={porTrilha.map(([id, min]) => [getTrilha(id)?.titulo ?? 'Sem trilha', formatarMinutos(min)])} />
        )}
      </section>

      <section>
        <h3 className="iv-section-label">Sessões da semana</h3>
        <ListaSessoes sessoes={semana} contexto="nenhum" limite={10} />
        <SessaoRapida />
      </section>
    </DetailDrawer>
  );
}
