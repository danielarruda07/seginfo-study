import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import {
  PAPEIS_SLIDE, ROTULO_PAPEL, TAMANHOS_VISUAIS, TAMANHO_VISUAL_PADRAO, slideVazio,
  type OpcaoIlustracao, type PapelSlide, type RascunhoLinkedin, type SlideVisual, type TamanhoVisual,
} from '@seginfo/shared';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { enviarMidia } from '@/services/linkedinPipeline';
import { gerarIlustracao, getOpcoesImagem, projetarPeca } from '@/services/linkedinVisual';
import { useContaLinkedin } from './dados';
import { CampoLista } from './ListaEditavel';
import { montarPdf } from './visual/pdf';
import { ACENTOS, carregarImagem, desenharSlide, paraBlob, type Acento } from './visual/renderizar';

interface ItemSlide { id: string; slide: SlideVisual; img: HTMLImageElement | null }
const novoId = () => crypto.randomUUID();
const OPCOES_PAPEL = PAPEIS_SLIDE.map((p) => ({ value: p, label: ROTULO_PAPEL[p] }));
const OPCOES_ACENTO = (Object.keys(ACENTOS) as Acento[]).map((a) => ({ value: a, label: ACENTOS[a].rotulo }));

/** Prévia ao vivo de um slide (desenha em tamanho real e o CSS reduz). */
function Previa({ slide, tamanho, acento, indice, total, autor, img }: {
  slide: SlideVisual; tamanho: TamanhoVisual; acento: Acento; indice: number; total: number; autor: string; img: HTMLImageElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = setTimeout(() => { if (ref.current) desenharSlide(ref.current, slide, { tamanho, acento, indice, total, autor, ilustracao: img }); }, 200);
    return () => clearTimeout(t);
  }, [slide, tamanho, acento, indice, total, autor, img]);
  const { largura, altura } = TAMANHOS_VISUAIS[tamanho];
  return <canvas ref={ref} className="pv-previa" style={{ aspectRatio: `${largura} / ${altura}` }} role="img" aria-label={`Prévia do slide ${indice}: ${slide.titulo || slide.destaque || ROTULO_PAPEL[slide.papel]}`} />;
}

const baixar = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
};

/**
 * Arte do post: a IA projeta os slides, você ajusta o texto, o navegador desenha (tema escuro) e a arte
 * vira PNG (imagem) ou PDF (carrossel), anexada ao rascunho para publicar pela API. A ilustração por IA
 * é opcional e só é gerada (e cobrada) quando você clica.
 */
export function EstudioVisual({ tipo, gancho, corpo, roteiro, direcao, rascunho, iaPronta, onAtualizado, onTextoAlternativo }: {
  tipo: 'imagem' | 'carrossel';
  gancho: string; corpo: string; roteiro: string; direcao: string;
  rascunho: RascunhoLinkedin | null;
  iaPronta: boolean;
  onAtualizado: (r: RascunhoLinkedin) => void;
  onTextoAlternativo: (t: string) => void;
}) {
  const invalidate = useInvalidate();
  const { data: conta } = useContaLinkedin();
  const { data: imagem } = useQuery({ queryKey: ['linkedin-imagem-opcoes'], queryFn: getOpcoesImagem, staleTime: 30_000 });
  const [itens, setItens] = useState<ItemSlide[]>([]);
  const [docTitulo, setDocTitulo] = useState('');
  const [tamanho, setTamanho] = useState<TamanhoVisual>(TAMANHO_VISUAL_PADRAO);
  const [acento, setAcento] = useState<Acento>('ciano');
  const [opcao, setOpcao] = useState<OpcaoIlustracao>('gemini-rapido');
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const autor = conta?.nome ?? '';
  const fechado = rascunho?.status === 'publicado' || rascunho?.status === 'publicando';
  const opcoesTamanho = (Object.keys(TAMANHOS_VISUAIS) as TamanhoVisual[])
    .filter((t) => tipo === 'imagem' || t !== 'paisagem')
    .map((t) => ({ value: t, label: TAMANHOS_VISUAIS[t].rotulo }));
  const opcoesIlustracao = (imagem?.opcoes ?? []).map((o) => ({ value: o.id, label: `${o.rotulo} (${o.custoEstimado})` }));
  const infoOpcao = imagem?.opcoes.find((o) => o.id === opcao);

  async function criar() {
    setOcupado('Projetando os slides com a IA…'); setErro(''); setOk('');
    try {
      const p = await projetarPeca({ tipo, gancho, corpo, roteiro, direcao });
      setItens(p.slides.map((slide) => ({ id: novoId(), slide, img: null })));
      setDocTitulo(p.tituloDocumento);
      if (p.textoAlternativo) onTextoAlternativo(p.textoAlternativo);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  const editar = (id: string, mudanca: Partial<SlideVisual>) =>
    setItens((l) => l.map((i) => (i.id === id ? { ...i, slide: { ...i.slide, ...mudanca } } : i)));
  const mover = (idx: number, d: -1 | 1) => setItens((l) => {
    const alvo = idx + d;
    if (alvo < 0 || alvo >= l.length) return l;
    const c = [...l]; [c[idx], c[alvo]] = [c[alvo], c[idx]]; return c;
  });

  async function ilustrar(item: ItemSlide) {
    setOcupado(`Gerando a ilustração (${infoOpcao?.rotulo ?? 'Gemini'})…`); setErro(''); setOk('');
    try {
      const r = await gerarIlustracao({ opcao, prompt: item.slide.ilustracao, tamanho, acento });
      const img = await carregarImagem(r.mime, r.base64);
      setItens((l) => l.map((i) => (i.id === item.id ? { ...i, img } : i)));
      invalidate('linkedin-imagem-opcoes');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function desenharTodos(): Promise<HTMLCanvasElement[]> {
    return itens.map((i, idx) => {
      const c = document.createElement('canvas');
      desenharSlide(c, i.slide, { tamanho, acento, indice: idx + 1, total: itens.length, autor, ilustracao: i.img });
      return c;
    });
  }

  async function exportar(): Promise<{ arquivo: File; titulo?: string }> {
    const canvases = await desenharTodos();
    if (tipo === 'imagem') {
      let blob = await paraBlob(canvases[0], 'image/png');
      let ext = 'png';
      if (blob.size > 7.5 * 1024 * 1024) { blob = await paraBlob(canvases[0], 'image/jpeg', 0.92); ext = 'jpg'; }
      return { arquivo: new File([blob], `arte-linkedin.${ext}`, { type: blob.type }) };
    }
    const { largura, altura } = TAMANHOS_VISUAIS[tamanho];
    const paginas = await Promise.all(canvases.map(async (c) => ({ jpeg: new Uint8Array(await (await paraBlob(c, 'image/jpeg', 0.9)).arrayBuffer()), largura, altura })));
    const pdf = montarPdf(paginas);
    return { arquivo: new File([pdf], 'carrossel-linkedin.pdf', { type: 'application/pdf' }), titulo: docTitulo.trim() || 'Carrossel' };
  }

  async function anexar() {
    if (!rascunho) return;
    setOcupado('Desenhando e enviando…'); setErro(''); setOk('');
    try {
      const { arquivo, titulo } = await exportar();
      onAtualizado(await enviarMidia(rascunho.id, arquivo, titulo));
      setOk('Arte anexada ao rascunho. Confira a prévia em "Arquivo para publicar pela API".');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function baixarArte() {
    setOcupado('Desenhando…'); setErro('');
    try { const { arquivo } = await exportar(); baixar(arquivo, arquivo.name); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(''); }
  }

  const geminiPronto = !!imagem?.configurado;
  const restantes = imagem ? Math.max(0, imagem.limiteDiario - imagem.usadasHoje) : 0;

  return (
    <section className="iv-card pv-secao" aria-label="Criar a arte do post">
      <h4 className="ca-h4"><i className="pi pi-palette" aria-hidden="true" /> Criar a arte ({tipo === 'carrossel' ? 'carrossel em PDF' : 'imagem'})</h4>
      <p className="iv-muted ca-small ca-mb0">
        A IA monta os slides a partir do texto do post; você ajusta, e a arte é desenhada em fundo escuro. O padrão é retrato 4:5 (1080×1350),
        que ocupa mais tela no celular. Texto grande e curto lê melhor no feed.
      </p>
      <div className="iv-row iv-wrap">
        <Dropdown value={tamanho} options={opcoesTamanho} onChange={(e) => setTamanho(e.value)} ariaLabel="Tamanho da arte" />
        <Dropdown value={acento} options={OPCOES_ACENTO} onChange={(e) => setAcento(e.value)} ariaLabel="Cor de destaque" />
        <Button label={itens.length ? 'Refazer com a IA' : 'Criar slides com a IA'} icon="pi pi-sparkles" loading={ocupado.startsWith('Projetando')}
          disabled={!iaPronta || !!ocupado || gancho.trim().length + corpo.trim().length < 40} onClick={() => void criar()} />
        {itens.length === 0 && (
          <Button label="Começar em branco" text size="small" disabled={!!ocupado}
            onClick={() => setItens([{ id: novoId(), slide: slideVazio('capa'), img: null }])} />
        )}
      </div>
      {!iaPronta && <p className="iv-muted ca-small ca-mb0">A IA não está configurada; dá para montar os slides à mão.</p>}

      {itens.length > 0 && (
        <>
          <div className="iv-row iv-wrap">
            <label className="ca-campo"><strong className="ca-small">Motor da ilustração</strong>
              <Dropdown value={opcao} options={opcoesIlustracao} onChange={(e) => setOpcao(e.value)} disabled={!geminiPronto} ariaLabel="Motor da ilustração" style={{ minWidth: 300 }}
                placeholder="Gemini não configurado" />
            </label>
            <span className="iv-muted ca-small">
              {geminiPronto
                ? <>Só gera quando você clicar em "Gerar ilustração". {infoOpcao?.dica} Restam {restantes} hoje (limite {imagem?.limiteDiario}).</>
                : 'Sem GEMINI_API_KEY no servidor: a arte sai só com o template (grátis).'}
            </span>
          </div>
          {tipo === 'carrossel' && (
            <label className="ca-campo"><strong className="ca-small">Título do documento no LinkedIn</strong>
              <InputText value={docTitulo} maxLength={200} onChange={(e) => setDocTitulo(e.target.value)} /></label>
          )}
          <ul className="pv-itens">
            {itens.map((item, idx) => (
              <li key={item.id} className="pv-item pv-slide">
                <Previa slide={item.slide} tamanho={tamanho} acento={acento} indice={idx + 1} total={itens.length} autor={autor} img={item.img} />
                <div className="iv-col iv-gap">
                  <div className="pv-item__cabeca">
                    <strong className="ca-small">Slide {idx + 1}</strong>
                    <span className="iv-row">
                      <Button icon="pi pi-arrow-up" text size="small" severity="secondary" aria-label="Subir slide" disabled={idx === 0} onClick={() => mover(idx, -1)} />
                      <Button icon="pi pi-arrow-down" text size="small" severity="secondary" aria-label="Descer slide" disabled={idx === itens.length - 1} onClick={() => mover(idx, 1)} />
                      <Button icon="pi pi-trash" text size="small" severity="secondary" aria-label="Remover slide" disabled={tipo === 'imagem' || itens.length <= 1}
                        onClick={() => setItens((l) => l.filter((i) => i.id !== item.id))} />
                    </span>
                  </div>
                  <div className="pv-grade">
                    <label className="ca-campo"><strong className="ca-small">Tipo</strong>
                      <Dropdown value={item.slide.papel} options={OPCOES_PAPEL} onChange={(e) => editar(item.id, { papel: e.value as PapelSlide })} /></label>
                    <label className="ca-campo"><strong className="ca-small">Rótulo</strong>
                      <InputText value={item.slide.rotulo} maxLength={48} onChange={(e) => editar(item.id, { rotulo: e.target.value })} placeholder="LAB · HONEYPOT" /></label>
                  </div>
                  {item.slide.papel === 'numero' && (
                    <label className="ca-campo"><strong className="ca-small">Número em destaque</strong>
                      <InputText value={item.slide.destaque} maxLength={14} onChange={(e) => editar(item.id, { destaque: e.target.value })} /></label>
                  )}
                  <label className="ca-campo"><strong className="ca-small">Título</strong>
                    <InputTextarea value={item.slide.titulo} rows={2} autoResize maxLength={110} onChange={(e) => editar(item.id, { titulo: e.target.value })} /></label>
                  <label className="ca-campo"><strong className="ca-small">Texto</strong>
                    <InputTextarea value={item.slide.texto} rows={2} autoResize maxLength={320} onChange={(e) => editar(item.id, { texto: e.target.value })} /></label>
                  <CampoLista value={item.slide.itens} separador="linha" rotulo="Itens (um por linha, até 6)" linhas={2} onChange={(v) => editar(item.id, { itens: v.slice(0, 6) })} />
                  <label className="ca-campo"><strong className="ca-small">Ilustração de fundo (descrição em inglês, sem texto; opcional)</strong>
                    <InputTextarea value={item.slide.ilustracao} rows={2} autoResize maxLength={500} onChange={(e) => editar(item.id, { ilustracao: e.target.value })}
                      placeholder="Ex.: abstract network of glowing nodes, one node highlighted" /></label>
                  <div className="iv-row iv-wrap">
                    <Button label={item.img ? 'Gerar outra ilustração' : 'Gerar ilustração'} icon="pi pi-image" size="small" outlined
                      disabled={!geminiPronto || !!ocupado || item.slide.ilustracao.trim().length < 10 || restantes <= 0} onClick={() => void ilustrar(item)} />
                    {item.img && <Button label="Tirar ilustração" text size="small" severity="secondary" onClick={() => setItens((l) => l.map((i) => (i.id === item.id ? { ...i, img: null } : i)))} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {tipo === 'carrossel' && itens.length < 10 && (
            <div><Button label="Adicionar slide" icon="pi pi-plus" size="small" outlined onClick={() => setItens((l) => [...l, { id: novoId(), slide: slideVazio(), img: null }])} /></div>
          )}
          <div className="iv-row iv-wrap">
            <Button label="Anexar ao post" icon="pi pi-paperclip" loading={ocupado.startsWith('Desenhando e')} disabled={!rascunho || fechado || !!ocupado} onClick={() => void anexar()} />
            <Button label={tipo === 'carrossel' ? 'Baixar PDF' : 'Baixar imagem'} icon="pi pi-download" outlined disabled={!!ocupado} onClick={() => void baixarArte()} />
            {!rascunho && <span className="iv-muted ca-small">Salve o rascunho para anexar a arte.</span>}
          </div>
        </>
      )}
      {ocupado && <span className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> {ocupado}</span>}
      {ok && <Message severity="success" text={ok} className="ca-w100" />}
      {erro && <Message severity="error" text={erro} className="ca-w100" />}
    </section>
  );
}
