import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import type { CategoriaDiario } from '@seginfo/shared';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { ClickCard } from '@/components/ui/ClickCard';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { CATEGORIA_DIARIO_LABEL, diarioEmMarkdown, juntarDiario, listDiarioServidor, mensagemErro, removeDiario } from '@/services/linkedin';
import { copyToClipboard } from '@/lib/clipboard';
import type { PedidoEstudio } from './Estudio';
import { CATEGORIA_COR, briefingDoMarco } from './regras';
import { NovoMarco } from './NovoMarco';
import { MarcoDrawer } from './MarcoDrawer';

const PILAR_PROJETO = 'Construindo a SegInfo Study em público';

const IDEIAS_DE_POST: { label: string; briefing: string }[] = [
  { label: 'A história completa', briefing: 'Post contando a construção da SegInfo Study do zero até hoje: por que comecei, as principais decisões de segurança e o que aprendi.' },
  { label: 'Decisões de segurança', briefing: 'Post sobre as decisões de segurança que tomei construindo minha própria plataforma de estudos (cofre cifrado, backup que o servidor não lê, dados corporativos fora).' },
  { label: 'Erros e lições', briefing: 'Post honesto sobre os erros e lições ao construir a SegInfo Study — o que eu faria diferente.' },
  { label: 'Próximo capítulo: pentest', briefing: 'Post anunciando que minha plataforma de estudos vai virar alvo autorizado de pentest no meu homelab, e o que pretendo aprender com isso.' },
];

export function Diario({ onGerarPost }: { onGerarPost: (p: PedidoEstudio) => void }) {
  const invalidate = useInvalidate();
  const { data: doServidor = [], error } = useQuery({ queryKey: ['linkedin-diario'], queryFn: listDiarioServidor });
  const entradas = useMemo(() => juntarDiario(doServidor), [doServidor]);
  const [filtro, setFiltro] = useState<CategoriaDiario | undefined>();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');
  const visiveis = useMemo(() => (filtro ? entradas.filter((e) => e.categoria === filtro) : entradas), [entradas, filtro]);
  const sel = useDrawerSelection(visiveis);

  function remover(id: string, titulo: string) {
    confirmDialog({
      header: 'Remover marco', message: <span>Remover <strong>{titulo}</strong> do diário?</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try { await removeDiario(id); sel.close(); invalidate('linkedin-diario'); }
        catch (e) { setErro(mensagemErro(e)); }
      },
    });
  }

  return (
    <div>
      <StatusStrip tone="ok" icon="pi-book">
        {entradas.length} marcos da construção da SegInfo Study: a matéria-prima do post sobre o projeto. O assistente de desenvolvimento registra cada mudança relevante no código; os seus ficam no banco.
      </StatusStrip>
      {error && <Message severity="error" text={mensagemErro(error)} className="ca-msg" />}

      <div className="iv-card iv-mt">
        <div className="ca-toolbar">
          <h3 className="ca-h3">Transformar em post</h3>
          <Button label={copiado ? 'Copiado!' : 'Copiar diário (Markdown)'} icon="pi pi-copy" outlined size="small"
            onClick={() => { copyToClipboard(diarioEmMarkdown(entradas)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} />
        </div>
        <div className="iv-row iv-wrap iv-mt">
          {IDEIAS_DE_POST.map((i) => (
            <Chip key={i.label} label={i.label} icon="pi-sparkles" onClick={() => onGerarPost({ briefing: i.briefing, pilar: PILAR_PROJETO, incluirDiario: true })} />
          ))}
        </div>
        <p className="iv-muted ca-small ca-mb0">Abre o Estúdio com o briefing pronto e o diário como contexto. Para um post sobre um marco só, abra o marco.</p>
      </div>

      <NovoMarco onErro={setErro} />
      {erro && <Message severity="error" text={erro} className="ca-msg" />}

      <div className="iv-row iv-wrap iv-mt" role="group" aria-label="Filtrar por categoria">
        <Chip label={`Tudo (${entradas.length})`} active={!filtro} onClick={() => setFiltro(undefined)} />
        {(Object.keys(CATEGORIA_DIARIO_LABEL) as CategoriaDiario[]).map((c) => (
          <Chip key={c} label={CATEGORIA_DIARIO_LABEL[c]} active={filtro === c} onClick={() => setFiltro(filtro === c ? undefined : c)} />
        ))}
      </div>

      <ol className="linkedin-timeline ca-timeline iv-mt">
        {visiveis.map((e) => (
          <ClickCard key={e.id} as="li" onOpen={() => sel.open(e.id)} selected={sel.isOpen(e.id)} label={`Abrir marco: ${e.titulo}`}
            style={{ ['--cor' as string]: CATEGORIA_COR[e.categoria] }}>
            <div className="ca-post__meta">
              <span className="iv-muted">{e.data}</span>
              <Pill label={CATEGORIA_DIARIO_LABEL[e.categoria]} color={CATEGORIA_COR[e.categoria]} />
              {e.origem === 'voce' && <Pill label="seu registro" icon="pi-user" />}
            </div>
            <strong className="ca-marco__titulo">{e.titulo}</strong>
            <p className="iv-muted ca-clamp-2 ca-marco__desc">{e.descricao}</p>
          </ClickCard>
        ))}
      </ol>

      {sel.item && (
        <MarcoDrawer marco={sel.item} nav={sel.nav}
          onGerarPost={() => { sel.close(); onGerarPost({ briefing: briefingDoMarco(sel.item!), pilar: PILAR_PROJETO, incluirDiario: true }); }}
          onRemover={sel.item.origem === 'voce' ? () => remover(sel.item!.id, sel.item!.titulo) : undefined} />
      )}
    </div>
  );
}
