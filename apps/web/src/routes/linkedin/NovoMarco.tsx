import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import type { CategoriaDiario } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { useInvalidate } from '@/hooks/useInvalidate';
import { todayISO } from '@/services/store';
import { addDiario, CATEGORIA_DIARIO_LABEL, mensagemErro, riscosDePublicacao } from '@/services/linkedin';

const CATEGORIAS = Object.entries(CATEGORIA_DIARIO_LABEL).map(([value, label]) => ({ value, label }));

/** Registro de um marco seu no diário (fica no banco). Fechado por padrão para não empurrar a linha do tempo. */
export function NovoMarco({ onErro }: { onErro: (msg: string) => void }) {
  const invalidate = useInvalidate();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDiario>('aprendizado');
  const [data, setData] = useState(todayISO);
  const riscos = riscosDePublicacao(`${titulo}\n${descricao}`);

  async function salvar() {
    if (!titulo.trim() || !descricao.trim()) return;
    onErro('');
    try {
      await addDiario({ data, titulo: titulo.trim(), descricao: descricao.trim(), categoria, tags: [] });
      setTitulo(''); setDescricao(''); setAberto(false);
      invalidate('linkedin-diario');
    } catch (e) {
      onErro(mensagemErro(e));
    }
  }

  if (!aberto) {
    return (
      <div className="iv-mt">
        <Button label="Novo marco" icon="pi pi-plus" outlined onClick={() => setAberto(true)} />
      </div>
    );
  }

  return (
    <section className="iv-card iv-mt" aria-labelledby="novo-marco-titulo">
      <h3 id="novo-marco-titulo" className="ca-h3">Novo marco</h3>
      <div className="iv-form iv-mt">
        <div className="iv-form__grid">
          <FormField id="marco-data" label="Data" required>
            <InputText id="marco-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
          <FormField id="marco-cat" label="Categoria">
            <Dropdown inputId="marco-cat" value={categoria} options={CATEGORIAS} onChange={(e) => setCategoria(e.value)} />
          </FormField>
          <FormField id="marco-titulo" label="O que aconteceu?" required full>
            <InputText id="marco-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </FormField>
          <FormField id="marco-desc" label="Contexto, decisão, lição" required full hint="Escreva como se fosse público: sem IPs, hosts ou falhas abertas.">
            <InputTextarea id="marco-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} autoResize />
          </FormField>
        </div>
        {riscos.length > 0 && <p className="ca-aviso" role="status"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Pode expor: {riscos.join(', ')}.</p>}
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={() => setAberto(false)} />
          <Button label="Adicionar ao diário" icon="pi pi-plus" onClick={salvar} disabled={!titulo.trim() || !descricao.trim()} />
        </div>
      </div>
    </section>
  );
}
