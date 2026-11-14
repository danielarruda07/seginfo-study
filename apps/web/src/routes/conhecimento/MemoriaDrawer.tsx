import { useQueries, useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields, DetailSection } from '@/components/ui/Detail';
import { TextoMarkdown } from '@/components/ui/TextoMarkdown';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getMemoria, listMemorias, type Escopo, type Memoria } from '@/services/cerebro';
import { ESCOPO_META, fmtData, origemMeta, relacionadosPorTags, unicosPorId } from './regras';
import { ListaRelacionados, TagLinks } from './TagLinks';
import { BaseDosAgentes } from './BaseDosAgentes';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

interface Props {
  id: string;
  nav: Nav;
  tagAtiva?: string;
  onTag: (t: string) => void;
  onOpen: (id: string) => void;
  onEdit: (m: Memoria) => void;
  onLixeira: (m: Memoria) => void;
  onResgatar: (m: Memoria) => void;
  onCopiado: () => void;
}

/** Ficha da memória: conteúdo completo, origem, tags, agentes que a consultam e memórias relacionadas. */
export function MemoriaDrawer({ id, nav, tagAtiva, onTag, onOpen, onEdit, onLixeira, onResgatar, onCopiado }: Props) {
  const q = useQuery({ queryKey: ['memorias', 'uma', id], queryFn: () => getMemoria(id) });
  const m = q.data;

  // relacionadas: uma consulta por tag (até 3), juntadas e ranqueadas por tags em comum
  const tags = (m?.tags ?? []).slice(0, 3);
  const porTag = useQueries({
    queries: tags.map((tag) => ({ queryKey: ['memorias', { tag, page: 0, limit: 10 }], queryFn: () => listMemorias({ tag, page: 0, limit: 10 }) })),
  });
  const relacionadas = !m ? [] : relacionadosPorTags<{ id: string; tags: string[]; titulo: string; escopo: Escopo }>(
    { id: m.id, tags: m.tags, titulo: m.titulo, escopo: m.escopo },
    unicosPorId(porTag.map((r) => r.data?.items)),
    { getId: (i) => i.id, getTags: (i) => i.tags },
  ).map(({ item, comuns }) => ({ id: item.id, titulo: item.titulo, sub: ESCOPO_META[item.escopo].label, comuns }));

  if (!m) {
    return (
      <DetailDrawer {...nav} ariaLabel="Ficha da memória" kind={{ icon: 'pi-database', label: 'Memória' }}
        title={q.isError ? 'Não foi possível abrir a memória' : 'Carregando…'}
        subtitle={q.isError ? 'A API ou o banco não respondeu. Tente de novo em instantes.' : undefined} />
    );
  }

  const naLixeira = !!m.excluirEm;
  const escopo = ESCOPO_META[m.escopo];
  const origem = origemMeta(m.origem);
  const bloqueio = naLixeira ? 'Na lixeira: nenhum agente consulta memórias apagadas.'
    : m.escopo === 'corporativo' ? 'Memória corporativa: nunca entra na base dos agentes (o trecho iria para o contexto de um modelo de linguagem).' : undefined;

  return (
    <DetailDrawer {...nav} wide ariaLabel={`Ficha de ${m.titulo}`} kind={{ icon: 'pi-database', label: 'Memória' }}
      status={<>
        <Pill label={escopo.label} tone={escopo.tone} icon={escopo.icon} />
        <Pill label={origem.label} icon={origem.icon} tone="muted" />
        {naLixeira && <Pill label="Na lixeira" tone="danger" icon="pi-trash" />}
      </>}
      title={m.titulo}
      subtitle={`Atualizada em ${fmtData(m.atualizadoEm)}`}
      actions={naLixeira ? (
        <Button label="Resgatar da lixeira" icon="pi pi-undo" size="small" onClick={() => onResgatar(m)} />
      ) : <>
        <Button label="Editar" icon="pi pi-pencil" size="small" onClick={() => onEdit(m)} />
        <Button label="Copiar conteúdo" icon="pi pi-copy" size="small" outlined onClick={() => { copyToClipboard(m.conteudo); onCopiado(); }} />
        <Button label="Mover para a lixeira" icon="pi pi-trash" size="small" severity="danger" outlined onClick={() => onLixeira(m)} />
      </>}>

      {naLixeira && (
        <section>
          <StatusStrip tone="crit" icon="pi-exclamation-triangle">Será apagada de vez em {fmtData(m.excluirEm)}. Resgate para editar ou voltar a usar.</StatusStrip>
        </section>
      )}

      <section>
        <DetailSection title="Conteúdo">
          {m.conteudo.trim() ? <div className="co-conteudo"><TextoMarkdown texto={m.conteudo} /></div>
            : <p className="co-vazio">Memória sem conteúdo.</p>}
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Tags">
          <TagLinks tags={m.tags} onTag={onTag} ativa={tagAtiva} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Agentes que consultam esta memória">
          <BaseDosAgentes tags={m.tags} bloqueio={bloqueio} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Memórias relacionadas">
          <ListaRelacionados itens={relacionadas} onOpen={onOpen} vazio={m.tags.length ? 'Nenhuma outra memória com estas tags.' : 'Sem tags, não dá para achar relacionadas.'} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Detalhes">
          <DetailFields items={[
            ['Fonte', m.urlOrigem ? <a href={m.urlOrigem} target="_blank" rel="noreferrer" className="co-url">{m.urlOrigem}</a> : origem.label],
            ['Escopo', m.escopo === 'corporativo' ? 'Corporativo: fora do backup para o OneDrive e da base dos agentes' : 'Pessoal: entra no backup e pode alimentar agentes'],
            ['Tamanho', `${m.conteudo.length.toLocaleString('pt-BR')} caracteres`],
            ['Criada em', fmtData(m.criadoEm)],
            ['Atualizada em', fmtData(m.atualizadoEm)],
          ]} />
        </DetailSection>
      </section>
    </DetailDrawer>
  );
}
