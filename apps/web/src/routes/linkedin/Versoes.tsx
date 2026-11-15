import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { confirmDialog } from 'primereact/confirmdialog';
import type { RascunhoLinkedin, VersaoRascunho } from '@seginfo/shared';
import { ROTULO_REFINO, type AcaoRefino } from '@seginfo/shared';
import { mensagemErro } from '@/services/linkedin';
import { listVersoes, restaurarVersao } from '@/services/linkedinPipeline';
import { dataHoraCurta, fusoDoNavegador } from './pipelineRegras';

/** "ia:encurtar" → "IA: Encurtar"; "restaurar:3" → "Restaurada da versão 3". */
export function rotuloDaOrigem(origem: string): string {
  if (origem === 'manual') return 'Edição manual';
  if (origem === 'ia:gerar') return 'IA: rascunho gerado';
  if (origem.startsWith('ia:')) return `IA: ${ROTULO_REFINO[origem.slice(3) as AcaoRefino] ?? origem.slice(3)}`;
  if (origem.startsWith('restaurar:')) return `Restaurada da versão ${origem.slice(10)}`;
  return origem;
}

/** Histórico do texto do rascunho. Restaurar cria uma versão nova com o texto antigo (nada se perde). */
export function Versoes({ rascunho, onRestaurada }: { rascunho: RascunhoLinkedin; onRestaurada: () => void }) {
  const { data: versoes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['linkedin-versoes', rascunho.id, rascunho.atualizadoEm],
    queryFn: () => listVersoes(rascunho.id),
  });
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const fuso = fusoDoNavegador();
  const bloqueado = rascunho.status === 'publicando' || rascunho.status === 'publicado';

  function restaurar(v: VersaoRascunho) {
    confirmDialog({
      header: `Restaurar a versão ${v.numero}`,
      message: 'O texto atual vira mais uma versão no histórico e o rascunho volta para "rascunho" se estava aprovado ou agendado.',
      icon: 'pi pi-history', acceptLabel: 'Restaurar', rejectLabel: 'Cancelar',
      accept: async () => {
        setErro('');
        try { await restaurarVersao(rascunho.id, v.id); onRestaurada(); void refetch(); }
        catch (e) { setErro(mensagemErro(e)); }
      },
    });
  }

  if (isLoading) return <p className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando versões…</p>;
  if (error) return <p className="ca-aviso" role="alert"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> {mensagemErro(error)}</p>;
  if (versoes.length === 0) return <p className="iv-muted ca-small">Sem histórico ainda: cada mudança de texto salva vira uma versão.</p>;

  return (
    <>
      {erro && <p className="ca-aviso" role="alert"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> {erro}</p>}
      <ul className="lp-versoes">
        {versoes.map((v, i) => (
          <li key={v.id}>
            <div className="lp-versoes__linha">
              <span><strong>v{v.numero}</strong> · {rotuloDaOrigem(v.origem)} <span className="iv-muted">· {dataHoraCurta(v.criadoEm, fuso)}{i === 0 ? ' · atual' : ''}</span></span>
              <span className="iv-row">
                <Button label={aberta === v.id ? 'Ocultar' : 'Ver'} text size="small" onClick={() => setAberta(aberta === v.id ? null : v.id)} aria-expanded={aberta === v.id} />
                {i > 0 && !bloqueado && <Button label="Restaurar" icon="pi pi-history" text size="small" onClick={() => restaurar(v)} />}
              </span>
            </div>
            {aberta === v.id && <div className="ca-texto"><strong>{v.gancho}</strong>{'\n\n'}{v.corpo}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
