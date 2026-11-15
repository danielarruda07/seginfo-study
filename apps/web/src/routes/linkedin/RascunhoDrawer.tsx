import { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { confirmDialog } from 'primereact/confirmdialog';
import { preflightLiberado, textoDoPost, type ProjetoLinkedin, type RascunhoLinkedin } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { getTopico } from '@/services/catalog';
import { ativosCitados, mensagemErro, preflightLocal, removerRascunho } from '@/services/linkedin';
import { aprovarRascunho, desagendarRascunho, publicarRascunhoAgora, voltarParaRascunho } from '@/services/linkedinPipeline';
import { copiarPost, detalheDoErro } from './dados';
import { CANAL_CURTO, STATUS_META, dataHoraCurta, fusoDoNavegador, nomeDoProjeto } from './pipelineRegras';
import { PreflightLista } from './PreflightLista';
import { Versoes } from './Versoes';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha do rascunho no pipeline: texto, verificação, ações do estado atual e histórico de versões. */
export function RascunhoDrawer({ rascunho: r, nav, projetos, contaConectada, onEditar, onAgendar, onRegistrar, onVerPublicados, onMudou }: {
  rascunho: RascunhoLinkedin; nav: Nav; projetos: ProjetoLinkedin[]; contaConectada: boolean;
  onEditar: () => void; onAgendar: () => void; onRegistrar: () => void; onVerPublicados: () => void;
  /** algo mudou no servidor: recarregar as listas */
  onMudou: () => void;
}) {
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setErro(''); setBloqueios([]); }, [r.id, r.status]);

  const fuso = fusoDoNavegador();
  const meta = STATUS_META[r.status];
  const projeto = nomeDoProjeto(projetos, r.projetoId);
  const preflight = preflightLocal(r.gancho, r.corpo);
  const liberado = preflightLiberado(preflight);
  const podeApi = contaConectada && r.formato === 'texto';
  const motivoApi = !contaConectada ? 'Conecte o LinkedIn na aba "Marca pessoal & IA".' : r.formato !== 'texto' ? 'A API publica só texto por enquanto.' : undefined;

  async function executar(rotulo: string, acao: () => Promise<unknown>) {
    setOcupado(rotulo); setErro(''); setBloqueios([]);
    try { await acao(); onMudou(); }
    catch (e) { setErro(mensagemErro(e)); setBloqueios(detalheDoErro(e).bloqueios ?? []); }
    finally { setOcupado(''); }
  }

  const aprovar = () => executar('Aprovando…', () => aprovarRascunho(r.id, ativosCitados(textoDoPost(r.gancho, r.corpo))));
  const voltar = () => executar('Voltando…', () => voltarParaRascunho(r.id));
  const desagendar = () => executar('Desagendando…', () => desagendarRascunho(r.id));
  function copiar() { if (copiarPost(r.gancho, r.corpo)) { setCopiado(true); setTimeout(() => setCopiado(false), 2000); } }

  function publicarAgora() {
    confirmDialog({
      header: 'Publicar agora no LinkedIn',
      message: <span>O servidor publica <strong>{r.titulo}</strong> no seu perfil agora, como post público.<br /><small className="iv-muted">Não dá para desfazer por aqui: para apagar, só no LinkedIn.</small></span>,
      icon: 'pi pi-send', acceptLabel: 'Publicar agora', rejectLabel: 'Cancelar',
      accept: () => executar('Publicando…', () => publicarRascunhoAgora(r.id)),
    });
  }
  function excluir() {
    confirmDialog({
      header: 'Excluir rascunho', message: <span>Excluir o rascunho <strong>{r.titulo}</strong> e o histórico de versões? Não dá para desfazer.</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => executar('Excluindo…', () => removerRascunho(r.id)),
    });
  }

  const btnCopiar = <Button label={copiado ? 'Copiado!' : 'Copiar texto'} icon="pi pi-copy" size="small" outlined onClick={copiar} />;
  const btnRegistrar = <Button label="Publiquei: registrar" icon="pi pi-link" size="small" outlined onClick={onRegistrar} />;
  const btnPublicar = <Button label="Publicar agora" icon="pi pi-send" size="small" outlined disabled={!podeApi || !!ocupado} onClick={publicarAgora}
    tooltip={motivoApi} tooltipOptions={{ showOnDisabled: true, position: 'bottom' }} />;
  const btnVoltar = <Button label="Voltar para rascunho" icon="pi pi-undo" size="small" text disabled={!!ocupado} onClick={voltar} />;

  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-file-edit', label: 'Post no pipeline' }} ariaLabel={`Ficha do rascunho ${r.titulo}`}
      status={<>
        <Pill label={meta.label} tone={meta.tone} icon={meta.icon} />
        {r.agendadoPara && r.status !== 'publicado' && <Pill label={`${dataHoraCurta(r.agendadoPara, fuso)} · ${CANAL_CURTO[r.canal]}`} icon="pi-clock" />}
        <Pill label={r.formato} />
        {projeto && <Pill label={projeto} icon="pi-folder" />}
        {ocupado && <span className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> {ocupado}</span>}
      </>}
      title={r.titulo}
      subtitle={r.topicoId ? `Tópico: ${getTopico(r.topicoId)?.titulo ?? r.topicoId}` : 'Sem tópico relacionado'}
      actions={<>
        {r.status === 'rascunho' && <>
          <Button label="Editar no Estúdio" icon="pi pi-pencil" size="small" onClick={onEditar} />
          <Button label="Aprovar" icon="pi pi-check" size="small" outlined disabled={!liberado || !!ocupado} onClick={aprovar}
            tooltip={liberado ? undefined : 'Resolva os itens que bloqueiam na verificação abaixo.'} tooltipOptions={{ showOnDisabled: true, position: 'bottom' }} />
          {btnCopiar}
          <Button label="Excluir" icon="pi pi-trash" size="small" text severity="danger" onClick={excluir} />
        </>}
        {r.status === 'aprovado' && <>
          <Button label="Agendar" icon="pi pi-calendar-plus" size="small" onClick={onAgendar} />
          {btnPublicar}{btnRegistrar}{btnCopiar}{btnVoltar}
        </>}
        {r.status === 'agendado' && <>
          <Button label="Reagendar" icon="pi pi-calendar" size="small" onClick={onAgendar} />
          <Button label="Desagendar" icon="pi pi-calendar-minus" size="small" outlined disabled={!!ocupado} onClick={desagendar} />
          {btnPublicar}{btnRegistrar}{btnCopiar}
        </>}
        {r.status === 'falhou' && <>
          <Button label="Reagendar" icon="pi pi-calendar" size="small" onClick={onAgendar} />
          {btnRegistrar}{btnCopiar}{btnVoltar}
        </>}
        {r.status === 'publicado' && <>
          <Button label="Ver em Publicados" icon="pi pi-linkedin" size="small" onClick={onVerPublicados} />
          {btnCopiar}
        </>}
      </>}>
      {r.status === 'publicando' && <p className="ca-aviso" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> O servidor está publicando este post. Aguarde alguns segundos e atualize.</p>}
      {r.status === 'falhou' && <p className="ca-aviso" role="alert"><i className="pi pi-times-circle" aria-hidden="true" /> A publicação falhou{r.tentativas ? ` (${r.tentativas} tentativa${r.tentativas > 1 ? 's' : ''})` : ''}: {r.ultimoErro || 'sem detalhe.'} Antes de tentar de novo, confira no LinkedIn se o post não saiu.</p>}
      {erro && <p className="ca-aviso" role="alert"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> {erro}{bloqueios.length > 0 && <> Bloqueios: {bloqueios.join('; ')}.</>}</p>}

      <section>
        <h3 className="iv-section-label">Texto</h3>
        <div className="ca-texto"><strong>{r.gancho}</strong>{'\n\n'}{r.corpo}</div>
      </section>
      {r.status !== 'publicado' && (
        <section>
          <h3 className="iv-section-label">Verificação antes de liberar</h3>
          <PreflightLista itens={preflight} />
        </section>
      )}
      {(r.direcaoVisual || r.roteiroSlides || r.textoAlternativo) && (
        <section>
          <h3 className="iv-section-label">Material visual</h3>
          {r.roteiroSlides && <div className="ca-texto"><strong>Roteiro do carrossel</strong>{'\n'}{r.roteiroSlides}</div>}
          {r.direcaoVisual && <div className="ca-texto iv-mt"><strong>Direção visual</strong>{'\n'}{r.direcaoVisual}</div>}
          {r.textoAlternativo && <p className="iv-muted ca-small"><strong>Texto alternativo:</strong> {r.textoAlternativo}</p>}
        </section>
      )}
      <section>
        <h3 className="iv-section-label">Dados</h3>
        <DetailFields items={[
          ['Caracteres', `${textoDoPost(r.gancho, r.corpo).length} de 3.000`],
          ['Projeto', projeto ?? ''],
          ['Aprovado em', r.aprovadoEm ? dataHoraCurta(r.aprovadoEm, fuso) : ''],
          ['Agendado para', r.agendadoPara ? `${dataHoraCurta(r.agendadoPara, fuso)} (${CANAL_CURTO[r.canal]})` : ''],
          ['Publicado em', r.publicadoEm ? dataHoraCurta(r.publicadoEm, fuso) : ''],
          ['Atualizado em', dataHoraCurta(r.atualizadoEm, fuso)],
        ]} />
      </section>
      <section>
        <h3 className="iv-section-label">Versões</h3>
        <Versoes rascunho={r} onRestaurada={onMudou} />
      </section>
    </DetailDrawer>
  );
}
