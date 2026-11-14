import { useState } from 'react';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { InputTextarea } from 'primereact/inputtextarea';
import type { BiblioItem } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields, DetailSection } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getTopico } from '@/services/catalog';
import { updateBiblio, reprocessar } from '@/services/biblioteca';
import { CATEGORIA_LABELS } from '@/services/textProcess';
import { ESTADO_LEITURA_META, ESTADO_LEITURA_OPTS, fmtData, relacionadosPorTags } from './regras';
import { ListaRelacionados, TagLinks } from './TagLinks';
import { BaseDosAgentes } from './BaseDosAgentes';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

interface Props {
  item: BiblioItem;
  nav: Nav;
  /** todos os itens (não só os filtrados), para achar relacionados */
  todos: BiblioItem[];
  tagAtiva?: string;
  onTag: (t: string) => void;
  onCategoria: (c: string) => void;
  onBusca: (q: string) => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onFavoritar: (i: BiblioItem) => void;
  onRemove: (i: BiblioItem) => void;
  onGuardarNoCerebro: (i: BiblioItem) => void;
  guardando: boolean;
}

/** Ficha de um item da Biblioteca: leitura, resumo, anotações, tags, relacionados e base dos agentes. */
export function BiblioDrawer({ item, nav, todos, tagAtiva, onTag, onCategoria, onBusca, onOpen, onChanged, onFavoritar, onRemove, onGuardarNoCerebro, guardando }: Props) {
  const estado = ESTADO_LEITURA_META[item.estado];
  const categoria = CATEGORIA_LABELS[item.categoria] ?? item.categoria;
  const topico = item.topicoId ? getTopico(item.topicoId) : undefined;
  const relacionados = relacionadosPorTags(item, todos, {
    getId: (i) => i.id, getTags: (i) => i.tags, mesmoGrupo: (a, b) => a.categoria === b.categoria && a.categoria !== 'geral',
  }).map(({ item: r, comuns }) => ({ id: r.id, titulo: r.titulo || r.url, sub: r.dominio, comuns }));

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha de ${item.titulo || item.url}`} kind={{ icon: 'pi-bookmark', label: 'Leitura' }}
      status={<>
        <Pill label={estado.label} tone={estado.tone} icon={estado.icon} />
        {item.favorito && <Pill label="Favorito" icon="pi-star-fill" tone="warning" />}
      </>}
      title={item.titulo || item.url}
      subtitle={[item.dominio, `salvo em ${fmtData(item.criadoEm)}`].filter(Boolean).join(' · ')}
      actions={<>
        <a className="p-button p-component p-button-sm" href={item.url} target="_blank" rel="noreferrer">
          <span className="p-button-icon p-button-icon-left pi pi-external-link" aria-hidden="true" />
          <span className="p-button-label">Abrir página</span>
        </a>
        <Button label={item.favorito ? 'Tirar dos favoritos' : 'Favoritar'} icon={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} size="small" outlined onClick={() => onFavoritar(item)} />
        <Button label="Guardar no Segundo Cérebro" icon={guardando ? 'pi pi-spinner pi-spin' : 'pi pi-database'} size="small" outlined disabled={guardando}
          onClick={() => onGuardarNoCerebro(item)} tooltip="Vira uma memória pessoal com as mesmas tags; agentes com essas tags passam a consultá-la" />
        <Button label="Excluir" icon="pi pi-trash" size="small" severity="danger" outlined onClick={() => onRemove(item)} />
      </>}>

      <section>
        <DetailSection title="Leitura">
          <SelectButton value={item.estado} options={ESTADO_LEITURA_OPTS} allowEmpty={false} aria-label="Estado de leitura"
            onChange={(e) => { if (e.value) { updateBiblio(item.id, { estado: e.value }); onChanged(); } }} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Resumo">
          {item.resumo ? <p className="co-paragrafo">{item.resumo}</p>
            : <p className="co-vazio">Sem resumo: nenhum texto foi colado ao salvar.</p>}
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Minhas anotações">
          <Anotacoes key={item.id} item={item} onChanged={onChanged} />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Detalhes">
          <DetailFields items={[
            ['Endereço', (
              <span className="iv-row co-nowrap-min">
                <a href={item.url} target="_blank" rel="noreferrer" className="co-url">{item.url}</a>
                <Button icon="pi pi-copy" text size="small" aria-label="Copiar endereço" tooltip="Copiar" onClick={() => copyToClipboard(item.url)} />
              </span>
            )],
            ['Assunto', <button type="button" className="iv-linkbtn" onClick={() => onCategoria(item.categoria)} title="Mostrar só este assunto">{categoria}</button>],
            ['Palavras-chave', item.palavrasChave.length ? (
              <span className="iv-row iv-wrap">
                {item.palavrasChave.map((k) => <button key={k} type="button" className="iv-chip" onClick={() => onBusca(k)} title={`Buscar "${k}"`}>{k}</button>)}
              </span>
            ) : ''],
            ['Tópico de estudo', topico?.titulo ?? ''],
            ['Resumo feito por', item.fonteResumo === 'ia' ? 'IA' : 'Processamento local (extrativo)'],
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
        <DetailSection title="Relacionados na biblioteca">
          <ListaRelacionados itens={relacionados} onOpen={onOpen} vazio="Nenhum outro item com estas tags ou este assunto." />
        </DetailSection>
      </section>

      <section>
        <DetailSection title="Agentes que usariam isto">
          <BaseDosAgentes tags={item.tags}
            contexto="A Biblioteca não vai direto para os agentes: use “Guardar no Segundo Cérebro” e os agentes que têm estas tags na base passam a consultar." />
        </DetailSection>
      </section>

      {item.textoOriginal && (
        <section>
          <DetailSection title="Texto salvo">
            <details className="co-details">
              <summary>Ver o texto colado ({item.textoOriginal.length.toLocaleString('pt-BR')} caracteres)</summary>
              <div className="co-texto">{item.textoOriginal}</div>
            </details>
            <Button label="Refazer resumo e tags" icon="pi pi-refresh" size="small" text className="iv-mt"
              onClick={() => { reprocessar(item.id); onChanged(); }} tooltip="Refaz resumo, assunto e tags a partir do texto salvo" />
          </DetailSection>
        </section>
      )}
    </DetailDrawer>
  );
}

function Anotacoes({ item, onChanged }: { item: BiblioItem; onChanged: () => void }) {
  const [nota, setNota] = useState(item.anotacoes);
  const mudou = nota !== item.anotacoes;
  return (
    <div className="iv-col co-gap-sm">
      <InputTextarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4} className="co-w100" aria-label="Minhas anotações"
        placeholder="Por que isso é interessante? O que aproveitar?" />
      <span className="iv-row">
        <Button label="Salvar anotação" icon="pi pi-save" size="small" disabled={!mudou}
          onClick={() => { updateBiblio(item.id, { anotacoes: nota }); onChanged(); }} />
        {mudou && <span className="co-nota">Alterações não salvas</span>}
      </span>
    </div>
  );
}
