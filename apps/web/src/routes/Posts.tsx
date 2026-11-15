import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabView, TabPanel } from 'primereact/tabview';
import { Message } from 'primereact/message';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { detectMode } from '@/services/mode';
import { mensagemErro, migrarDadosLocais } from '@/services/linkedin';
import { useInvalidate } from '@/hooks/useInvalidate';
import { Estudio, type PedidoEstudio } from './linkedin/Estudio';
import { Pipeline } from './linkedin/Pipeline';
import { Ideias } from './linkedin/Ideias';
import { Projetos } from './linkedin/Projetos';
import { Publicados } from './linkedin/Publicados';
import { Diario } from './linkedin/Diario';
import { EstrategiaIA } from './linkedin/EstrategiaIA';
import '@/styles/telas/carreira.css';
import '@/styles/telas/linkedin-pipeline.css';

const ABA = { pipeline: 0, estudio: 1, ideias: 2, projetos: 3, publicados: 4, diario: 5, marca: 6 } as const;
type Aviso = { sev: 'success' | 'error'; text: string };

/** Volta do OAuth do LinkedIn: `?linkedin=conectado` ou `?linkedin=erro`. Lê e limpa o parâmetro da URL. */
function retornoDoOAuth(): Aviso | null {
  const params = new URLSearchParams(window.location.search);
  const valor = params.get('linkedin');
  if (!valor) return null;
  params.delete('linkedin');
  const resto = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${resto ? `?${resto}` : ''}${window.location.hash}`);
  return valor === 'conectado'
    ? { sev: 'success', text: 'LinkedIn conectado. O servidor já pode publicar os posts de texto que você aprovar.' }
    : { sev: 'error', text: 'Não foi possível concluir a conexão com o LinkedIn. Tente de novo; se repetir, confira a URL de redirecionamento no app do LinkedIn.' };
}

/**
 * LinkedIn como ciclo de gestão do conhecimento, com tudo no servidor (API + PostgreSQL no Coolify):
 * Ideias e Projetos (o que falar) → Estúdio (escrever e refinar) → Pipeline (aprovar, agendar, publicar)
 * → Publicados (capturar + organizar com IA) ← Diário do projeto ← Marca pessoal e conexão.
 */
export function Posts() {
  const invalidate = useInvalidate();
  const { data: modo, isLoading } = useQuery({ queryKey: ['modo'], queryFn: detectMode });
  const [oauth] = useState(retornoDoOAuth);
  const [aba, setAba] = useState<number>(oauth ? ABA.marca : ABA.pipeline);
  const [pedidoEstudio, setPedidoEstudio] = useState<PedidoEstudio | null>(null);
  const [novaIdeiaNoProjeto, setNovaIdeiaNoProjeto] = useState<string | null>(null);
  const [migracao, setMigracao] = useState<Aviso | null>(null);

  const abrirEstudio = useCallback((p: PedidoEstudio) => { setPedidoEstudio(p); setAba(ABA.estudio); }, []);
  const editarRascunho = useCallback((rascunhoId: string) => abrirEstudio({ rascunhoId }), [abrirEstudio]);
  const limparPedido = useCallback(() => setPedidoEstudio(null), []);
  const limparNovaIdeia = useCallback(() => setNovaIdeiaNoProjeto(null), []);
  const irPara = useCallback((destino: keyof typeof ABA) => () => setAba(ABA[destino]), []);

  useEffect(() => { if (oauth?.sev === 'success') invalidate('linkedin-conta'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // uma vez: leva ao servidor o que tinha ficado no navegador (versão anterior do módulo)
  useEffect(() => {
    if (modo !== 'servidor') return;
    migrarDadosLocais()
      .then((r) => {
        if (!r) return;
        const partes = [
          r.posts && `${r.posts} posts publicados`, r.marcos && `${r.marcos} marcos do diário`,
          r.rascunhos && `${r.rascunhos} rascunhos`, r.estrategia && 'a estratégia',
        ].filter(Boolean);
        if (partes.length) setMigracao({ sev: 'success', text: `Enviado ao servidor: ${partes.join(', ')}. Uma cópia ficou no navegador por segurança.` });
        invalidate('linkedin-publicados', 'linkedin-diario', 'linkedin-estrategia', 'linkedin-rascunhos');
      })
      .catch((e) => setMigracao({ sev: 'error', text: `Não consegui enviar os dados locais ao servidor: ${mensagemErro(e)}` }));
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="LinkedIn"
        subtitle="Organize ideias por projeto, escreva e refine com a IA, aprove, agende e aprenda com cada post publicado."
      />
      <ConfirmDialog />
      {oauth && <Message severity={oauth.sev} text={oauth.text} className="ca-w100 ca-mb" />}
      {migracao && <Message severity={migracao.sev} text={migracao.text} className="ca-w100 ca-mb" />}
      {isLoading ? (
        <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Verificando o servidor…</p>
      ) : modo !== 'servidor' ? (
        <Message severity="warn" className="ca-w100"
          text="O módulo LinkedIn guarda tudo no servidor (API + PostgreSQL no Coolify) e a API não respondeu. Em produção, confira o container seginfo-api; em desenvolvimento, rode npm run dev:api." />
      ) : (
        <TabView activeIndex={aba} onTabChange={(e) => setAba(e.index)} className="linkedin-tabs" scrollable renderActiveOnly={false}>
          <TabPanel header="Pipeline" leftIcon="pi pi-send mr-2">
            <Pipeline onEditar={editarRascunho} onNovo={() => abrirEstudio({})} onVerPublicados={irPara('publicados')} onVerIdeias={irPara('ideias')} />
          </TabPanel>
          <TabPanel header="Estúdio" leftIcon="pi pi-pencil mr-2">
            <Estudio pedido={pedidoEstudio} onPedidoConsumido={limparPedido} onVerPipeline={irPara('pipeline')} />
          </TabPanel>
          <TabPanel header="Ideias" leftIcon="pi pi-lightbulb mr-2">
            <Ideias onEscrever={abrirEstudio} novaNoProjeto={novaIdeiaNoProjeto} onNovaConsumida={limparNovaIdeia} />
          </TabPanel>
          <TabPanel header="Projetos" leftIcon="pi pi-folder mr-2">
            <Projetos onNovaIdeia={(projetoId) => { setNovaIdeiaNoProjeto(projetoId); setAba(ABA.ideias); }} />
          </TabPanel>
          <TabPanel header="Publicados" leftIcon="pi pi-linkedin mr-2">
            <Publicados onUsarIdeia={abrirEstudio} />
          </TabPanel>
          <TabPanel header="Diário do projeto" leftIcon="pi pi-book mr-2">
            <Diario onGerarPost={abrirEstudio} />
          </TabPanel>
          <TabPanel header="Marca pessoal & IA" leftIcon="pi pi-compass mr-2">
            <EstrategiaIA />
          </TabPanel>
        </TabView>
      )}
    </div>
  );
}
