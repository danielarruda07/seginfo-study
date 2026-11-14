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
import { Publicados, type RascunhoParaPublicar } from './linkedin/Publicados';
import { Diario } from './linkedin/Diario';
import { EstrategiaIA } from './linkedin/EstrategiaIA';
import '@/styles/telas/carreira.css';

/**
 * LinkedIn como ciclo de gestão do conhecimento, com tudo no servidor (API + PostgreSQL no Coolify):
 * Estúdio (expressar) ← Publicados (capturar + organizar com IA) ← Diário do projeto ← Estratégia.
 */
export function Posts() {
  const invalidate = useInvalidate();
  const { data: modo, isLoading } = useQuery({ queryKey: ['modo'], queryFn: detectMode });
  const [aba, setAba] = useState(0);
  const [pedidoEstudio, setPedidoEstudio] = useState<PedidoEstudio | null>(null);
  const [paraPublicar, setParaPublicar] = useState<RascunhoParaPublicar | null>(null);
  const [migracao, setMigracao] = useState<{ sev: 'success' | 'error'; text: string } | null>(null);

  const abrirEstudio = useCallback((p: PedidoEstudio) => { setPedidoEstudio(p); setAba(0); }, []);
  const registrarPublicacao = useCallback((r: RascunhoParaPublicar) => { setParaPublicar(r); setAba(1); }, []);
  const limparPedido = useCallback(() => setPedidoEstudio(null), []);
  const limparPrefill = useCallback(() => setParaPublicar(null), []);

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
        subtitle="Planeje seu posicionamento, transforme experiência e estudos em conteúdo e aprenda com cada conversa."
      />
      <ConfirmDialog />
      {migracao && <Message severity={migracao.sev} text={migracao.text} className="ca-w100 ca-mb" />}
      {isLoading ? (
        <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Verificando o servidor…</p>
      ) : modo !== 'servidor' ? (
        <Message severity="warn" className="ca-w100"
          text="O módulo LinkedIn guarda tudo no servidor (API + PostgreSQL no Coolify) e a API não respondeu. Em produção, confira o container seginfo-api; em desenvolvimento, rode npm run dev:api." />
      ) : (
        <TabView activeIndex={aba} onTabChange={(e) => setAba(e.index)} className="linkedin-tabs">
          <TabPanel header="Estúdio" leftIcon="pi pi-pencil mr-2">
            <Estudio pedido={pedidoEstudio} onPedidoConsumido={limparPedido} onPublicado={registrarPublicacao} />
          </TabPanel>
          <TabPanel header="Publicados" leftIcon="pi pi-linkedin mr-2">
            <Publicados prefill={paraPublicar} onPrefillConsumido={limparPrefill} onUsarIdeia={abrirEstudio} />
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
