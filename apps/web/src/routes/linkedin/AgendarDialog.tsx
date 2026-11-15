import { useMemo, useState, type FormEvent } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import { avaliarAgendamento, motivoSemApi, ROTULO_VISIBILIDADE, type CanalPublicacao, type RascunhoLinkedin } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { mensagemErro } from '@/services/linkedin';
import { agendarRascunho } from '@/services/linkedinPipeline';
import { detalheDoErro } from './dados';
import { CANAL_LABEL, deDatetimeLocal, fusoDoNavegador, paraDatetimeLocal, sugestaoDeHorario } from './pipelineRegras';

/**
 * Agendamento de um rascunho aprovado. No canal "lembrete" o app avisa na hora e você publica à mão;
 * no canal "api" o servidor publica. As regras de ritmo aparecem ao vivo; quem decide é o servidor.
 */
export function AgendarDialog({ rascunho, ocupados, contaConectada, onClose, onAgendado }: {
  rascunho: RascunhoLinkedin;
  /** instantes de outros agendados e dos publicados */
  ocupados: string[];
  contaConectada: boolean;
  onClose: () => void;
  onAgendado: () => void;
}) {
  const motivoApi = !contaConectada ? 'Conecte o LinkedIn na aba "Marca pessoal & IA" para o servidor publicar.'
    : motivoSemApi(rascunho.formato, rascunho.midia ?? null) ?? '';
  const [valor, setValor] = useState(() => (rascunho.agendadoPara ? paraDatetimeLocal(rascunho.agendadoPara) : sugestaoDeHorario(new Date())));
  const [canal, setCanal] = useState<CanalPublicacao>(rascunho.canal === 'api' && !motivoApi ? 'api' : 'lembrete');
  const [erro, setErro] = useState('');
  const [conflitoServidor, setConflitoServidor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const iso = deDatetimeLocal(valor);
  const avaliacao = useMemo(() => (iso ? avaliarAgendamento(iso, new Date(), ocupados, fusoDoNavegador()) : null), [iso, ocupados]);
  const conflito = conflitoServidor || avaliacao?.conflito || '';

  async function salvar(ev?: FormEvent, forcar = false) {
    ev?.preventDefault();
    if (!iso) return setErro('Informe a data e a hora.');
    if (avaliacao?.erro) return setErro(avaliacao.erro);
    setErro(''); setSalvando(true);
    try {
      await agendarRascunho(rascunho.id, { quando: iso, canal, ...(forcar ? { forcar: true } : {}) });
      onAgendado();
    } catch (e) {
      const d = detalheDoErro(e);
      if (d.status === 409 && d.conflito) setConflitoServidor(mensagemErro(e));
      else setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = (['lembrete', 'api'] as CanalPublicacao[]).map((value) => ({ value, label: CANAL_LABEL[value], disabled: value === 'api' && !!motivoApi }));

  return (
    <Dialog header={rascunho.status === 'agendado' ? 'Reagendar post' : 'Agendar post'} visible onHide={onClose} className="ca-dialog" style={{ width: 'min(560px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          {conflito
            ? <Button label="Agendar mesmo assim" icon="pi pi-calendar-plus" severity="warning" loading={salvando} onClick={() => salvar(undefined, true)} />
            : <Button label="Agendar" icon="pi pi-calendar-plus" loading={salvando} onClick={() => salvar()} />}
        </div>
      )}>
      <form className="iv-form" onSubmit={(ev) => salvar(ev, !!conflito)}>
        <p className="iv-muted ca-small ca-mb0"><strong>{rascunho.titulo}</strong> · {ROTULO_VISIBILIDADE[rascunho.visibilidade ?? 'PUBLIC']}{rascunho.midia ? ` · com ${rascunho.midia.tipo === 'imagem' ? 'imagem' : 'PDF'}` : ''}</p>
        <div className="iv-form__grid">
          <FormField id="ag-quando" label="Data e hora" required full error={erro} hint="No horário deste computador.">
            <InputText id="ag-quando" type="datetime-local" value={valor} min={paraDatetimeLocal(new Date())}
              onChange={(e) => { setValor(e.target.value); setErro(''); setConflitoServidor(''); }} />
          </FormField>
          <FormField id="ag-canal" label="Como publicar" full hint={motivoApi || (canal === 'api'
            ? 'O servidor publica sozinho na hora marcada. Antes de publicar ele refaz a verificação do texto.'
            : 'Na hora marcada o post aparece em "Hora de publicar"; você copia, publica e registra o link.')}>
            <SelectButton id="ag-canal" value={canal} options={opcoes} optionDisabled="disabled" allowEmpty={false} onChange={(e) => setCanal(e.value)} />
          </FormField>
        </div>
        {conflito && <p className="ca-aviso" role="status"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> {conflito}</p>}
        {avaliacao?.avisos.map((a) => <p key={a} className="ca-aviso" role="status"><i className="pi pi-info-circle" aria-hidden="true" /> {a}</p>)}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
