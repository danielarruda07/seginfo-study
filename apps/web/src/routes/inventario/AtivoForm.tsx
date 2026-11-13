import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Chips } from 'primereact/chips';
import type { Ativo } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { todayISO } from '@/services/store';
import { TIPO_ATIVO_LABEL } from '@/theme/status';
import { ESTADO_META, ESTADO_OPTS, TIPO_ICON, TIPO_OPTS, campoEndereco, validarAtivo, type AtivoErros } from './regras';

interface Props {
  inicial: Ativo;
  onCancel: () => void;
  onSave: (ativo: Ativo) => void;
}

const opcaoComIcone = (o: { label: string; icon: string } | null) =>
  o ? <span className="iv-row"><i className={`pi ${o.icon}`} aria-hidden="true" />{o.label}</span> : <span>Selecione</span>;

const CRITICIDADE_OPTS = [
  { label: 'Crítica', value: 'critica' }, { label: 'Alta', value: 'alta' }, { label: 'Média', value: 'media' }, { label: 'Baixa', value: 'baixa' },
];
const EXPOSICAO_OPTS = [
  { label: 'Pública / internet', value: 'publica' }, { label: 'Interna', value: 'interna' },
  { label: 'Restrita / administrativa', value: 'restrita' }, { label: 'Isolada', value: 'isolada' },
];

/** Cadastro/edição de ativo: diálogo navy em blocos, tipo em cartões e prévia ao vivo. */
export function AtivoForm({ inicial, onCancel, onSave }: Props) {
  const [d, setD] = useState<Ativo>(inicial);
  const [detalhesRaw, setDetalhesRaw] = useState(Object.keys(inicial.detalhes).length ? JSON.stringify(inicial.detalhes, null, 2) : '');
  const [erros, setErros] = useState<AtivoErros>({});
  const novo = !inicial.id;
  const end = campoEndereco(d.tipo);
  const estado = ESTADO_META[d.estado];
  const set = (p: Partial<Ativo>) => setD({ ...d, ...p });

  function salvar() {
    const r = validarAtivo(d.nome, detalhesRaw);
    setErros(r.erros);
    if (Object.keys(r.erros).length === 0) onSave({ ...d, nome: d.nome.trim(), detalhes: r.detalhes });
  }

  const footer = (
    <div className="iv-form__footer">
      <small>* obrigatório</small>
      <Button label="Cancelar" text onClick={onCancel} />
      <Button label={novo ? 'Cadastrar' : 'Salvar alterações'} icon="pi pi-check" onClick={salvar} />
    </div>
  );

  return (
    <Dialog visible header={novo ? 'Novo ativo' : `Editar · ${inicial.nome}`} onHide={onCancel} footer={footer}
      style={{ width: '780px' }} breakpoints={{ '820px': '96vw' }} draggable={false}>
      <form className="iv-form" onSubmit={(e) => { e.preventDefault(); salvar(); }} noValidate>
        <fieldset>
          <legend>O que é</legend>
          <div className="iv-typecards" role="radiogroup" aria-label="Tipo do ativo">
            {TIPO_OPTS.map((t) => (
              <button key={t.value} type="button" className="iv-typecard" role="radio" aria-checked={d.tipo === t.value} onClick={() => set({ tipo: t.value })}>
                <i className={`pi ${t.icon}`} aria-hidden="true" />{t.label}
              </button>
            ))}
          </div>
          <div className="iv-form__grid" style={{ marginTop: '.85rem' }}>
            <FormField id="at-nome" label="Nome" required error={erros.nome}>
              <InputText id="at-nome" value={d.nome} autoFocus className={erros.nome ? 'p-invalid' : undefined}
                aria-invalid={!!erros.nome} aria-describedby={erros.nome ? 'at-nome-erro' : undefined}
                placeholder={`ex.: ${TIPO_ATIVO_LABEL[d.tipo]} do lab de detecção`} onChange={(e) => set({ nome: e.target.value })} />
            </FormField>
            <FormField id="at-funcao" label="Função">
              <InputText id="at-funcao" value={d.funcao} placeholder="ex.: SIEM do laboratório" onChange={(e) => set({ funcao: e.target.value })} />
            </FormField>
          </div>
        </fieldset>

        <fieldset>
          <legend>Identificação e estado</legend>
          <div className="iv-form__grid">
            <FormField id="at-end" label={end.label}>
              <InputText id="at-end" value={d.endereco} placeholder={end.placeholder} className="mono" onChange={(e) => set({ endereco: e.target.value })} />
            </FormField>
            <FormField id="at-estado" label="Estado" required>
              <Dropdown inputId="at-estado" value={d.estado} options={ESTADO_OPTS} onChange={(e) => set({ estado: e.value })}
                itemTemplate={opcaoComIcone} valueTemplate={opcaoComIcone} />
            </FormField>
            <FormField id="at-criticidade" label="Criticidade operacional">
              <Dropdown inputId="at-criticidade" value={d.criticidade ?? null} options={CRITICIDADE_OPTS} showClear
                onChange={(e) => set({ criticidade: e.value ?? undefined })} placeholder="Não definida" />
            </FormField>
            <FormField id="at-exposicao" label="Exposição">
              <Dropdown inputId="at-exposicao" value={d.exposicao ?? null} options={EXPOSICAO_OPTS} showClear
                onChange={(e) => set({ exposicao: e.value ?? undefined })} placeholder="Não definida" />
            </FormField>
            <FormField id="at-conf" label="Confirmado em" hint="Última vez que você conferiu esta informação no equipamento.">
              <span className="iv-row">
                <InputText id="at-conf" type="date" value={d.confirmadoEm ?? ''} onChange={(e) => set({ confirmadoEm: e.target.value || undefined })} />
                <Button type="button" label="Hoje" text size="small" onClick={() => set({ confirmadoEm: todayISO() })} />
              </span>
            </FormField>
            <FormField id="at-fonte" label="Fonte da confirmação">
              <InputText id="at-fonte" value={d.fonte ?? ''} placeholder="ex.: API do firewall, console do switch" onChange={(e) => set({ fonte: e.target.value || undefined })} />
            </FormField>
          </div>
        </fieldset>

        <fieldset>
          <legend>Detalhes</legend>
          <div className="iv-form__grid">
            <FormField id="at-tags" label="Tags" hint="Digite e tecle Enter." full>
              <Chips inputId="at-tags" value={d.tags} onChange={(e) => set({ tags: (e.value ?? []).map((t) => t.trim()).filter(Boolean) })}
                separator="," placeholder={d.tags.length ? '' : 'ex.: proxmox, siem'} />
            </FormField>
            <FormField id="at-det" label="Detalhes técnicos (JSON)" error={erros.detalhes}
              hint="Opcional. Nunca coloque senhas ou tokens: credenciais ficam no Cofre." full>
              <InputTextarea id="at-det" value={detalhesRaw} rows={4} autoResize className={`mono${erros.detalhes ? ' p-invalid' : ''}`}
                aria-invalid={!!erros.detalhes} placeholder='ex.: {"cpu": "8 vCPU", "ram": "16 GB"}' onChange={(e) => setDetalhesRaw(e.target.value)} />
            </FormField>
          </div>
        </fieldset>

        <div className={`iv-preview ${estado.tone ? `tone-${estado.tone}` : ''}`} aria-live="polite">
          <i className={`pi ${TIPO_ICON[d.tipo]}`} aria-hidden="true" />
          <span>Vai aparecer como <strong>{d.nome.trim() || 'sem nome'}</strong> · {TIPO_ATIVO_LABEL[d.tipo]} · {estado.label.toLowerCase()}
            {d.estado === 'critico' || d.estado === 'atencao' ? ' — no topo da lista, com destaque' : ''}</span>
        </div>
      </form>
    </Dialog>
  );
}
