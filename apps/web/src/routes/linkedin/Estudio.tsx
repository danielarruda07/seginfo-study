import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FORMATOS_POST, type AcaoRefino, type FormatoPost, type RascunhoLinkedin, type RefinoIA } from '@seginfo/shared';
import { StatusStrip } from '@/components/InfraKit';
import { POST_TEMPLATES } from '@/data/postTemplates';
import { useInvalidate } from '@/hooks/useInvalidate';
import { listTopicos } from '@/services/catalog';
import { buscarMemorias } from '@/services/cerebro';
import { getEstrategia, mensagemErro, riscosDePublicacao } from '@/services/linkedin';
import { criarRascunhoPipeline, editarRascunhoPipeline, gerarRascunhoIA } from '@/services/linkedinPipeline';
import { copiarPost, useOpcoesDeProjeto, useProjetos, useRascunhos, useStatusIA } from './dados';
import { EstudioEditor, FORM_VAZIO, type FormEstudio } from './EstudioEditor';
import { EstudioIA, type PedidoIA, type SugestaoIA } from './EstudioIA';
import { EstudioLateral } from './EstudioLateral';
import { Refino, type UltimoRefino } from './Refino';

/** Pedido vindo de outra aba: abrir um rascunho existente ou começar um post novo com briefing pronto. */
export interface PedidoEstudio {
  rascunhoId?: string;
  briefing?: string;
  pilar?: string;
  incluirDiario?: boolean;
  ideiaId?: string | null;
  projetoId?: string | null;
  formato?: string;
}

const PEDIDO_VAZIO: PedidoIA = { briefing: '', pilar: undefined, incluirDiario: false };
const formatoValido = (f?: string): FormatoPost => ((FORMATOS_POST as readonly string[]).includes(f ?? '') ? (f as FormatoPost) : 'texto');

const formDe = (r: RascunhoLinkedin): FormEstudio => ({
  titulo: r.titulo, gancho: r.gancho, corpo: r.corpo, direcaoVisual: r.direcaoVisual ?? '', textoAlternativo: r.textoAlternativo ?? '',
  roteiroSlides: r.roteiroSlides ?? '', topicoId: r.topicoId ?? undefined, projetoId: r.projetoId ?? null, formato: formatoValido(r.formato),
});

/** Estúdio: escrever à mão, partir de um modelo ou pedir à IA; refinar; salvar no pipeline. */
export function Estudio({ pedido, onPedidoConsumido, onVerPipeline }: {
  pedido: PedidoEstudio | null;
  onPedidoConsumido: () => void;
  onVerPipeline: () => void;
}) {
  const invalidate = useInvalidate();
  const { data: rascunhos = [], isSuccess: rascunhosProntos } = useRascunhos();
  const { data: projetos = [] } = useProjetos();
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useStatusIA();
  const opcoesProjeto = useOpcoesDeProjeto(projetos);
  const topicos = useMemo(() => listTopicos({ rows: 1000 }).items.map((t) => ({ label: t.titulo, value: t.id })), []);

  const [form, setForm] = useState<FormEstudio>(FORM_VAZIO);
  const [editando, setEditando] = useState<RascunhoLinkedin | null>(null);
  const [ideiaId, setIdeiaId] = useState<string | null>(null);
  /** rótulo da próxima versão: quem fez a última mudança de texto */
  const [origem, setOrigem] = useState('manual');
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [pedidoIA, setPedidoIA] = useState<PedidoIA>(PEDIDO_VAZIO);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [sugestao, setSugestao] = useState<SugestaoIA | null>(null);
  const [antesDoRefino, setAntesDoRefino] = useState<{ form: FormEstudio; origem: string } | null>(null);
  const [ultimoRefino, setUltimoRefino] = useState<UltimoRefino | null>(null);

  function limpar() {
    setForm(FORM_VAZIO); setEditando(null); setIdeiaId(null); setOrigem('manual'); setSugestao(null);
    setAntesDoRefino(null); setUltimoRefino(null); setErro(''); setSalvo(false);
  }

  useEffect(() => {
    if (!pedido) return;
    if (pedido.rascunhoId) {
      if (!rascunhosProntos) return; // espera a lista chegar
      const r = rascunhos.find((x) => x.id === pedido.rascunhoId);
      limpar();
      if (r) { setForm(formDe(r)); setEditando(r); setIdeiaId(r.ideiaId); }
      else setErro('Não encontrei esse rascunho. Ele pode ter sido excluído.');
    } else {
      limpar();
      setPedidoIA({ briefing: pedido.briefing ?? '', pilar: pedido.pilar, incluirDiario: !!pedido.incluirDiario });
      setIdeiaId(pedido.ideiaId ?? null);
      setForm({ ...FORM_VAZIO, projetoId: pedido.projetoId ?? null, formato: formatoValido(pedido.formato) });
    }
    onPedidoConsumido();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pedido, rascunhosProntos]); // eslint-disable-line react-hooks/exhaustive-deps

  function campo<K extends keyof FormEstudio>(k: K, valor: FormEstudio[K]) {
    setForm((f) => ({ ...f, [k]: valor }));
    setSalvo(false);
    if (k === 'gancho' || k === 'corpo') setOrigem('manual');
  }

  function aplicarModelo(id: string) {
    const t = POST_TEMPLATES.find((x) => x.id === id);
    if (t) { setForm((f) => ({ ...f, titulo: t.titulo, gancho: t.gancho, corpo: t.corpo })); setOrigem('manual'); setSalvo(false); }
  }

  async function gerar() {
    if (!pedidoIA.briefing.trim()) return;
    setGerando(true); setErroIA(''); setSugestao(null);
    try {
      // só notas PESSOAIS do Segundo Cérebro, e nenhuma que cite IP/host/segredo
      let notas: { titulo: string; trecho: string }[] = [];
      try {
        const achados = await buscarMemorias(pedidoIA.briefing.slice(0, 200));
        notas = achados
          .filter((n) => n.escopo === 'pessoal' && riscosDePublicacao(`${n.titulo}\n${n.trecho}`).length === 0)
          .slice(0, 5)
          .map((n) => ({ titulo: n.titulo, trecho: n.trecho }));
      } catch { /* sem cérebro, segue só com a jornada */ }
      const r = await gerarRascunhoIA({ ...pedidoIA, formato: form.formato, notas, projetoId: form.projetoId });
      const tags = r.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ');
      setSugestao({ ...r, notasUsadas: notas.length });
      setEditando(null); // texto novo = rascunho novo (o anterior, se havia, continua salvo)
      setForm((f) => ({
        ...f, titulo: r.titulo, gancho: r.gancho, corpo: `${r.corpo.trim()}${tags ? `\n\n${tags}` : ''}`,
        direcaoVisual: r.direcaoVisual, textoAlternativo: r.textoAlternativo, roteiroSlides: r.roteiroSlides.join('\n'),
      }));
      setOrigem('ia:gerar'); setSalvo(false); setAntesDoRefino(null); setUltimoRefino(null);
    } catch (e) {
      setErroIA(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  function aoRefinar(acao: AcaoRefino, r: RefinoIA) {
    setAntesDoRefino({ form, origem });
    setUltimoRefino({ acao, oQueMudou: r.oQueMudou, alternativasGancho: acao === 'ganchos' ? r.alternativasGancho : [] });
    if (acao === 'ganchos') return; // o texto só muda quando uma das opções for escolhida
    setForm((f) => ({
      ...f, gancho: r.gancho, corpo: r.corpo,
      ...(acao === 'carrossel' ? { formato: 'carrossel' as const, roteiroSlides: r.roteiroSlides.join('\n') } : {}),
    }));
    setOrigem(`ia:${acao}`); setSalvo(false);
  }
  function escolherGancho(g: string) { setForm((f) => ({ ...f, gancho: g })); setOrigem('ia:ganchos'); setSalvo(false); }
  function desfazerRefino() {
    if (!antesDoRefino) return;
    setForm(antesDoRefino.form); setOrigem(antesDoRefino.origem); setAntesDoRefino(null); setUltimoRefino(null); setSalvo(false);
  }

  async function salvar() {
    if (!form.titulo.trim()) return;
    setErro(''); setSalvando(true);
    const corpoReq = { ...form, titulo: form.titulo.trim(), topicoId: form.topicoId ?? null, origemVersao: origem };
    try {
      const r = editando ? await editarRascunhoPipeline(editando.id, corpoReq) : await criarRascunhoPipeline({ ...corpoReq, ideiaId });
      // continua editando o mesmo rascunho (uma API antiga responde só { ok: true })
      if (r?.id) setEditando(r);
      setOrigem('manual'); setSalvo(true); setAntesDoRefino(null);
      invalidate('linkedin-rascunhos', 'linkedin-ideias');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const iaPronta = !!ia?.configurada;
  const emAndamento = rascunhos.filter((r) => r.status !== 'publicado').length;

  return (
    <div>
      <StatusStrip tone="ok" icon="pi-linkedin">
        {emAndamento} {emAndamento === 1 ? 'post em andamento' : 'posts em andamento'} no pipeline. Escreva à mão, parta de um modelo ou peça um rascunho à IA; depois refine e salve.
      </StatusStrip>

      <EstudioIA pedido={pedidoIA} onPedido={setPedidoIA} formato={form.formato} onFormato={(f) => campo('formato', formatoValido(f))}
        pilares={estrategia?.pilares ?? []} iaPronta={iaPronta} iaConhecida={!!ia} gerando={gerando} erro={erroIA} sugestao={sugestao} onGerar={gerar} />

      <div className="posts-workspace iv-mt">
        <EstudioEditor form={form} onCampo={campo} editando={editando} topicos={topicos} projetos={opcoesProjeto}
          erro={erro} salvo={salvo} salvando={salvando} onSalvar={salvar} onLimpar={limpar}
          onCopiar={() => copiarPost(form.gancho, form.corpo)} onVerPipeline={onVerPipeline}>
          <Refino gancho={form.gancho} corpo={form.corpo} iaPronta={iaPronta} ultimo={ultimoRefino} podeDesfazer={!!antesDoRefino}
            onResultado={aoRefinar} onEscolherGancho={escolherGancho} onDesfazer={desfazerRefino} />
        </EstudioEditor>
        <EstudioLateral gancho={form.gancho} corpo={form.corpo} onModelo={aplicarModelo} />
      </div>
    </div>
  );
}
