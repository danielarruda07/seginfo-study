import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjetoLinkedin } from '@seginfo/shared';
import { copyToClipboard } from '@/lib/clipboard';
import { listPublicados, riscosDePublicacao, statusIA } from '@/services/linkedin';
import { listIdeias, listProjetos, listRascunhosPipeline, statusContaLinkedin } from '@/services/linkedinPipeline';

/** Consultas compartilhadas pelas abas do LinkedIn (mesmas chaves = um só cache no react-query). */
export const useRascunhos = () => useQuery({ queryKey: ['linkedin-rascunhos'], queryFn: listRascunhosPipeline });
export const useProjetos = () => useQuery({ queryKey: ['linkedin-projetos'], queryFn: listProjetos });
export const useIdeias = () => useQuery({ queryKey: ['linkedin-ideias'], queryFn: listIdeias });
export const usePublicados = () => useQuery({ queryKey: ['linkedin-publicados'], queryFn: listPublicados });
export const useContaLinkedin = () => useQuery({ queryKey: ['linkedin-conta'], queryFn: statusContaLinkedin });
export const useStatusIA = () => useQuery({ queryKey: ['ia-status'], queryFn: statusIA });

/** Opções para o Dropdown de projeto: ativos primeiro; pausados e concluídos continuam selecionáveis. */
export function useOpcoesDeProjeto(projetos: ProjetoLinkedin[]) {
  return useMemo(() => [...projetos]
    .sort((a, b) => Number(a.status !== 'ativo') - Number(b.status !== 'ativo') || a.nome.localeCompare(b.nome))
    .map((p) => ({ value: p.id, label: p.status === 'ativo' ? p.nome : `${p.nome} (${p.status === 'pausado' ? 'pausado' : 'concluído'})` })), [projetos]);
}

/** Copia o post; se o texto pode expor o ambiente, pede confirmação antes. Devolve se copiou. */
export function copiarPost(gancho: string, corpo: string): boolean {
  const texto = `${gancho}\n\n${corpo}`.trim();
  const riscos = riscosDePublicacao(texto);
  if (riscos.length && !window.confirm(`O texto pode expor ${riscos.join(', ')}. Revise antes de publicar. Copiar mesmo assim?`)) return false;
  copyToClipboard(texto);
  return true;
}

/** Corpo de erro da API quando o servidor recusa a aprovação (422) ou acusa conflito de agenda (409). */
export function detalheDoErro(e: unknown): { status?: number; bloqueios?: string[]; conflito?: boolean } {
  const r = (e as { response?: { status?: number; data?: { bloqueios?: string[]; conflito?: boolean } } }).response;
  return { status: r?.status, bloqueios: r?.data?.bloqueios, conflito: r?.data?.conflito };
}
