import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { ArsenalItem, TipoArsenal, DominioArsenal } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { ClickCard } from '@/components/ui/ClickCard';
import { Kpi, Chip, Pill, EmptyState } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { copyToClipboard } from '@/lib/clipboard';
import { listArsenal, resumoArsenal, saveArsenal, removeArsenal, toggleFavorito } from '@/services/arsenal';
import { DOMINIO_ARSENAL_LABEL, TIPO_ARSENAL_META, filtrarPorTag } from './conhecimento/regras';
import { ArsenalDrawer } from './conhecimento/ArsenalDrawer';
import { ArsenalForm, type ArsenalDraft } from './conhecimento/ArsenalForm';
import '@/styles/telas/conhecimento.css';

export function Arsenal() {
  const invalidate = useInvalidate();
  const toast = useRef<Toast>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [tipo, setTipo] = useState<TipoArsenal | undefined>();
  const [dominio, setDominio] = useState<DominioArsenal | undefined>();
  const [favorito, setFavorito] = useState(false);
  const [tag, setTag] = useState<string | undefined>();
  const [draft, setDraft] = useState<ArsenalDraft | null>(null);

  const filtros = useMemo(() => ({ search, tipo, dominio, favorito: favorito || undefined }), [search, tipo, dominio, favorito]);
  const query = useQuery({ queryKey: ['arsenal', filtros], queryFn: () => listArsenal(filtros) });
  const todos = useQuery({ queryKey: ['arsenal', 'todos'], queryFn: () => listArsenal() }).data ?? [];
  const resumo = useQuery({ queryKey: ['resumo-arsenal'], queryFn: resumoArsenal }).data;
  const lista = useMemo(() => filtrarPorTag(query.data ?? [], tag, (i) => i.tags), [query.data, tag]);
  const sel = useDrawerSelection(lista);

  // domínios com itens, do mais usado para o menos usado
  const dominios = useMemo(() => {
    const n = new Map<DominioArsenal, number>();
    for (const i of todos) n.set(i.dominio, (n.get(i.dominio) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [todos]);

  const refresh = () => invalidate('arsenal', 'resumo-arsenal');
  const toggleTipo = (t: TipoArsenal) => setTipo(tipo === t ? undefined : t);
  function limpar() { setSearchRaw(''); setTipo(undefined); setDominio(undefined); setFavorito(false); setTag(undefined); }
  function novo(t: TipoArsenal) { setDraft({ nome: '', tipo: t, dominio: 'geral' }); }
  function favoritar(i: ArsenalItem) { toggleFavorito(i.id); refresh(); }
  function copiado(nome: string) { toast.current?.show({ severity: 'success', summary: 'Copiado', detail: nome, life: 2000 }); }

  function salvar(d: ArsenalDraft) {
    const salvo = saveArsenal(d);
    setDraft(null);
    refresh();
    toast.current?.show({ severity: 'success', summary: d.id ? 'Item atualizado' : 'Adicionado ao arsenal', detail: salvo.nome, life: 2500 });
  }

  function confirmarExclusao(i: ArsenalItem) {
    confirmDialog({
      header: 'Excluir do arsenal',
      message: <span>Excluir <strong>{i.nome}</strong>{i.artefatos.length > 0 ? ` e seus ${i.artefatos.length} artefato(s)` : ''}?<br /><small className="iv-muted">Copie o conteúdo antes se quiser guardar uma versão.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeArsenal(i.id); sel.close(); refresh(); toast.current?.show({ severity: 'success', summary: 'Item excluído', detail: i.nome, life: 2500 }); },
    });
  }

  const activeFilters = [
    tipo && { key: 't', label: `Tipo: ${TIPO_ARSENAL_META[tipo].label}`, onRemove: () => setTipo(undefined) },
    dominio && { key: 'd', label: `Domínio: ${DOMINIO_ARSENAL_LABEL[dominio]}`, onRemove: () => setDominio(undefined) },
    favorito && { key: 'f', label: 'Só favoritos', onRemove: () => setFavorito(false) },
    tag && { key: 'g', label: `Tag: #${tag}`, onRemove: () => setTag(undefined) },
    search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => setSearchRaw('') },
  ];

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader title="Arsenal de IA" subtitle="Sua biblioteca de prompts, skills e agentes de segurança. Vá acumulando o que funciona."
        actions={<>
          <Button label="Novo prompt" icon="pi pi-plus" onClick={() => novo('prompt')} />
          <Button label="Nova skill" icon="pi pi-plus" outlined onClick={() => novo('skill')} />
          <Button label="Novo agente" icon="pi pi-plus" outlined onClick={() => novo('agente')} />
        </>} />

      <div className="iv-kpis">
        <Kpi label="Prompts" icon={TIPO_ARSENAL_META.prompt.icon} value={resumo?.prompts ?? 0} active={tipo === 'prompt'} onClick={() => toggleTipo('prompt')} />
        <Kpi label="Skills" icon={TIPO_ARSENAL_META.skill.icon} value={resumo?.skills ?? 0} active={tipo === 'skill'} onClick={() => toggleTipo('skill')} />
        <Kpi label="Agentes" icon={TIPO_ARSENAL_META.agente.icon} value={resumo?.agentes ?? 0} active={tipo === 'agente'} onClick={() => toggleTipo('agente')} />
        <Kpi label="Favoritos" icon="pi-star" value={resumo?.favoritos ?? 0} active={favorito} onClick={() => setFavorito((v) => !v)} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={searchRaw} onChange={setSearchRaw} placeholder="Buscar por nome, conteúdo ou tag" />
          <span className="iv-toolbar__count">{lista.length} de {resumo?.total ?? 0}</span>
        </div>
        {dominios.length > 1 && (
          <div className="co-chips" role="group" aria-label="Filtrar por domínio">
            <span className="co-label">Domínio:</span>
            {dominios.map(([d, n]) => (
              <Chip key={d} label={`${DOMINIO_ARSENAL_LABEL[d]} (${n})`} active={dominio === d} onClick={() => setDominio(dominio === d ? undefined : d)} />
            ))}
          </div>
        )}
        <ActiveFiltersBar filters={activeFilters} onClearAll={limpar} />

        {lista.length === 0 ? (
          (resumo?.total ?? 0) === 0
            ? <EmptyState icon="pi-sparkles" title="Arsenal vazio" text="Guarde aqui os prompts, skills e agentes que funcionaram." action={<Button label="Novo prompt" icon="pi pi-plus" onClick={() => novo('prompt')} />} />
            : <EmptyState icon="pi-filter-slash" title="Nada com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} />
        ) : (
          <div className="grid-cards co-grid">
            {lista.map((item) => {
              const t = TIPO_ARSENAL_META[item.tipo];
              return (
                <ClickCard key={item.id} onOpen={() => sel.open(item.id)} selected={sel.isOpen(item.id)} className="co-card" label={`Abrir ficha de ${item.nome}`}>
                  <div className="co-card__top">
                    <span className="co-tipo"><i className={`pi ${t.icon}`} aria-hidden="true" />{t.label}</span>
                    <span className="iv-row co-gap-xs">
                      <Button type="button" text rounded size="small" icon="pi pi-copy" aria-label={`Copiar conteúdo de ${item.nome}`} tooltip="Copiar conteúdo"
                        disabled={!item.conteudo} onClick={() => { copyToClipboard(item.conteudo); copiado(item.nome); }} />
                      <Button type="button" text rounded size="small" aria-pressed={item.favorito} className={item.favorito ? 'co-fav' : undefined}
                        aria-label={item.favorito ? `Tirar ${item.nome} dos favoritos` : `Favoritar ${item.nome}`}
                        icon={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} onClick={() => favoritar(item)} />
                    </span>
                  </div>
                  <h3 className="co-card__titulo">{item.nome}</h3>
                  <p className="co-card__resumo">{item.resumo || 'Sem resumo.'}</p>
                  <div className="co-card__rodape">
                    <Pill label={DOMINIO_ARSENAL_LABEL[item.dominio]} />
                    {item.tags.slice(0, 2).map((g) => <span key={g} className="co-tag">#{g}</span>)}
                    {item.artefatos.length > 0 && <span className="co-tag" title="Artefatos gerados"><i className="pi pi-paperclip" aria-hidden="true" /> {item.artefatos.length}</span>}
                  </div>
                </ClickCard>
              );
            })}
          </div>
        )}
      </div>

      {sel.item && !draft && (
        <ArsenalDrawer item={sel.item} nav={sel.nav} todos={todos} tagAtiva={tag}
          onTag={(g) => setTag(tag === g ? undefined : g)} onOpen={(id) => { limpar(); sel.open(id); }}
          onEdit={(i) => setDraft({ ...i })} onRemove={confirmarExclusao} onFavoritar={favoritar} onCopiado={copiado} onChanged={refresh} />
      )}
      {draft && <ArsenalForm inicial={draft} onCancel={() => setDraft(null)} onSave={salvar} />}
    </div>
  );
}
