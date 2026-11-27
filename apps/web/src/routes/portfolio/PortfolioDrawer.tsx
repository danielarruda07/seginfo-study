import { Link } from '@tanstack/react-router';
import { MODULO_ESTUDO_ATIVO } from '@/config/modulos';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { DOMINIO_LAB } from '@/theme/status';
import { NIVEL_LABEL, type ItemPortfolio } from './regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

const mitre = (ids?: string[]) => (ids?.length ? <span className="iv-row iv-wrap">{ids.map((m) => <Pill key={m} label={m} />)}</span> : '');

/** Ficha de um item do portfólio (trilha, lab ou tópico concluído): o que foi estudado e a evidência. */
export function PortfolioDrawer({ item, nav }: { item: ItemPortfolio; nav: Nav }) {
  if (item.tipo === 'trilha') {
    const { trilha, topicos } = item;
    return (
      <DetailDrawer {...nav} kind={{ icon: 'pi-sitemap', label: 'Trilha concluída' }} ariaLabel={`Ficha da trilha ${trilha.titulo}`}
        status={<Pill label="100% concluída" tone="ok" icon="pi-check" />} title={trilha.titulo} subtitle={trilha.descricao}
        actions={MODULO_ESTUDO_ATIVO ? <Link to="/trilhas/$trilhaId" params={{ trilhaId: trilha.id }} className="p-button p-button-outlined p-button-sm">Abrir a trilha</Link> : undefined}>
        <section>
          <h3 className="iv-section-label">{topicos.length} tópicos estudados</h3>
          <ul className="ca-lista">
            {topicos.map((t) => <li key={t.id}><i className="pi pi-check ca-ok" aria-hidden="true" /> {t.titulo} <span className="iv-muted">· {NIVEL_LABEL[t.nivel]}</span></li>)}
          </ul>
        </section>
      </DetailDrawer>
    );
  }

  if (item.tipo === 'lab') {
    const { lab, progresso: p } = item;
    const dom = DOMINIO_LAB[lab.dominio];
    return (
      <DetailDrawer {...nav} kind={{ icon: 'pi-flask', label: 'Lab concluído' }} ariaLabel={`Ficha do lab ${lab.titulo}`}
        status={<><Pill label="Concluído" tone="ok" icon="pi-check" /><Pill label={dom.label} color={dom.color} /></>}
        title={lab.titulo} subtitle={lab.objetivo}
        actions={<Link to="/labs" className="p-button p-button-outlined p-button-sm">Abrir labs</Link>}>
        {p.aprendizado && (
          <section>
            <h3 className="iv-section-label">O que aprendi</h3>
            <div className="ca-texto">{p.aprendizado}</div>
          </section>
        )}
        <section>
          <h3 className="iv-section-label">Registro</h3>
          <DetailFields items={[
            ['Concluído em', p.concluidoEm ?? ''],
            ['Nível', NIVEL_LABEL[lab.nivel]],
            ['Resultado esperado', lab.resultadoEsperado],
            ['Passos', lab.passos.length ? `${lab.passos.length} passos` : ''],
            ['MITRE ATT&CK', mitre(p.mitre.length ? p.mitre : lab.mitre)],
            ['Evidência', p.evidencia],
          ]} />
        </section>
        <p className="iv-muted ca-small">Revise a evidência antes de compartilhar: ela não pode citar IPs, hosts ou credenciais do homelab.</p>
      </DetailDrawer>
    );
  }

  const { topico: t, trilha } = item;
  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-book', label: 'Tópico concluído' }} ariaLabel={`Ficha do tópico ${t.titulo}`}
      status={<><Pill label="Concluído" tone="ok" icon="pi-check" /><Pill label={NIVEL_LABEL[t.nivel]} /></>}
      title={t.titulo} subtitle={trilha ? `Trilha ${trilha.titulo}` : undefined}
      actions={MODULO_ESTUDO_ATIVO ? <Link to="/trilhas/$trilhaId" params={{ trilhaId: t.trilhaId }} className="p-button p-button-outlined p-button-sm">Abrir na trilha</Link> : undefined}>
      {t.resumo && (
        <section>
          <h3 className="iv-section-label">Resumo</h3>
          <p className="ca-small ca-mb0">{t.resumo}</p>
        </section>
      )}
      <section>
        <h3 className="iv-section-label">Conteúdo</h3>
        <DetailFields items={[
          ['Conceitos-chave', t.conceitosChave.join(' · ')],
          ['Ferramentas', t.ferramentas.map((f) => f.nome).join(' · ')],
          ['MITRE ATT&CK', mitre(t.mitre)],
        ]} />
      </section>
    </DetailDrawer>
  );
}
