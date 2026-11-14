import { Link } from '@tanstack/react-router';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { toneClass } from '@/theme/status';
import { getTecnica } from '@/data/attack';
import { getLab } from '@/services/inventario';
import { ExtLink, FichaLista } from '../ExtLink';
import { DETECCAO_LABEL, prazoKev, tecnicasDosExercicios } from '../regras';
import type { KevLinha } from './tipos';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de uma vulnerabilidade do KEV: descrição, prazo, ação da CISA, ativos, validação e fontes. */
export function KevDrawer({ l, hoje, nav }: { l: KevLinha; hoje: string; nav: Nav }) {
  const { item: i, ativos, exercicios } = l;
  const prazo = prazoKev(i.prazo, hoje);
  const tecnicas = tecnicasDosExercicios(exercicios);
  const passos = [
    ativos.length > 0
      ? `Confirme produto, edição e versão em ${ativos.map((a) => a.nome).join(', ')}: o vínculo é só uma sugestão por nome/tag.`
      : 'Confira no inventário se você usa este produto (o vínculo automático não achou nenhum ativo).',
    `Aplique a ação recomendada pela CISA${i.prazo ? ` (prazo de referência: ${i.prazo})` : ''}.`,
    exercicios.length > 0
      ? 'Depois de corrigir, registre o reteste no exercício Red × Blue.'
      : `Registre um exercício Red × Blue em Labs com a referência ${i.cve} para validar a correção.`,
  ];

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha de ${i.cve}`} kind={{ icon: 'pi-shield', label: 'Vulnerabilidade explorada (KEV)' }}
      status={<>
        {ativos.length > 0 && <Pill tone="serious" icon="pi-server" label={`${ativos.length} ativo(s) possivelmente afetado(s)`} />}
        {i.ransomware && <Pill tone="danger" icon="pi-exclamation-triangle" label="Usada por ransomware" />}
        <Pill label={`${i.fabricante} · ${i.produto}`} />
      </>}
      title={i.nome}
      subtitle={<span className="mono">{i.cve}</span>}
      actions={<>
        <ExtLink button href={`https://nvd.nist.gov/vuln/detail/${i.cve}`}>Ver na NVD</ExtLink>
        <Link to="/labs" className="p-button p-component p-button-outlined in-extbtn"><i className="pi pi-verified" aria-hidden="true" />Registrar validação</Link>
      </>}
    >
      <section>
        <h3 className="iv-section-label">Descrição</h3>
        <p className="in-prose">{i.descricao}</p>
      </section>

      <section>
        <h3 className="iv-section-label">Ação recomendada pela CISA</h3>
        <p className={`in-passo ${toneClass(prazo.tone === 'serious' ? 'serious' : undefined)}`} data-alert={prazo.tone === 'serious' || undefined}>{i.acao}</p>
      </section>

      <section>
        <h3 className="iv-section-label">Datas</h3>
        <DetailFields items={[
          ['Entrou no KEV', <span className="tabular">{i.adicionadoEm}</span>],
          ['Prazo CISA', <span className="tabular">{prazo.texto}</span>],
          ['Ransomware', i.ransomware ? 'Uso conhecido em campanhas' : 'Sem uso conhecido'],
          ['Produto acompanhado', i.termo],
        ]} />
        <p className="in-muted-p">O prazo é o exigido das agências federais dos EUA; aqui serve de régua de urgência.</p>
      </section>

      <section>
        <h3 className="iv-section-label">Possíveis ativos afetados</h3>
        <FichaLista vazio="Nenhum ativo do inventário cita este produto ou fabricante.">
          {ativos.map((a) => (
            <li key={a.id} className="in-list__row">
              <Link to="/ambiente">{a.nome}</Link>
              <span className="iv-muted">{a.funcao || a.tags.join(', ')}</span>
            </li>
          ))}
        </FichaLista>
      </section>

      <section>
        <h3 className="iv-section-label">Validação Red × Blue</h3>
        <FichaLista vazio="Sem exercício ou reteste registrado para esta CVE.">
          {exercicios.map((e) => (
            <li key={e.id} className="in-list__row">
              <Link to="/labs">{getLab(e.labId)?.titulo ?? e.title}</Link>
              <span className="iv-muted">{e.status.replaceAll('_', ' ')} · reteste {e.retestResult} · detecção {DETECCAO_LABEL[e.detection]}</span>
            </li>
          ))}
        </FichaLista>
        {tecnicas.length > 0 && (
          <p className="in-muted-p">Técnicas ATT&amp;CK usadas: {tecnicas.map((t) => (
            <Link key={t} to="/attack" className="in-gap"><span className="mono">{t}</span>{getTecnica(t) ? ` ${getTecnica(t)!.nome}` : ''}</Link>
          ))}</p>
        )}
      </section>

      <section>
        <h3 className="iv-section-label">Próximos passos</h3>
        <ol className="in-passos">{passos.map((p) => <li key={p}>{p}</li>)}</ol>
      </section>

      <section>
        <h3 className="iv-section-label">Fontes oficiais</h3>
        <div className="iv-row iv-wrap">
          <ExtLink href={`https://nvd.nist.gov/vuln/detail/${i.cve}`}>NVD (NIST)</ExtLink>
          <ExtLink href={`https://www.cve.org/CVERecord?id=${i.cve}`}>CVE.org</ExtLink>
          <ExtLink href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${i.cve}`}>Catálogo KEV (CISA)</ExtLink>
        </div>
      </section>
    </DetailDrawer>
  );
}
