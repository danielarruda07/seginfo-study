import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { POST_TEMPLATES } from '@/data/postTemplates';
import { listTopicos } from '@/services/catalog';
import {
  checklistPost, criarRascunho, editarRascunho, FORMATOS, gerarRascunho, getEstrategia, listRascunhos,
  mensagemErro, removerRascunho, riscosDePublicacao, statusIA, type Rascunho, type RascunhoIA,
} from '@/services/linkedin';
import { confirmDialog } from 'primereact/confirmdialog';
import { Rascunhos } from './Rascunhos';
import { tomChecklist } from './regras';
import { buscarMemorias } from '@/services/cerebro';
import { useInvalidate } from '@/hooks/useInvalidate';
import { copyToClipboard } from '@/lib/clipboard';
import type { RascunhoParaPublicar } from './Publicados';

/** Pedido vindo de outra aba: uma ideia derivada ou "post sobre o projeto". */
export interface PedidoEstudio {
  briefing: string;
  pilar?: string;
  incluirDiario?: boolean;
}

export function Estudio({ pedido, onPedidoConsumido, onPublicado }: {
  pedido: PedidoEstudio | null;
  onPedidoConsumido: () => void;
  onPublicado: (r: RascunhoParaPublicar) => void;
}) {
  const invalidate = useInvalidate();
  const { data: rascunhos = [] } = useQuery({ queryKey: ['linkedin-rascunhos'], queryFn: listRascunhos });
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useQuery({ queryKey: ['ia-status'], queryFn: statusIA });

  // editor
  const [titulo, setTitulo] = useState('');
  const [gancho, setGancho] = useState('');
  const [corpo, setCorpo] = useState('');
  const [topicoId, setTopicoId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const topicOptions = listTopicos({ rows: 1000 }).items.map((t) => ({ label: t.titulo, value: t.id }));

  // IA
  const [briefing, setBriefing] = useState('');
  const [pilar, setPilar] = useState<string | undefined>();
  const [formato, setFormato] = useState<string>('texto');
  const [incluirDiario, setIncluirDiario] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [sugestao, setSugestao] = useState<(RascunhoIA & { notasUsadas: number }) | null>(null);

  useEffect(() => {
    if (!pedido) return;
    setBriefing(pedido.briefing);
    setPilar(pedido.pilar);
    setIncluirDiario(!!pedido.incluirDiario);
    onPedidoConsumido();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pedido, onPedidoConsumido]);

  function limpar() { setTitulo(''); setGancho(''); setCorpo(''); setTopicoId(undefined); setEditingId(null); setSugestao(null); }

  function aplicarTemplate(id: string) {
    const t = POST_TEMPLATES.find((x) => x.id === id);
    if (t) { setTitulo(t.titulo); setGancho(t.gancho); setCorpo(t.corpo); }
  }

  async function salvar() {
    if (!titulo.trim()) return;
    setErro('');
    try {
      if (editingId) await editarRascunho(editingId, { titulo, gancho, corpo, topicoId: topicoId ?? null });
      else await criarRascunho({ titulo, gancho, corpo, topicoId });
      limpar();
      invalidate('linkedin-rascunhos');
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  function copiar(g: string, c: string) {
    const texto = `${g}\n\n${c}`;
    const riscos = riscosDePublicacao(texto);
    if (riscos.length && !window.confirm(`O texto pode expor ${riscos.join(', ')}. Revise antes de publicar. Copiar mesmo assim?`)) return;
    copyToClipboard(texto);
  }

  async function gerar() {
    if (!briefing.trim()) return;
    setGerando(true); setErroIA(''); setSugestao(null);
    try {
      // só notas PESSOAIS do Segundo Cérebro, e nenhuma que cite IP/host/segredo
      let notas: { titulo: string; trecho: string }[] = [];
      try {
        const achados = await buscarMemorias(briefing.slice(0, 200));
        notas = achados
          .filter((n) => n.escopo === 'pessoal' && riscosDePublicacao(`${n.titulo}\n${n.trecho}`).length === 0)
          .slice(0, 5)
          .map((n) => ({ titulo: n.titulo, trecho: n.trecho }));
      } catch { /* sem cérebro, segue só com a jornada */ }
      const r = await gerarRascunho({ briefing, pilar, formato, incluirDiario, notas });
      setSugestao({ ...r, notasUsadas: notas.length });
      setEditingId(null);
      setTitulo(r.titulo);
      setGancho(r.gancho);
      setCorpo(`${r.corpo.trim()}\n\n${r.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`);
    } catch (e) {
      setErroIA(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function marcarPublicado(r: { id: string; gancho: string; corpo: string }) {
    try {
      await editarRascunho(r.id, { publicado: true });
      invalidate('linkedin-rascunhos');
      onPublicado({ texto: `${r.gancho}\n\n${r.corpo}`.trim() });
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  function excluir(r: Rascunho) {
    confirmDialog({
      header: 'Excluir rascunho', message: <span>Excluir o rascunho <strong>{r.titulo}</strong>? Não dá para desfazer.</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try { await removerRascunho(r.id); if (editingId === r.id) limpar(); invalidate('linkedin-rascunhos'); }
        catch (e) { setErro(mensagemErro(e)); }
      },
    });
  }

  function editar(p: Rascunho) {
    setEditingId(p.id); setTitulo(p.titulo); setGancho(p.gancho); setCorpo(p.corpo); setTopicoId(p.topicoId ?? undefined); setSugestao(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const checklist = checklistPost(gancho, corpo);
  const riscos = riscosDePublicacao(`${gancho}\n${corpo}`);
  const nota = checklist.filter((c) => c.ok).length;
  const iaPronta = !!ia?.configurada;

  return (
    <div>
      <StatusStrip tone="ok" icon="pi-linkedin">
        {rascunhos.length} rascunhos no servidor. Escreva à mão, parta de um modelo ou peça um rascunho à IA com o contexto da sua jornada.
      </StatusStrip>

      <section className="iv-card iv-mt">
        <div className="ca-toolbar">
          <h3 className="ca-h3"><i className="pi pi-sparkles" aria-hidden="true" /> Rascunho com IA</h3>
          <Pill label={iaPronta ? 'IA pronta' : 'IA não configurada'} tone={iaPronta ? 'ok' : 'muted'} />
        </div>
        {ia && !iaPronta && (
          <p className="iv-muted ca-small">Defina o Secret <code>ANTHROPIC_API_KEY</code> na API no Coolify (veja a aba Estratégia & IA).</p>
        )}
        <div className="iv-col iv-gap iv-mt">
          <InputTextarea value={briefing} onChange={(e) => setBriefing(e.target.value)} rows={3} autoResize
            aria-label="Briefing do post" placeholder="Sobre o que é o post? Ex.: o que aprendi montando um honeypot e analisando as primeiras tentativas de login." />
          <div className="iv-row iv-wrap iv-gap">
            <Dropdown value={pilar} options={estrategia?.pilares ?? []} onChange={(e) => setPilar(e.value)} placeholder="Pilar (a IA escolhe)" ariaLabel="Pilar" showClear style={{ minWidth: 240 }} />
            <Dropdown value={formato} options={[...FORMATOS]} onChange={(e) => setFormato(e.value)} ariaLabel="Formato" style={{ minWidth: 140 }} />
            <label className="iv-row ca-small">
              <Checkbox checked={incluirDiario} onChange={(e) => setIncluirDiario(!!e.checked)} />
              Usar o diário do projeto (posts sobre a SegInfo)
            </label>
            <Button label={gerando ? 'Gerando...' : 'Gerar rascunho'} icon="pi pi-sparkles" loading={gerando} disabled={!iaPronta || briefing.trim().length < 5} onClick={gerar} />
          </div>
          {erroIA && <Message severity="error" text={erroIA} className="ca-w100" />}
          {sugestao && (
            <Message severity="info" className="ca-w100" content={
              <div className="ca-small">
                <div><strong>Por que funciona:</strong> {sugestao.porQueFunciona}</div>
                {sugestao.dadosParaConfirmar.length > 0 && <div className="iv-mt"><strong>Confira antes de publicar:</strong> {sugestao.dadosParaConfirmar.join(' · ')}</div>}
                <div className="iv-muted iv-mt">Contexto usado: estratégia, estudo, histórico de posts{incluirDiario ? ', diário do projeto' : ''}{sugestao.notasUsadas ? `, ${sugestao.notasUsadas} notas do Segundo Cérebro` : ''}. O rascunho já está no editor abaixo.</div>
              </div>
            } />
          )}
        </div>
      </section>

      <div className="posts-workspace iv-mt">
        <section className="iv-card posts-editor">
          <div className="ca-toolbar">
            <h3 className="ca-h3">{editingId ? 'Editar rascunho' : 'Editor'}</h3>
            {(editingId || titulo || corpo) && <Button label="Limpar" text onClick={limpar} />}
          </div>
          <div className="posts-title-row iv-mt">
            <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título interno do post" aria-label="Título interno do post" />
            <Dropdown value={topicoId} options={topicOptions} onChange={(e) => setTopicoId(e.value)} placeholder="Tópico relacionado (opcional)" ariaLabel="Tópico relacionado" showClear filter />
          </div>
          <InputText value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="Gancho (primeira linha, o que prende a atenção)" aria-label="Gancho" />
          <InputTextarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={12} autoResize placeholder="Desenvolva a ideia, o que aprendeu e como aplicou..." aria-label="Corpo do post" />
          <div className="iv-row iv-wrap">
            <Button label={editingId ? 'Atualizar rascunho' : 'Salvar rascunho'} icon="pi pi-save" onClick={salvar} disabled={!titulo.trim()} />
            <Button label="Copiar texto" icon="pi pi-copy" outlined onClick={() => copiar(gancho, corpo)} />
          </div>
          {erro && <Message severity="error" text={erro} className="ca-w100" />}
        </section>

        <aside className="posts-aside">
          <section className="iv-card">
            <div className="ca-toolbar">
              <h3 className="ca-h3">Checklist do post</h3>
              <Pill label={`${nota}/${checklist.length}`} tone={tomChecklist(nota)} />
            </div>
            <ul className="linkedin-checklist">
              {checklist.map((c) => (
                <li key={c.id} title={c.dica}>
                  <i className={`pi ${c.ok ? 'pi-check-circle ca-ok' : 'pi-circle iv-muted'}`} aria-hidden="true" />
                  <span><strong>{c.label}</strong>{!c.ok && <span className="iv-muted"> — {c.dica}</span>}</span>
                </li>
              ))}
            </ul>
            {riscos.length > 0 && <Message severity="warn" className="ca-w100" text={`Pode expor: ${riscos.join(', ')}.`} />}
          </section>
          <section className="iv-card posts-preview" aria-live="polite">
            <div className="ca-toolbar"><h3 className="ca-h3">Prévia</h3><Pill label="LinkedIn" /></div>
            <strong>{gancho || 'Seu gancho aparece aqui'}</strong>
            <p className="iv-muted ca-pre ca-mb0">{corpo || 'A prévia acompanha o texto enquanto você escreve.'}</p>
          </section>
          <section className="iv-card">
            <h3 className="ca-h3 ca-mb">Modelos</h3>
            <div className="posts-template-list">
              {POST_TEMPLATES.map((t) => <Chip key={t.id} label={t.titulo} icon="pi-copy" onClick={() => aplicarTemplate(t.id)} />)}
            </div>
          </section>
        </aside>
      </div>

      <Rascunhos rascunhos={rascunhos} onEditar={editar} onCopiar={(r) => copiar(r.gancho, r.corpo)} onMarcarPublicado={marcarPublicado} onExcluir={excluir} />
    </div>
  );
}
