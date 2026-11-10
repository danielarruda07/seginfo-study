import { SessaoEstudoSchema, MetaSchema, PostIdeaSchema, type SessaoEstudo, type Meta, type PostIdea } from '@seginfo/shared';
import { collection, registerSchema } from './store';

registerSchema('sessoes', { safeParse: (v) => SessaoEstudoSchema.array().safeParse(v) });
registerSchema('metas', { safeParse: (v) => MetaSchema.array().safeParse(v) });
registerSchema('posts', { safeParse: (v) => PostIdeaSchema.array().safeParse(v) });

const sessoes = collection<SessaoEstudo>('sessoes');
const metas = collection<Meta>('metas');
const posts = collection<PostIdea>('posts');

// ---- Sessões de estudo ----
export function listSessoes(): SessaoEstudo[] {
  return sessoes.all().sort((a, b) => b.data.localeCompare(a.data));
}
export const addSessao = sessoes.add;
export const removeSessao = sessoes.remove;
export function totalMinutos(): number {
  return sessoes.all().reduce((acc, s) => acc + s.minutos, 0);
}

// ---- Metas ----
export function listMetas(): Meta[] {
  return metas.all().sort((a, b) => a.prazo.localeCompare(b.prazo));
}
export const addMeta = metas.add;
export const removeMeta = metas.remove;
export function toggleMeta(id: string): void {
  metas.update(id, (m) => ({ ...m, concluida: !m.concluida }));
}

// ---- Ideias de post ----
export const listPosts = posts.all;
export const addPost = posts.add;
export function updatePost(id: string, patch: Partial<PostIdea>): void {
  posts.update(id, (current) => ({ ...current, ...patch }));
}
export const removePost = posts.remove;
export function togglePost(id: string): void {
  posts.update(id, (p) => ({ ...p, publicado: !p.publicado }));
}
