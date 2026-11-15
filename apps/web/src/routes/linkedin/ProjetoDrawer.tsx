import { Button } from 'primereact/button';
import type { IdeiaLinkedin, PostPublicado, ProjetoLinkedin, RascunhoLinkedin, StatusProjeto } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { primeiraLinha } from './regras';
import { STATUS_META, STATUS_PROJETO_META, type ResumoProjeto } from './pipelineRegras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;
const dataBr = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

function Lista({ titulo, vazio, itens }: { titulo: string; vazio: string; itens: { id: string; texto: string; extra?: string }[] }) {
  return (
    <section>
      <h3 className="iv-section-label">{titulo} <span className="tabular">({itens.length})</span></h3>
      {itens.length === 0 ? <p className="iv-muted ca-small">{vazio}</p> : (
        <ul className="ca-lista">
          {itens.slice(0, 6).map((i) => <li key={i.id}><strong>{i.texto}</strong>{i.extra && <span className="iv-muted"> · {i.extra}</span>}</li>)}
          {itens.length > 6 && <li className="iv-muted">+ {itens.length - 6} na aba correspondente</li>}
        </ul>
      )}
    </section>
  );
}

/** Ficha do projeto: para que serve, o que há nele e o que fazer em seguida. */
export function ProjetoDrawer({ projeto: p, nav, resumo, ideias, rascunhos, publicados, ocupado, onNovaIdeia, onEditar, onStatus, onExcluir }: {
  projeto: ProjetoLinkedin; nav: Nav; resumo: ResumoProjeto;
  ideias: IdeiaLinkedin[]; rascunhos: RascunhoLinkedin[]; publicados: PostPublicado[]; ocupado: boolean;
  onNovaIdeia: () => void; onEditar: () => void;
  onStatus: (s: StatusProjeto) => void; onExcluir: () => void;
}) {
  const meta = STATUS_PROJETO_META[p.status];
  const novas = ideias.filter((i) => i.projetoId === p.id && i.status === 'nova');
  const emCurso = rascunhos.filter((r) => r.projetoId === p.id && r.status !== 'publicado');
  const posts = publicados.filter((x) => x.projetoId === p.id).sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-folder', label: 'Projeto de conteúdo' }} ariaLabel={`Ficha do projeto ${p.nome}`}
      status={<>
        <Pill label={meta.label} tone={meta.tone} />
        {p.pilar && <Pill label={p.pilar} />}
        {resumo.parado && <Pill label="Sem post há 14+ dias" tone="serious" icon="pi-clock" />}
      </>}
      title={p.nome}
      subtitle={p.descricao || 'Sem descrição'}
      actions={<>
        <Button label="Nova ideia neste projeto" icon="pi pi-plus" size="small" onClick={onNovaIdeia} />
        <Button label="Editar" icon="pi pi-pencil" size="small" outlined onClick={onEditar} />
        {p.status === 'ativo' && <Button label="Pausar" icon="pi pi-pause" size="small" outlined disabled={ocupado} onClick={() => onStatus('pausado')} />}
        {p.status === 'ativo' && <Button label="Concluir" icon="pi pi-flag" size="small" outlined disabled={ocupado} onClick={() => onStatus('concluido')} />}
        {p.status !== 'ativo' && <Button label="Reativar" icon="pi pi-replay" size="small" outlined disabled={ocupado} onClick={() => onStatus('ativo')} />}
        <Button label="Excluir" icon="pi pi-trash" size="small" text severity="danger" onClick={onExcluir} />
      </>}>
      {resumo.parado && (
        <p className="ca-aviso" role="status"><i className="pi pi-clock" aria-hidden="true" />
          {resumo.diasSemPost === null ? 'Projeto ativo que ainda não teve nenhum post.' : `Último post há ${resumo.diasSemPost} dias.`}
          {' '}{novas.length ? 'Há ideias esperando: escolha uma e escreva.' : 'Anote uma ideia ou pause o projeto se ele não é prioridade agora.'}
        </p>
      )}
      <section>
        <h3 className="iv-section-label">Sobre</h3>
        <DetailFields items={[
          ['Objetivo', p.objetivo],
          ['Pilar principal', p.pilar ?? ''],
          ['Criado em', dataBr(p.criadoEm)],
          ['Último post', resumo.ultimoPost ? `${dataBr(resumo.ultimoPost)} (há ${resumo.diasSemPost} ${resumo.diasSemPost === 1 ? 'dia' : 'dias'})` : ''],
        ]} />
      </section>
      <Lista titulo="Ideias novas" vazio="Nenhuma ideia esperando neste projeto." itens={novas.map((i) => ({ id: i.id, texto: i.titulo }))} />
      <Lista titulo="No pipeline" vazio="Nenhum rascunho em andamento."
        itens={emCurso.map((r) => ({ id: r.id, texto: r.titulo, extra: STATUS_META[r.status].label }))} />
      <Lista titulo="Publicados" vazio="Nenhum post publicado ligado a este projeto. Ligue posts antigos pela ficha deles em Publicados."
        itens={posts.map((x) => ({ id: x.id, texto: x.analise?.resumo ?? primeiraLinha(x.texto, 120), extra: dataBr(x.publicadoEm) }))} />
    </DetailDrawer>
  );
}
