import { useState } from 'react';
import { Button } from 'primereact/button';
import type { ArsenalItem } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields, DetailSection } from '@/components/ui/Detail';
import { TextoMarkdown } from '@/components/ui/TextoMarkdown';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { DOMINIO_ARSENAL_LABEL, TIPO_ARSENAL_META, fmtData, relacionadosPorTags } from './regras';
import { ListaRelacionados, TagLinks } from './TagLinks';
import { BaseDosAgentes } from './BaseDosAgentes';
import { Artefatos } from './Artefatos';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

interface Props {
  item: ArsenalItem;
  nav: Nav;
  todos: ArsenalItem[];
  tagAtiva?: string;
  onTag: (t: string) => void;
  onOpen: (id: string) => void;
  onEdit: (i: ArsenalItem) => void;
  onRemove: (i: ArsenalItem) => void;
  onFavoritar: (i: ArsenalItem) => void;
  onCopiado: (nome: string) => void;
  onChanged: () => void;
}

/** Ficha de um prompt/skill/agente do Arsenal: conteúdo completo, quando usar, requisitos, artefatos e relações. */
export function ArsenalDrawer({ item, nav, todos, tagAtiva, onTag, onOpen, onEdit, onRemove, onFavoritar, onCopiado, onChanged }: Props) {
  const [bruto, setBruto] = useState(false);
  const tipo = TIPO_ARSENAL_META[item.tipo];
  const relacionados = relacionadosPorTags(item, todos, {
    getId: (i) => i.id, getTags: (i) => i.tags, mesmoGrupo: (a, b) => a.dominio === b.dominio && a.dominio !== 'geral',
  }).map(({ item: r, comuns }) => ({ id: r.id, titulo: r.nome, sub: `${TIPO_ARSENAL_META[r.tipo].label} · ${DOMINIO_ARSENAL_LABEL[r.dominio]}`, comuns }));

  function copiar() { copyToClipboard(item.conteudo); onCopiado(item.nome); }

  return (
    <DetailDrawer {...nav} wide ariaLabel={`Ficha de ${item.nome}`} kind={{ icon: tipo.icon, label: tipo.label }}
      status={<>
        <Pill label={DOMINIO_ARSENAL_LABEL[item.dominio]} />
        {item.favorito && <Pill label="Favorito" icon="pi-star-fill" tone="warning" />}
      </>}
      title={item.nome}
      subtitle={item.resumo || 'Sem resumo.'}
      actions={<>
        <Button label="Copiar conteúdo" icon="pi pi-copy" size="small" disabled={!item.conteudo} onClick={copiar} />
        <Button label="Editar" icon="pi pi-pencil" size="small" outlined onClick={() => onEdit(item)} />
        <Button label={item.favorito ? 'Tirar dos favoritos' : 'Favoritar'} icon={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} size="small" outlined onClick={() => onFavoritar(item)} />
        <Button label="Excluir" icon="pi pi-trash" size="small" severity="danger" outlined onClick={() => onRemove(item)} />
      </>}>

      {item.quandoUsar && (
        <section>
          <StatusStrip icon="pi-info-circle"><strong>Quando usar:</strong> {item.quandoUsar}</StatusStrip>
        </section>
      )}

      <section>
        <div className="co-sec-head">
          <h3 className="iv-section-label">Conteúdo</h3>
          {item.conteudo && <Button label={bruto ? 'Ver formatado' : 'Ver texto puro'} text size="small" onClick={() => setBruto((v) => !v)} />}
        </div>
        {!item.conteudo ? <p className="co-vazio">Sem conteúdo. Use “Editar” para colar o texto do {tipo.label.toLowerCase()}.</p>
          : bruto ? <pre className="co-codigo">{item.conteudo}</pre>
            : <div className="co-conteudo"><TextoMarkdown texto={item.conteudo} /></div>}
      </section>

      <section>
        <DetailSection title="Detalhes">
          <DetailFields items={[
            ['Tipo', tipo.label],
            ['Domínio', DOMINIO_ARSENAL_LABEL[item.dominio]],
            ['Identificador', item.slug ? <span className="mono">{item.slug}</span> : ''],
            ['Requisitos', item.requisitos.length ? <span className="iv-row iv-wrap">{item.requisitos.map((r) => <Pill key={r} label={r} tone="muted" />)}</span> : ''],
            ['Criado em', fmtData(item.criadoEm)],
            ['Atualizado em', fmtData(item.atualizadoEm)],
          ]} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Tags">
          <TagLinks tags={item.tags} onTag={onTag} ativa={tagAtiva} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title={`Artefatos gerados (${item.artefatos.length})`}>
          <Artefatos item={item} onChanged={onChanged} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Relacionados no arsenal">
          <ListaRelacionados itens={relacionados} onOpen={onOpen} vazio="Nenhum outro item com estas tags ou este domínio." />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Conhecimento para os agentes">
          <BaseDosAgentes tags={item.tags}
            contexto="Agentes do laboratório que já consultam memórias com estas tags; bom ponto de partida para testar este item." />
        </DetailSection>
      </section>
    </DetailDrawer>
  );
}
