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

const IDEIAS_DE_POST: { label: string; briefing: string; pilar: string }[] = [
  {
    "label": "A ponte infra e segurança",
    "briefing": "Conte como infraestrutura, DevOps e virtualização ajudam a pensar em segurança operacional. Use um exemplo profissional que eu confirmar; se faltar, deixe [CONFIRMAR: exemplo]. Diferencie experiência profissional de estudo e laboratório.",
    "pilar": "Infraestrutura, DevOps e virtualização aplicados à segurança"
  },
  {
    "label": "Depois da tentativa do AZ-104",
    "briefing": "Continue a conversa do meu post público sobre ter ficado a uma questão do AZ-104. Escreva um briefing para relatar apenas o que eu realmente revisei, pratiquei e aprendi depois da prova. Não suponha o resultado atual; use [CONFIRMAR: situação da certificação] e só informe aprovação se eu confirmar. Deixe campos para os tópicos e resultados.",
    "pilar": "Transição de carreira com evidências e próximos passos"
  },
  {
    "label": "Virtualização com olhar de segurança",
    "briefing": "Prepare um post de aprendizado sobre uma decisão concreta de virtualização e seu impacto em isolamento, atualização, recuperação ou controle de acesso. Pergunte qual decisão e evidência eu posso compartilhar; não invente topologia nem resultado.",
    "pilar": "Infraestrutura, DevOps e virtualização aplicados à segurança"
  },
  {
    "label": "Um lab, uma evidência",
    "briefing": "Estruture um post de Blue Team baseado em um lab que eu realmente executei: cenário autorizado, telemetria observada, detecção testada, evidência e limitação. Se os dados não estiverem no contexto, use [CONFIRMAR: dado]; não invente alerta nem resultado.",
    "pilar": "Labs e prática de Segurança da Informação"
  },
  {
    "label": "Uma decisão técnica",
    "briefing": "Conte uma decisão técnica real de infraestrutura ou segurança por meio de contexto, opções, trade-off e como validei a escolha. Remova nomes, endereços, segredos e detalhes que identifiquem organização ou ambiente.",
    "pilar": "Aprendizados de Blue Team e operações seguras"
  },
  {
    "label": "Construindo a SegInfo Study",
    "briefing": "Escolha uma decisão ou aprendizado documentado na construção da SegInfo Study. Explique problema, alternativas, decisão, limite e o que faria diferente. Evite autopromoção vazia: mostre evidência e uma lição reutilizável.",
    "pilar": "Construção da SegInfo Study e decisões técnicas"
  }
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
            <Chip key={i.label} label={i.label} icon="pi-sparkles"
              onClick={() => onGerarPost({ briefing: i.briefing, pilar: i.pilar, incluirDiario: true })} />

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
