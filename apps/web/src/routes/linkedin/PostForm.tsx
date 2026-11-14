import { useState, type FormEvent } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { PostPublicado } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { FORMATOS, criarPublicado, editarPublicado, mensagemErro } from '@/services/linkedin';
import { todayISO } from '@/services/store';
import { METRICAS_CAMPOS, validarPost, type FormularioPost } from './regras';

export const novoFormulario = (texto = ''): FormularioPost => ({ url: '', publicadoEm: todayISO(), formato: 'texto', texto, metricas: {} });
export const formularioDe = (p: PostPublicado): FormularioPost => ({ id: p.id, url: p.url, publicadoEm: p.publicadoEm, formato: p.formato, texto: p.texto, metricas: p.metricas });

/** Registro/edição de post publicado (Dialog). Valida com `validarPost` e salva no servidor. */
export function PostForm({ inicial, posts, onClose, onSalvo }: {
  inicial: FormularioPost;
  posts: PostPublicado[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    const invalido = validarPost(form, posts);
    if (invalido) return setErro(invalido);
    setErro('');
    const corpo = { url: form.url.trim(), publicadoEm: form.publicadoEm, formato: form.formato, texto: form.texto.trim(), metricas: { ...form.metricas, atualizadoEm: todayISO() } };
    setSalvando(true);
    try {
      if (form.id) await editarPublicado(form.id, corpo);
      else await criarPublicado(corpo);
      onSalvo();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const erroUrl = erro.startsWith('Cole o link') || erro.includes('já está registrado') ? erro : '';
  const erroTexto = erro.startsWith('Cole o texto') ? erro : '';
  const erroGeral = erro && !erroUrl && !erroTexto ? erro : '';

  return (
    <Dialog header={form.id ? 'Editar post publicado' : 'Registrar post publicado'} visible onHide={onClose} className="ca-dialog" style={{ width: 'min(720px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          <Button label={form.id ? 'Salvar alterações' : 'Registrar post'} icon="pi pi-save" loading={salvando} onClick={() => salvar()} />
        </div>
      )}>
      <form className="iv-form" onSubmit={salvar}>
        <fieldset>
          <legend>Publicação</legend>
          <div className="iv-form__grid">
            <FormField id="post-url" label="Link do post" required full error={erroUrl} hint='No LinkedIn: menu ⋯ do post → "Copiar link da publicação".'>
              <InputText id="post-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.linkedin.com/posts/..." />
            </FormField>
            <FormField id="post-data" label="Publicado em" required>
              <InputText id="post-data" type="date" value={form.publicadoEm} onChange={(e) => setForm({ ...form, publicadoEm: e.target.value })} />
            </FormField>
            <FormField id="post-formato" label="Formato">
              <Dropdown inputId="post-formato" value={form.formato} options={[...FORMATOS]} onChange={(e) => setForm({ ...form, formato: e.value })} />
            </FormField>
            <FormField id="post-texto" label="Texto do post" required full error={erroTexto}
              hint={form.id ? 'Se mudar o texto, a organização da IA é descartada e o post volta para "pendente".' : 'Cole como foi publicado: é dele que a IA tira o contexto.'}>
              <InputTextarea id="post-texto" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} rows={8} autoResize />
            </FormField>
          </div>
        </fieldset>
        <fieldset>
          <legend>Métricas (opcional, atualize depois de alguns dias)</legend>
          <div className="linkedin-metricas">
            {METRICAS_CAMPOS.map(([k, label]) => (
              <FormField key={k} id={`post-m-${k}`} label={label}>
                <InputNumber inputId={`post-m-${k}`} value={form.metricas[k] ?? null} min={0} useGrouping
                  onValueChange={(e) => setForm({ ...form, metricas: { ...form.metricas, [k]: e.value ?? undefined } })} inputStyle={{ width: '100%' }} />
              </FormField>
            ))}
          </div>
        </fieldset>
        {erroGeral && <small className="iv-field__error" role="alert">{erroGeral}</small>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
