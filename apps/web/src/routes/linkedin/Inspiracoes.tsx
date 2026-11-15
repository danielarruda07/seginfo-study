import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import {
  ASPECTOS_INSPIRACAO, MAX_INSPIRACOES, ROTULO_ASPECTO, TIPOS_INSPIRACAO,
  type AspectoInspiracao, type InspiracaoLinkedin,
} from '@seginfo/shared';
import { Chip, EmptyState, Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import {
  criarInspiracao, descreverImagemDeInspiracao, editarInspiracao, listInspiracoes, removerInspiracao,
} from '@/services/linkedinPerfil';

type Form = {
  tipo: (typeof TIPOS_INSPIRACAO)[number]; autor: string; url: string; texto: string; motivo: string;
  aspectos: AspectoInspiracao[]; observacaoVisual: string; frequencia: string;
};
const FORM_VAZIO: Form = { tipo: 'post', autor: '', url: '', texto: '', motivo: '', aspectos: ['texto'], observacaoVisual: '', frequencia: '' };
const OPCOES_TIPO = [{ value: 'post', label: 'Post' }, { value: 'perfil', label: 'Perfil' }];
const linkSeguro = (u: string) => (/^https?:\/\/\S+$/i.test(u) ? u : '');

/**
 * Posts e perfis que você admira. Pode ser pelo texto, pelo visual, pela frequência, pelos assuntos ou pela carreira.
 * Só a descrição fica guardada; prints enviados são lidos pela IA e descartados.
 */
export function Inspiracoes() {
  const invalidate = useInvalidate();
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['linkedin-inspiracoes'], queryFn: listInspiracoes });
  const [editando, setEditando] = useState<InspiracaoLinkedin | 'novo' | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [lendoImagem, setLendoImagem] = useState(false);
  const imagem = useRef<HTMLInputElement>(null);

  function abrir(i: InspiracaoLinkedin | 'novo') {
    setErro('');
    setEditando(i);
    setForm(i === 'novo' ? FORM_VAZIO : {
      tipo: i.tipo, autor: i.autor, url: i.url, texto: i.texto, motivo: i.motivo, aspectos: i.aspectos,
      observacaoVisual: i.observacaoVisual, frequencia: i.frequencia,
    });
  }

  const campo = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const alternarAspecto = (a: AspectoInspiracao) =>
    campo('aspectos', form.aspectos.includes(a) ? form.aspectos.filter((x) => x !== a) : [...form.aspectos, a]);

  async function salvar() {
    if (!form.autor.trim()) return setErro('Diga quem é a pessoa.');
    if (form.url.trim() && !linkSeguro(form.url.trim())) return setErro('O link precisa começar com http:// ou https://.');
    setSalvando(true); setErro('');
    try {
      const corpo = { ...form, autor: form.autor.trim(), url: form.url.trim() };
      if (editando === 'novo') await criarInspiracao(corpo);
      else if (editando) await editarInspiracao(editando.id, corpo);
      invalidate('linkedin-inspiracoes');
      setEditando(null);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function aoEscolherImagem(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErro('A imagem tem mais de 5 MB.');
    setLendoImagem(true); setErro('');
    try {
      const descricao = await descreverImagemDeInspiracao(f);
      setForm((x) => ({ ...x, observacaoVisual: x.observacaoVisual ? `${x.observacaoVisual}\n\n${descricao}` : descricao, aspectos: x.aspectos.includes('imagem') ? x.aspectos : [...x.aspectos, 'imagem'] }));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setLendoImagem(false);
      if (imagem.current) imagem.current.value = '';
    }
  }

  async function remover(i: InspiracaoLinkedin) {
    if (!window.confirm(`Remover a inspiração de ${i.autor}?`)) return;
    await removerInspiracao(i.id);
    invalidate('linkedin-inspiracoes');
  }

  return (
    <section className="iv-card pv-secao">
      <div className="ca-toolbar">
        <h3 className="ca-h3"><i className="pi pi-star" aria-hidden="true" /> Inspirações <span className="iv-muted ca-small">({itens.length}/{MAX_INSPIRACOES})</span></h3>
        <Button label="Adicionar" icon="pi pi-plus" size="small" disabled={itens.length >= MAX_INSPIRACOES} onClick={() => abrir('novo')} />
      </div>
      <p className="iv-muted ca-small">
        Cadastre posts e perfis que você admira e diga o que chamou atenção: o texto, a imagem, a frequência, os assuntos ou a trajetória.
        A IA junta isso com os seus posts para entender o seu gosto. Ela aproveita estilo e estrutura, nunca as frases nem as opiniões da pessoa.
        Gostos mudam: edite ou remova quando uma referência deixar de servir.
      </p>
      {isLoading ? <p className="iv-muted" role="status">Carregando…</p> : itens.length === 0 ? (
        <EmptyState icon="pi-star" title="Nenhuma inspiração ainda"
          text="Comece com 3 a 5 posts ou perfis de que você gosta, de preferência de segurança da informação." />
      ) : (
        <ul className="pv-itens">
          {itens.map((i) => (
            <li key={i.id} className="pv-item">
              <div className="pv-item__cabeca">
                <span className="iv-row iv-wrap">
                  <strong>{i.autor}</strong>
                  <Pill label={i.tipo === 'post' ? 'Post' : 'Perfil'} tone="muted" />
                  {i.aspectos.map((a) => <Pill key={a} label={ROTULO_ASPECTO[a]} />)}
                </span>
                <span className="iv-row">
                  <Button icon="pi pi-pencil" text size="small" severity="secondary" aria-label={`Editar ${i.autor}`} onClick={() => abrir(i)} />
                  <Button icon="pi pi-trash" text size="small" severity="secondary" aria-label={`Remover ${i.autor}`} onClick={() => void remover(i)} />
                </span>
              </div>
              {i.motivo && <p className="ca-small ca-mb0"><strong>O que admiro:</strong> {i.motivo}</p>}
              {i.frequencia && <p className="ca-small ca-mb0"><strong>Frequência:</strong> {i.frequencia}</p>}
              {i.observacaoVisual && <p className="ca-small ca-mb0 ca-pre"><strong>Visual:</strong> {i.observacaoVisual}</p>}
              {i.texto && <p className="iv-muted ca-small ca-mb0 ca-pre">{i.texto.length > 280 ? `${i.texto.slice(0, 280)}…` : i.texto}</p>}
              {linkSeguro(i.url) && <a className="ca-small" href={linkSeguro(i.url)} target="_blank" rel="noopener noreferrer">Abrir no LinkedIn</a>}
            </li>
          ))}
        </ul>
      )}

      <Dialog header={editando === 'novo' ? 'Nova inspiração' : 'Editar inspiração'} visible={!!editando} onHide={() => setEditando(null)}
        style={{ width: 'min(680px, 96vw)' }}
        footer={(
          <div className="iv-row iv-wrap">
            <Button label="Salvar" icon="pi pi-save" loading={salvando} onClick={() => void salvar()} />
            <Button label="Cancelar" text onClick={() => setEditando(null)} />
          </div>
        )}>
        <div className="iv-col iv-gap">
          <div className="pv-grade">
            <label className="ca-campo"><strong className="ca-small">Tipo</strong>
              <Dropdown value={form.tipo} options={OPCOES_TIPO} onChange={(e) => campo('tipo', e.value)} /></label>
            <label className="ca-campo"><strong className="ca-small">Quem é</strong>
              <InputText value={form.autor} maxLength={120} onChange={(e) => campo('autor', e.target.value)} placeholder="Nome da pessoa" /></label>
            <label className="ca-campo pv-grade__larga"><strong className="ca-small">Link (opcional)</strong>
              <InputText value={form.url} maxLength={500} onChange={(e) => campo('url', e.target.value)} placeholder="https://www.linkedin.com/…" /></label>
          </div>
          <div>
            <strong className="ca-small">O que me chama atenção</strong>
            <div className="iv-row iv-wrap iv-mt">
              {ASPECTOS_INSPIRACAO.map((a) => <Chip key={a} label={ROTULO_ASPECTO[a]} active={form.aspectos.includes(a)} onClick={() => alternarAspecto(a)} />)}
            </div>
          </div>
          <label className="ca-campo"><strong className="ca-small">Por que admiro (ou o que quero evitar)</strong>
            <InputTextarea value={form.motivo} rows={2} autoResize maxLength={1000} onChange={(e) => campo('motivo', e.target.value)}
              placeholder="Ex.: abre sempre com um número real e fecha com uma pergunta técnica." /></label>
          <label className="ca-campo">
            <strong className="ca-small">{form.tipo === 'post' ? 'Texto do post' : 'Headline, sobre e assuntos do perfil'}</strong>
            <InputTextarea value={form.texto} rows={6} autoResize maxLength={10_000} onChange={(e) => campo('texto', e.target.value)}
              placeholder={form.tipo === 'post' ? 'Cole o texto do post.' : 'Cole o que o perfil mostra e os temas que a pessoa costuma tratar.'} /></label>
          <label className="ca-campo"><strong className="ca-small">Frequência de postagem</strong>
            <InputText value={form.frequencia} maxLength={120} onChange={(e) => campo('frequencia', e.target.value)} placeholder="Ex.: 3 posts por semana" /></label>
          <label className="ca-campo">
            <strong className="ca-small">Como é o visual (imagem, capa, carrossel)</strong>
            <InputTextarea value={form.observacaoVisual} rows={4} autoResize maxLength={1500} onChange={(e) => campo('observacaoVisual', e.target.value)}
              placeholder="Descreva à mão ou envie um print para a IA descrever." />
          </label>
          <div className="iv-row iv-wrap">
            <input ref={imagem} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Print do post"
              onChange={(e) => void aoEscolherImagem(e.target.files?.[0])} />
            <Button label={lendoImagem ? 'Analisando…' : 'Analisar um print'} icon="pi pi-image" size="small" outlined loading={lendoImagem} onClick={() => imagem.current?.click()} />
            <span className="iv-muted ca-small">A IA descreve o estilo; a imagem não fica guardada. Evite prints com dados pessoais.</span>
          </div>
          {erro && <Message severity="error" text={erro} className="ca-w100" />}
        </div>
      </Dialog>
    </section>
  );
}
