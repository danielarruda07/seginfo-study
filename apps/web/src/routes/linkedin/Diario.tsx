import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { CategoriaDiario } from '@seginfo/shared';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { todayISO } from '@/services/store';
import {
  addDiario, CATEGORIA_DIARIO_LABEL, diarioEmMarkdown, juntarDiario, listDiarioServidor, mensagemErro,
  removeDiario, riscosDePublicacao,
} from '@/services/linkedin';
import { copyToClipboard } from '@/lib/clipboard';
import type { PedidoEstudio } from './Estudio';

const CATEGORIA_COR: Record<CategoriaDiario, string> = {
  funcionalidade: '#0ea5e9',
  seguranca: '#ef4444',
  infra: '#64748b',
  decisao: '#7c3aed',
  aprendizado: '#16a34a',
  plano: '#f59e0b',
};

const IDEIAS_DE_POST: { label: string; briefing: string }[] = [
  { label: 'A história completa', briefing: 'Post contando a construção da SegInfo Study do zero até hoje: por que comecei, as principais decisões de segurança e o que aprendi.' },
  { label: 'Decisões de segurança', briefing: 'Post sobre as decisões de segurança que tomei construindo minha própria plataforma de estudos (cofre cifrado, backup que o servidor não lê, dados corporativos fora).' },
  { label: 'Erros e lições', briefing: 'Post honesto sobre os erros e lições ao construir a SegInfo Study — o que eu faria diferente.' },
  { label: 'Próximo capítulo: pentest', briefing: 'Post anunciando que minha plataforma de estudos vai virar alvo autorizado de pentest no meu homelab, e o que pretendo aprender com isso.' },
];

export function Diario({ onGerarPost }: { onGerarPost: (p: PedidoEstudio) => void }) {
  const invalidate = useInvalidate();
  const { data: doServidor = [], error } = useQuery({ queryKey: ['linkedin-diario'], queryFn: listDiarioServidor });
  const entradas = juntarDiario(doServidor);
  const [filtro, setFiltro] = useState<CategoriaDiario | undefined>();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDiario>('aprendizado');
  const [data, setData] = useState(todayISO);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  const riscos = riscosDePublicacao(`${titulo}\n${descricao}`);
  const visiveis = filtro ? entradas.filter((e) => e.categoria === filtro) : entradas;

  async function salvar() {
    if (!titulo.trim() || !descricao.trim()) return;
    setErro('');
    try {
      await addDiario({ data, titulo: titulo.trim(), descricao: descricao.trim(), categoria, tags: [] });
      setTitulo(''); setDescricao('');
      invalidate('linkedin-diario');
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function remover(id: string) {
    try { await removeDiario(id); invalidate('linkedin-diario'); }
    catch (e) { setErro(mensagemErro(e)); }
  }

  return (
    <div>
      <StatusStrip tone="ok" icon="pi-book">
        {entradas.length} marcos da construção da SegInfo Study — a matéria-prima do post sobre o projeto. O assistente de desenvolvimento registra cada mudança relevante no código (e no GitHub); os seus ficam no banco.
      </StatusStrip>
      {error && <Message severity="error" text={mensagemErro(error)} style={{ width: '100%', marginTop: '.75rem' }} />}

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Transformar em post</h3>
          <Button label={copiado ? 'Copiado!' : 'Copiar diário (Markdown)'} icon="pi pi-copy" outlined size="small"
            onClick={() => { copyToClipboard(diarioEmMarkdown(entradas)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} />
        </div>
        <div className="iv-row iv-wrap iv-mt">
          {IDEIAS_DE_POST.map((i) => (
            <Chip key={i.label} label={i.label} icon="pi-sparkles"
              onClick={() => onGerarPost({ briefing: i.briefing, pilar: 'Construindo a SegInfo Study em público', incluirDiario: true })} />
          ))}
        </div>
        <p className="iv-muted" style={{ fontSize: '.8rem', marginBottom: 0 }}>Abre o Estúdio com o briefing pronto e o diário como contexto.</p>
      </div>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Novo marco</h3>
        <div className="iv-col iv-gap">
          <div className="iv-row iv-wrap iv-gap">
            <InputText type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" />
            <Dropdown value={categoria} options={Object.entries(CATEGORIA_DIARIO_LABEL).map(([value, label]) => ({ value, label }))} onChange={(e) => setCategoria(e.value)} aria-label="Categoria" />
            <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que aconteceu?" style={{ flex: 1, minWidth: 220 }} />
          </div>
          <InputTextarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} autoResize placeholder="Contexto, decisão, lição. Escreva como se fosse público: sem IPs, hosts ou falhas abertas." />
          {riscos.length > 0 && <small style={{ color: 'var(--iv-warn, #f59e0b)' }}><i className="pi pi-exclamation-triangle" /> Pode expor: {riscos.join(', ')}.</small>}
          {erro && <Message severity="error" text={erro} style={{ width: '100%' }} />}
          <div><Button label="Adicionar ao diário" icon="pi pi-plus" onClick={salvar} disabled={!titulo.trim() || !descricao.trim()} /></div>
        </div>
      </div>

      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Tudo" active={!filtro} onClick={() => setFiltro(undefined)} />
        {(Object.keys(CATEGORIA_DIARIO_LABEL) as CategoriaDiario[]).map((c) => (
          <Chip key={c} label={CATEGORIA_DIARIO_LABEL[c]} active={filtro === c} onClick={() => setFiltro(filtro === c ? undefined : c)} />
        ))}
      </div>

      <ol className="linkedin-timeline iv-mt">
        {visiveis.map((e) => (
          <li key={e.id} style={{ ['--cor' as string]: CATEGORIA_COR[e.categoria] }}>
            <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', gap: '.5rem' }}>
              <div className="iv-row iv-wrap" style={{ gap: '.4rem' }}>
                <span className="iv-muted" style={{ fontSize: '.8rem' }}>{e.data}</span>
                <Pill label={CATEGORIA_DIARIO_LABEL[e.categoria]} color={CATEGORIA_COR[e.categoria]} />
                {e.origem === 'voce' && <Pill label="seu registro" />}
              </div>
              {e.origem === 'voce' && (
                <Button icon="pi pi-trash" text severity="danger" size="small" aria-label="Remover marco" onClick={() => remover(e.id)} />
              )}
            </div>
            <strong>{e.titulo}</strong>
            <p className="iv-muted" style={{ margin: '.25rem 0 0', fontSize: '.88rem' }}>{e.descricao}</p>
            {e.tags.length > 0 && <div className="iv-muted" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>{e.tags.map((t) => `#${t}`).join(' ')}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
