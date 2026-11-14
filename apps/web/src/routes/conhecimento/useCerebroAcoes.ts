import { createElement, useState, type RefObject } from 'react';
import type { Toast } from 'primereact/toast';
import { confirmDialog } from 'primereact/confirmdialog';
import { useInvalidate } from '@/hooks/useInvalidate';
import {
  capturarUrl, createMemoria, deleteMemoria, getMemoria, importarNotas, restoreMemoria, updateMemoria,
  type MemoriaCorpo,
} from '@/services/cerebro';
import type { MemoriaInicial } from './MemoriaForm';

const MAX_ARQUIVO = 200_000;

export const erroDe = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;

/** Ações do Segundo Cérebro (API): criar/editar, lixeira, resgate, captura de URL e importação. */
export function useCerebroAcoes(toast: RefObject<Toast | null>, fecharFicha: () => void) {
  const invalidate = useInvalidate();
  const [form, setForm] = useState<MemoriaInicial | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const avisar = (severity: 'success' | 'info' | 'error', summary: string, detail?: string) =>
    toast.current?.show({ severity, summary, detail, life: severity === 'error' ? 5000 : 3000 });
  const refresh = () => invalidate('memorias', 'agentes-base-tags');

  async function rodar(fn: () => Promise<void>, falha: string) {
    setOcupado(true);
    try { await fn(); } catch (e) { avisar('error', falha, erroDe(e, 'A API não respondeu.')); } finally { setOcupado(false); }
  }

  return {
    form,
    ocupado,
    nova: () => setForm({ titulo: '', conteudo: '', tags: [], escopo: 'pessoal' }),
    editar: (m: MemoriaInicial) => setForm({ id: m.id, titulo: m.titulo, conteudo: m.conteudo, tags: m.tags, escopo: m.escopo }),
    editarPorId: (id: string) => rodar(async () => {
      const m = await getMemoria(id);
      setForm({ id: m.id, titulo: m.titulo, conteudo: m.conteudo, tags: m.tags, escopo: m.escopo });
    }, 'Não foi possível abrir a memória'),
    fecharForm: () => setForm(null),

    salvar: (id: string | undefined, corpo: MemoriaCorpo) => rodar(async () => {
      if (id) await updateMemoria(id, corpo); else await createMemoria(corpo);
      setForm(null); refresh(); avisar('success', id ? 'Memória atualizada' : 'Memória guardada', corpo.titulo);
    }, 'Falha ao salvar'),

    lixeira: (m: { id: string; titulo: string }) => confirmDialog({
      header: 'Mover para a lixeira',
      message: createElement('span', null, 'Mover ', createElement('strong', null, m.titulo), ' para a lixeira? Os agentes deixam de consultá-la. Dá para resgatar por 7 dias.'),
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Mover para a lixeira', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => rodar(async () => {
        await deleteMemoria(m.id); fecharFicha(); refresh();
        avisar('info', 'Movida para a lixeira', 'Some de vez em 7 dias; dá para resgatar até lá.');
      }, 'Falha ao excluir'),
    }),

    resgatar: (m: { id: string }) => rodar(async () => {
      await restoreMemoria(m.id); fecharFicha(); refresh(); avisar('success', 'Memória resgatada da lixeira');
    }, 'Falha ao resgatar'),

    /** devolve true quando guardou (para limpar o campo) */
    capturar: async (url: string) => {
      let ok = false;
      await rodar(async () => {
        const m = await capturarUrl(url);
        refresh(); avisar('success', 'Página guardada', m.titulo); ok = true;
      }, 'Não consegui capturar essa URL');
      return ok;
    },

    importar: (arquivos: File[]) => arquivos.length === 0 ? Promise.resolve() : rodar(async () => {
      const notas: { titulo: string; conteudo: string }[] = [];
      let ignorados = 0;
      for (const f of arquivos) {
        if (f.size > MAX_ARQUIVO) { ignorados++; continue; }
        notas.push({ titulo: f.name.replace(/\.(md|markdown|txt)$/i, '').slice(0, 200) || 'sem título', conteudo: await f.text() });
      }
      let importadas = 0;
      for (let i = 0; i < notas.length; i += 50) importadas += (await importarNotas(notas.slice(i, i + 50))).importadas;
      refresh();
      avisar(importadas > 0 ? 'success' : 'info', `${importadas} nota(s) importada(s)`, ignorados ? `${ignorados} ignorada(s) por passar de 200 KB.` : undefined);
    }, 'Falha ao importar'),
  };
}
