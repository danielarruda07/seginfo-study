import type { BiblioItem, EstadoLeitura } from '@seginfo/shared';
import { read, write, uid } from './store';
import { processar, metadadosDaUrl } from './textProcess';
import { http } from './http';

const KEY = 'biblioteca';

export interface ExtractResponse {
  url: string;
  finalUrl: string;
  dominio: string;
  titulo: string;
  descricao: string;
  texto: string;
}

/**
 * Opção B: busca a página pelo apps/api (resolve CORS). Se a API não estiver no
 * ar, lança — a UI cai no fluxo manual (colar o texto).
 */
export async function buscarUrl(url: string): Promise<ExtractResponse> {
  const { data } = await http.post<ExtractResponse>('/extract', { url });
  return data;
}

function base(): BiblioItem[] {
  return read<BiblioItem[]>(KEY, []);
}

export interface BiblioFiltro {
  search?: string;
  categoria?: string;
  estado?: EstadoLeitura;
  favorito?: boolean;
}

export function listBiblio(f: BiblioFiltro = {}): BiblioItem[] {
  let items = [...base()];
  const search = (f.search ?? '').trim().toLowerCase();
  if (f.categoria) items = items.filter((i) => i.categoria === f.categoria);
  if (f.estado) items = items.filter((i) => i.estado === f.estado);
  if (f.favorito) items = items.filter((i) => i.favorito);
  if (search) {
    items = items.filter(
      (i) => i.titulo.toLowerCase().includes(search) || i.resumo.toLowerCase().includes(search) ||
        i.url.toLowerCase().includes(search) || i.palavrasChave.some((k) => k.includes(search)) ||
        i.tags.some((t) => t.includes(search)),
    );
  }
  return items.sort((a, b) => Number(b.favorito) - Number(a.favorito) || b.criadoEm.localeCompare(a.criadoEm));
}

export function getBiblio(id: string): BiblioItem | undefined {
  return base().find((i) => i.id === id);
}

/**
 * Salva uma URL. Se vier `texto`, processa localmente (resumo + keywords + categoria).
 * Sem texto, extrai o que der da própria URL (domínio + título provável).
 */
export function salvarUrl(input: { url: string; titulo?: string; texto?: string; id?: string }): BiblioItem {
  const all = base();
  const now = new Date().toISOString();
  const meta = metadadosDaUrl(input.url);
  const texto = (input.texto ?? '').trim();
  const proc = texto ? processar(texto) : null;

  const existing = input.id ? all.find((i) => i.id === input.id) : undefined;
  const item: BiblioItem = {
    id: input.id || uid(),
    url: input.url,
    titulo: input.titulo?.trim() || existing?.titulo || meta.tituloProvavel,
    dominio: meta.dominio,
    textoOriginal: texto || existing?.textoOriginal || '',
    resumo: proc?.resumo || existing?.resumo || '',
    palavrasChave: proc?.palavrasChave || existing?.palavrasChave || [],
    categoria: proc?.categoria || existing?.categoria || 'geral',
    tags: proc?.tagsSugeridas || existing?.tags || [],
    estado: existing?.estado ?? 'para_ler',
    favorito: existing?.favorito ?? false,
    anotacoes: existing?.anotacoes ?? '',
    topicoId: existing?.topicoId,
    fonteResumo: 'local',
    criadoEm: existing?.criadoEm ?? now,
    atualizadoEm: now,
  };

  const idx = all.findIndex((i) => i.id === item.id);
  if (idx >= 0) all[idx] = item; else all.unshift(item);
  write(KEY, all);
  return item;
}

export function updateBiblio(id: string, patch: Partial<BiblioItem>): void {
  const all = base();
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch, atualizadoEm: new Date().toISOString() };
  write(KEY, all);
}

export function removeBiblio(id: string): void {
  write(KEY, base().filter((i) => i.id !== id));
}

export function toggleFavoritoBiblio(id: string): void {
  const item = base().find((i) => i.id === id);
  if (item) updateBiblio(id, { favorito: !item.favorito });
}

export function reprocessar(id: string): void {
  const item = base().find((i) => i.id === id);
  if (!item || !item.textoOriginal) return;
  const proc = processar(item.textoOriginal);
  updateBiblio(id, { resumo: proc.resumo, palavrasChave: proc.palavrasChave, categoria: proc.categoria, tags: proc.tagsSugeridas });
}

export function resumoBiblio() {
  const all = base();
  const porCategoria: Record<string, number> = {};
  for (const i of all) porCategoria[i.categoria] = (porCategoria[i.categoria] ?? 0) + 1;
  return {
    total: all.length,
    paraLer: all.filter((i) => i.estado === 'para_ler').length,
    lidos: all.filter((i) => i.estado === 'lido').length,
    favoritos: all.filter((i) => i.favorito).length,
    porCategoria,
  };
}
